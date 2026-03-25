import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import QRCode from 'qrcode';
import {
  createRoom, getRoom, addPlayer, removePlayer,
  getPlayerNames, getScoreboard, resetAnswers,
} from './gameState.js';
import { getRoundData, getYesNoResults, debateTopics, spectrumStatements } from './rounds.js';

function getLanIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return 'localhost';
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// Single room created on startup
const ROOM_CODE = createRoom();
console.log(`Room code: ${ROOM_CODE}`);

// Serve built Svelte app in production
const distPath = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(distPath));

// Room code endpoint
app.get('/api/room', (req, res) => {
  res.json({ code: ROOM_CODE });
});

// QR code endpoint — encodes the player join URL
app.get('/api/qr', async (req, res) => {
  const host = req.get('host') || '';
  const isLocalhost = host.startsWith('localhost') || host.startsWith('127.0.0.1');
  let joinUrl;
  if (!isLocalhost) {
    // Real domain (Railway, etc) — use the request host directly
    joinUrl = `${req.protocol}://${host}/#/play`;
  } else {
    // Local machine — swap localhost for LAN IP so phones can reach it
    // x-forwarded-port is set by the Vite dev proxy so phones get the right port
    const lanIP = getLanIP();
    const port = req.get('x-forwarded-port') || host.split(':')[1] || '80';
    joinUrl = `http://${lanIP}:${port}/#/play`;
  }
  try {
    const svg = await QRCode.toString(joinUrl, { type: 'svg' });
    res.type('svg').send(svg);
  } catch {
    res.status(500).send('QR generation failed');
  }
});

// Socket.io
io.on('connection', (socket) => {
  let currentName = null;

  // Host registers itself
  socket.on('join-host', () => {
    const room = getRoom(ROOM_CODE);
    room.host = socket.id;
    socket.join(ROOM_CODE);
    socket.emit('room-code', ROOM_CODE);
    socket.emit('player-list', getPlayerNames(ROOM_CODE));
  });

  // Player joins (allowed at any time)
  socket.on('join-room', ({ name }, callback) => {
    const room = getRoom(ROOM_CODE);
    if (!room) return callback({ error: 'Room not found' });
    const result = addPlayer(ROOM_CODE, name);
    if (!result) return callback({ error: 'Name already taken' });

    // If joining mid-round, mark as answered so they don't block the allAnswered check
    if (room.phase === 'question') {
      room.players[name].answered = true;
    }

    currentName = name;
    socket.playerName = name;
    socket.join(ROOM_CODE);
    callback({ ok: true });
    io.to(ROOM_CODE).emit('player-list', getPlayerNames(ROOM_CODE));

    // Sync late joiner to current game state
    if (room.phase !== 'lobby') {
      // During question/reveal, late joiners see a waiting screen instead of the question
      if (room.phase === 'question' || room.phase === 'reveal') {
        socket.emit('phase', 'waiting');
      } else {
        socket.emit('phase', room.phase);
      }
      if (room.phase === 'scoreboard') {
        socket.emit('scoreboard', getScoreboard(ROOM_CODE));
      }
      if (room.phase === 'spectrum' && room.spectrum) {
        const sp = room.spectrum;
        socket.emit('spectrum-state', {
          phase: sp.phase,
          totalPlayers: Object.keys(room.players).length,
          readyCount: Object.keys(sp.playerPicks).length,
          defendPool: sp.defendPool,
          usedSpeakers: sp.usedSpeakers,
          currentSpeaker: sp.currentSpeaker,
          currentStatement: sp.currentStatement,
          speakerValue: sp.phase === 'results' ? sp.speakerValue : null,
          guesses: sp.phase === 'results' ? sp.guesses : {},
          guessCount: Object.keys(sp.guesses).length,
          timeLeft: sp.timeLeft,
          scores: sp.phase === 'results' ? sp.roundScores : null,
        });
        // If in picking phase, give them statements
        if (sp.phase === 'picking') {
          if (!sp.playerStatements[name]) {
            sp.playerStatements[name] = pickRandom(spectrumStatements, 4);
          }
          socket.emit('spectrum-your-statements', sp.playerStatements[name]);
        }
      }
      if (room.phase === 'debate' && room.debate) {
        const d = room.debate;
        socket.emit('debate-state', {
          phase: d.phase,
          flipped: d.flipped,
          currentTopicIndex: d.currentTopicIndex,
          currentTopic: d.currentTopicIndex != null ? debateTopics[d.currentTopicIndex] : null,
          optedIn: d.optedIn,
          player1: d.player1,
          player2: d.player2,
          thumbsUp: d.thumbsUp,
          timeLeft: d.timeLeft,
          winner: d.winner || null,
        });
      }
    }
  });

  // Host starts the game — show title screen first
  socket.on('start-game', () => {
    const room = getRoom(ROOM_CODE);
    console.log('start-game received', { hasRoom: !!room, socketId: socket.id, host: room?.host, players: Object.keys(room?.players || {}) });
    if (!room || socket.id !== room.host) return;
    if (Object.keys(room.players).length < 1) return;
    room.phase = 'title1';
    io.to(ROOM_CODE).emit('phase', 'title1');
  });

  // Host starts stage 1 rounds (from title screen)
  socket.on('start-stage1', () => {
    const room = getRoom(ROOM_CODE);
    if (!room || socket.id !== room.host) return;
    room.round = 0;
    startRound();
  });

  // Host advances to next round
  socket.on('next-round', () => {
    const room = getRoom(ROOM_CODE);
    if (!room || socket.id !== room.host) return;
    room.round++;
    if (room.round >= room.totalRounds) {
      room.phase = 'title2';
      io.to(ROOM_CODE).emit('phase', 'title2');
      return;
    }
    startRound();
  });

  // Player submits yes/no answer
  socket.on('yesno-answer', ({ answer }) => {
    const room = getRoom(ROOM_CODE);
    if (!room || !currentName || room.phase !== 'question') return;
    const player = room.players[currentName];
    if (!player || player.answered) return;
    player.answered = true;
    player.answer = answer; // 'yes' or 'no'

    // Broadcast live results to everyone so host screen updates in real-time
    io.to(ROOM_CODE).emit('yesno-results', getYesNoResults(room));

    const allAnswered = Object.values(room.players).every(p => p.answered);
    if (allAnswered) {
      room.phase = 'reveal';
      io.to(ROOM_CODE).emit('phase', 'reveal');
    }
  });

  // Player sends a reason for their yes/no vote
  socket.on('yesno-reason', ({ reason }) => {
    if (!currentName || !reason?.trim()) return;
    const room = getRoom(ROOM_CODE);
    if (!room) return;
    const player = room.players[currentName];
    if (!player || !player.answered) return;
    io.to(ROOM_CODE).emit('yesno-reason', {
      name: currentName,
      answer: player.answer,
      reason: reason.trim(),
    });
  });

  // Host votes for a player's creative answer
  socket.on('vote', ({ playerName }) => {
    const room = getRoom(ROOM_CODE);
    if (!room) return;
    const player = room.players[playerName];
    if (player) player.score += 500;
    io.to(ROOM_CODE).emit('scoreboard', getScoreboard(ROOM_CODE));
  });

  // Host shows scoreboard
  socket.on('show-scoreboard', () => {
    const room = getRoom(ROOM_CODE);
    if (!room || socket.id !== room.host) return;
    room.phase = 'scoreboard';
    io.to(ROOM_CODE).emit('phase', 'scoreboard');
    io.to(ROOM_CODE).emit('scoreboard', getScoreboard(ROOM_CODE));
  });

  // Host skips directly to a specific stage
    socket.on('skip-to-stage', ({ stage }) => {
      const room = getRoom(ROOM_CODE);
      if (!room || socket.id !== room.host) return;

      if (stage === 'debate') {
        // Jump straight to debate (show title first)
        room.debate = {
          phase: 'title',
          flipped: [],
          currentTopicIndex: null,
          optedIn: [],
          player1: null,
          player2: null,
          thumbsUp: { player1: 0, player2: 0 },
          timeLeft: 0,
          timerInterval: null,
          winner: null,
        };
        room.phase = 'debate';
        io.to(ROOM_CODE).emit('phase', 'debate');
        const d = room.debate;
        io.to(ROOM_CODE).emit('debate-state', {
          phase: d.phase, flipped: d.flipped, currentTopicIndex: null,
          currentTopic: null, optedIn: d.optedIn, player1: null, player2: null,
          thumbsUp: d.thumbsUp, timeLeft: 0, winner: null,
        });
      }
      if (stage === 'spectrum') {
        room.spectrum = {
          phase: 'title',
          playerPicks: {},
          defendPool: [],
          usedSpeakers: [],
          currentSpeaker: null,
          currentStatement: null,
          speakerValue: null,
          guesses: {},
          timeLeft: 0,
          timerInterval: null,
          roundScores: null,
          playerStatements: {},
        };
        room.phase = 'spectrum';
        io.to(ROOM_CODE).emit('phase', 'spectrum');
        broadcastSpectrumState();
      }
    });

  // ── Stage 2: Debate Duel ──────────────────────────────

    function broadcastDebateState() {
      const room = getRoom(ROOM_CODE);
      if (!room || !room.debate) return;
      const d = room.debate;
      io.to(ROOM_CODE).emit('debate-state', {
        phase: d.phase,
        flipped: d.flipped,
        currentTopicIndex: d.currentTopicIndex,
        currentTopic: d.currentTopicIndex != null ? debateTopics[d.currentTopicIndex] : null,
        optedIn: d.optedIn,
        player1: d.player1,
        player2: d.player2,
        thumbsUp: d.thumbsUp,
        timeLeft: d.timeLeft,
        winner: d.winner || null,
      });
    }

    // Host starts Stage 2 (show title first)
    socket.on('debate-start', () => {
      const room = getRoom(ROOM_CODE);
      if (!room || socket.id !== room.host) return;
      room.debate = {
        phase: 'title',
        flipped: [],
        currentTopicIndex: null,
        optedIn: [],
        player1: null,
        player2: null,
        thumbsUp: { player1: 0, player2: 0 },
        timeLeft: 0,
        timerInterval: null,
        winner: null,
      };
      room.phase = 'debate';
      io.to(ROOM_CODE).emit('phase', 'debate');
      broadcastDebateState();
    });

    // Host moves from debate title screen to opt-in lobby
    socket.on('debate-start-lobby', () => {
      const room = getRoom(ROOM_CODE);
      if (!room || socket.id !== room.host || !room.debate) return;
      room.debate.phase = 'lobby';
      broadcastDebateState();
    });

    // Player opts in for the debate (happens first, before anything)
    socket.on('debate-opt-in', () => {
      const room = getRoom(ROOM_CODE);
      if (!room || !currentName || !room.debate) return;
      if (room.debate.phase !== 'lobby') return;
      if (!room.debate.optedIn.includes(currentName)) {
        room.debate.optedIn.push(currentName);
        broadcastDebateState();
      }
    });

    // Host picks 2 random players from opt-in (before topic selection)
    socket.on('debate-start-match', () => {
      const room = getRoom(ROOM_CODE);
      if (!room || socket.id !== room.host || !room.debate) return;
      if (room.debate.optedIn.length < 2) return;

      const pool = [...room.debate.optedIn];
      const i1 = Math.floor(Math.random() * pool.length);
      const name1 = pool.splice(i1, 1)[0];
      const i2 = Math.floor(Math.random() * pool.length);
      const name2 = pool[i2];

      room.debate.player1 = { name: name1, stance: null, side: 'PRO' };
      room.debate.player2 = { name: name2, stance: null, side: 'CON' };
      room.debate.phase = 'match';
      broadcastDebateState();
    });

    // Host moves to the grid to pick a topic (after players are matched)
    socket.on('debate-show-grid', () => {
      const room = getRoom(ROOM_CODE);
      if (!room || socket.id !== room.host || !room.debate) return;
      if (!room.debate.player1 || !room.debate.player2) return;
      room.debate.phase = 'grid';
      broadcastDebateState();
    });

    // Host picks a tile — assigns topic to the already-matched players
    socket.on('debate-pick-topic', ({ index }) => {
      const room = getRoom(ROOM_CODE);
      if (!room || socket.id !== room.host || !room.debate) return;
      if (room.debate.flipped.includes(index)) return;
      if (index < 0 || index >= debateTopics.length) return;
      if (!room.debate.player1 || !room.debate.player2) return;

      const topic = debateTopics[index];
      room.debate.currentTopicIndex = index;
      room.debate.player1.stance = topic.pro;
      room.debate.player2.stance = topic.con;
      room.debate.thumbsUp = { player1: 0, player2: 0 };
      room.debate.winner = null;
      room.debate.phase = 'armed';
      broadcastDebateState();
    });

    // Host begins the 3-minute duel timer
    socket.on('debate-begin-duel', () => {
      const room = getRoom(ROOM_CODE);
      if (!room || socket.id !== room.host || !room.debate) return;
      if (room.debate.phase !== 'armed') return;

      room.debate.phase = 'duel';
      room.debate.timeLeft = 180;
      room.debate.thumbsUp = { player1: 0, player2: 0 };
      broadcastDebateState();

      if (room.debate.timerInterval) clearInterval(room.debate.timerInterval);

      room.debate.timerInterval = setInterval(() => {
        room.debate.timeLeft--;
        io.to(ROOM_CODE).emit('debate-timer', room.debate.timeLeft);
        if (room.debate.timeLeft <= 0) {
          clearInterval(room.debate.timerInterval);
          room.debate.timerInterval = null;
          finishDuel(room);
        }
      }, 1000);
    });

    // Audience sends a thumbs-up for a debater (spammable, lightweight)
    socket.on('debate-thumbsup', ({ side }) => {
      const room = getRoom(ROOM_CODE);
      if (!room || !currentName || !room.debate) return;
      if (room.debate.phase !== 'duel') return;
      // Debaters can't vote for themselves
      if (currentName === room.debate.player1?.name || currentName === room.debate.player2?.name) return;
      if (side !== 'player1' && side !== 'player2') return;
      room.debate.thumbsUp[side]++;
      // Lightweight broadcast — just the animation trigger, no full state
      io.to(ROOM_CODE).emit('debate-thumbsup-anim', { side });
    });

    // Host finishes the duel early (stops timer, shows results)
    socket.on('debate-finish', () => {
      const room = getRoom(ROOM_CODE);
      if (!room || socket.id !== room.host || !room.debate) return;
      if (room.debate.phase !== 'duel') return;
      if (room.debate.timerInterval) {
        clearInterval(room.debate.timerInterval);
        room.debate.timerInterval = null;
      }
      finishDuel(room);
    });

    // Calculate winner from thumbs-up counts and award points
    function finishDuel(room) {
      const t1 = room.debate.thumbsUp.player1;
      const t2 = room.debate.thumbsUp.player2;
      if (t1 > t2) {
        room.debate.winner = room.debate.player1.name;
        if (room.players[room.debate.player1.name]) room.players[room.debate.player1.name].score += 1000;
      } else if (t2 > t1) {
        room.debate.winner = room.debate.player2.name;
        if (room.players[room.debate.player2.name]) room.players[room.debate.player2.name].score += 1000;
      } else {
        room.debate.winner = 'TIE';
        if (room.players[room.debate.player1.name]) room.players[room.debate.player1.name].score += 500;
        if (room.players[room.debate.player2.name]) room.players[room.debate.player2.name].score += 500;
      }
      room.debate.phase = 'result';
      broadcastDebateState();
      io.to(ROOM_CODE).emit('scoreboard', getScoreboard(ROOM_CODE));
    }

    // NEW PLAYERS — flip tile, reset all, back to lobby for fresh opt-in
    socket.on('debate-new-players', () => {
      const room = getRoom(ROOM_CODE);
      if (!room || socket.id !== room.host || !room.debate) return;

      // Flip the used tile
      if (room.debate.currentTopicIndex != null && !room.debate.flipped.includes(room.debate.currentTopicIndex)) {
        room.debate.flipped.push(room.debate.currentTopicIndex);
      }

      room.debate.currentTopicIndex = null;
      room.debate.player1 = null;
      room.debate.player2 = null;
      room.debate.thumbsUp = { player1: 0, player2: 0 };
      room.debate.winner = null;
      room.debate.optedIn = [];
      room.debate.phase = 'lobby';

      if (room.debate.flipped.length >= debateTopics.length) {
        room.phase = 'gameover';
        io.to(ROOM_CODE).emit('phase', 'gameover');
        io.to(ROOM_CODE).emit('scoreboard', getScoreboard(ROOM_CODE));
        return;
      }
      broadcastDebateState();
    });

    // NEW TOPIC — flip tile, keep same players, back to grid to pick another topic
    socket.on('debate-new-topic', () => {
      const room = getRoom(ROOM_CODE);
      if (!room || socket.id !== room.host || !room.debate) return;

      // Flip the used tile
      if (room.debate.currentTopicIndex != null && !room.debate.flipped.includes(room.debate.currentTopicIndex)) {
        room.debate.flipped.push(room.debate.currentTopicIndex);
      }

      room.debate.currentTopicIndex = null;
      room.debate.player1.stance = null;
      room.debate.player2.stance = null;
      room.debate.thumbsUp = { player1: 0, player2: 0 };
      room.debate.winner = null;
      room.debate.phase = 'grid';

      if (room.debate.flipped.length >= debateTopics.length) {
        room.phase = 'gameover';
        io.to(ROOM_CODE).emit('phase', 'gameover');
        io.to(ROOM_CODE).emit('scoreboard', getScoreboard(ROOM_CODE));
        return;
      }
      broadcastDebateState();
    });

    // ── End Stage 2 ─────────────────────────────────────

    // ── Stage 3: The Spectrum ─────────────────────────────
    function broadcastSpectrumState() {
      const room = getRoom(ROOM_CODE);
      if (!room || !room.spectrum) return;
      const s = room.spectrum;
      io.to(ROOM_CODE).emit('spectrum-state', {
        phase: s.phase,
        totalPlayers: Object.keys(room.players).length,
        readyCount: Object.keys(s.playerPicks).length,
        defendPool: s.defendPool,
        usedSpeakers: s.usedSpeakers,
        currentSpeaker: s.currentSpeaker,
        currentStatement: s.currentStatement,
        speakerValue: s.phase === 'results' ? s.speakerValue : null,
        guesses: s.phase === 'results' ? s.guesses : {},
        guessCount: Object.keys(s.guesses).length,
        timeLeft: s.timeLeft,
        scores: s.phase === 'results' ? s.roundScores : null,
      });
    }

    // Helper: pick N random unique items from array
    function pickRandom(arr, n) {
      const shuffled = [...arr].sort(() => Math.random() - 0.5);
      return shuffled.slice(0, n);
    }

    // Host starts Stage 3
    socket.on('spectrum-start', () => {
      const room = getRoom(ROOM_CODE);
      if (!room || socket.id !== room.host) return;
      room.spectrum = {
        phase: 'title',
        playerPicks: {},
        defendPool: [],
        usedSpeakers: [],
        currentSpeaker: null,
        currentStatement: null,
        speakerValue: null,
        guesses: {},
        timeLeft: 0,
        timerInterval: null,
        roundScores: null,
        // Each player gets their own random set of 4 statements
        playerStatements: {},
      };
      room.phase = 'spectrum';
      io.to(ROOM_CODE).emit('phase', 'spectrum');
      broadcastSpectrumState();
    });

    // Host moves from title to picking phase
    socket.on('spectrum-start-picking', () => {
      const room = getRoom(ROOM_CODE);
      if (!room || socket.id !== room.host || !room.spectrum) return;
      room.spectrum.phase = 'picking';
      room.spectrum.playerPicks = {};
      room.spectrum.defendPool = [];
      room.spectrum.guesses = {};
      room.spectrum.currentSpeaker = null;
      room.spectrum.currentStatement = null;
      room.spectrum.speakerValue = null;
      room.spectrum.roundScores = null;
      // Generate 4 random statements per player
      room.spectrum.playerStatements = {};
      for (const name of Object.keys(room.players)) {
        room.spectrum.playerStatements[name] = pickRandom(spectrumStatements, 4);
      }
      broadcastSpectrumState();
      // Send each player their personal statements
      for (const [id, sock] of io.of('/').sockets) {
        if (sock.playerName && room.spectrum.playerStatements[sock.playerName]) {
          sock.emit('spectrum-your-statements', room.spectrum.playerStatements[sock.playerName]);
        }
      }
    });

    // Player rerolls for new statements
    socket.on('spectrum-reroll', () => {
      const room = getRoom(ROOM_CODE);
      if (!room || !currentName || !room.spectrum) return;
      if (room.spectrum.phase !== 'picking') return;
      if (room.spectrum.playerPicks[currentName]) return; // already submitted
      const newStatements = pickRandom(spectrumStatements, 4);
      room.spectrum.playerStatements[currentName] = newStatements;
      socket.emit('spectrum-your-statements', newStatements);
    });

    // Player submits their pick: chosen statement + slider value
    socket.on('spectrum-submit', ({ statement, value }) => {
      const room = getRoom(ROOM_CODE);
      if (!room || !currentName || !room.spectrum) return;
      if (room.spectrum.phase !== 'picking') return;
      if (room.spectrum.playerPicks[currentName]) return; // already submitted
      if (typeof value !== 'number' || value < 0 || value > 100) return;
      room.spectrum.playerPicks[currentName] = { statement, value, willDefend: null };
      broadcastSpectrumState();
    });

    // Player opts in/out to defend
    socket.on('spectrum-defend', ({ willDefend }) => {
      const room = getRoom(ROOM_CODE);
      if (!room || !currentName || !room.spectrum) return;
      if (room.spectrum.phase !== 'picking') return;
      const pick = room.spectrum.playerPicks[currentName];
      if (!pick || pick.willDefend !== null) return; // no pick yet or already decided
      pick.willDefend = !!willDefend;
      if (willDefend) {
        room.spectrum.defendPool.push(currentName);
      }
      broadcastSpectrumState();
    });

    // Host continues after all players are done — reveal first speaker
    socket.on('spectrum-continue', () => {
      const room = getRoom(ROOM_CODE);
      if (!room || socket.id !== room.host || !room.spectrum) return;
      if (room.spectrum.phase !== 'picking') return;
      pickNextSpeaker(room);
    });

    function pickNextSpeaker(room) {
      const s = room.spectrum;
      // Find someone from the defend pool who hasn't spoken yet
      const available = s.defendPool.filter(n => !s.usedSpeakers.includes(n));
      if (available.length === 0) {
        // All speakers done
        s.phase = 'done';
        broadcastSpectrumState();
        io.to(ROOM_CODE).emit('scoreboard', getScoreboard(ROOM_CODE));
        return;
      }
      const speaker = available[Math.floor(Math.random() * available.length)];
      s.currentSpeaker = speaker;
      s.currentStatement = s.playerPicks[speaker].statement;
      s.speakerValue = s.playerPicks[speaker].value;
      s.guesses = {};
      s.roundScores = null;
      s.phase = 'speaker-reveal';
      broadcastSpectrumState();
    }

    // Host starts the 3-minute guessing timer
    socket.on('spectrum-start-timer', () => {
      const room = getRoom(ROOM_CODE);
      if (!room || socket.id !== room.host || !room.spectrum) return;
      if (room.spectrum.phase !== 'speaker-reveal') return;
      const s = room.spectrum;
      s.phase = 'guessing';
      s.timeLeft = 180;
      broadcastSpectrumState();

      if (s.timerInterval) clearInterval(s.timerInterval);
      s.timerInterval = setInterval(() => {
        s.timeLeft--;
        io.to(ROOM_CODE).emit('spectrum-timer', s.timeLeft);
        if (s.timeLeft <= 0) {
          clearInterval(s.timerInterval);
          s.timerInterval = null;
          finishSpectrumRound(room);
        }
      }, 1000);
    });

    // Player submits their guess
    socket.on('spectrum-guess', ({ value }) => {
      const room = getRoom(ROOM_CODE);
      if (!room || !currentName || !room.spectrum) return;
      if (room.spectrum.phase !== 'guessing') return;
      if (currentName === room.spectrum.currentSpeaker) return; // speaker can't guess
      if (room.spectrum.guesses[currentName] !== undefined) return; // already guessed
      if (typeof value !== 'number' || value < 0 || value > 100) return;
      room.spectrum.guesses[currentName] = value;
      broadcastSpectrumState();
    });

    // Host reveals early
    socket.on('spectrum-reveal', () => {
      const room = getRoom(ROOM_CODE);
      if (!room || socket.id !== room.host || !room.spectrum) return;
      if (room.spectrum.phase !== 'guessing') return;
      if (room.spectrum.timerInterval) {
        clearInterval(room.spectrum.timerInterval);
        room.spectrum.timerInterval = null;
      }
      finishSpectrumRound(room);
    });

    function finishSpectrumRound(room) {
      const s = room.spectrum;
      const speakerVal = s.speakerValue;
      const scores = {};
      // Calculate distance-based points: max 1000 pts, lose 10 per % off
      for (const [name, guess] of Object.entries(s.guesses)) {
        const distance = Math.abs(guess - speakerVal);
        const pts = Math.max(0, 1000 - distance * 10);
        scores[name] = { guess, distance, points: pts, perfect: distance === 0 };
        if (room.players[name]) {
          room.players[name].score += pts;
        }
      }
      s.usedSpeakers.push(s.currentSpeaker);
      s.roundScores = scores;
      s.phase = 'results';
      broadcastSpectrumState();
      io.to(ROOM_CODE).emit('scoreboard', getScoreboard(ROOM_CODE));
    }

    // Host picks next speaker
    socket.on('spectrum-next-speaker', () => {
      const room = getRoom(ROOM_CODE);
      if (!room || socket.id !== room.host || !room.spectrum) return;
      if (room.spectrum.phase !== 'results') return;
      pickNextSpeaker(room);
    });

    // Host ends spectrum stage
    socket.on('spectrum-end', () => {
      const room = getRoom(ROOM_CODE);
      if (!room || socket.id !== room.host || !room.spectrum) return;
      room.phase = 'gameover';
      io.to(ROOM_CODE).emit('phase', 'gameover');
      io.to(ROOM_CODE).emit('scoreboard', getScoreboard(ROOM_CODE));
    });

    // ── End Stage 3 ──────────────────────────────────────

  socket.on('disconnect', () => {
    if (currentName) {
      removePlayer(ROOM_CODE, currentName);
      io.to(ROOM_CODE).emit('player-list', getPlayerNames(ROOM_CODE));
    }
  });
});

function startRound() {
  const room = getRoom(ROOM_CODE);
  if (!room) return;
  resetAnswers(ROOM_CODE);
  const roundData = getRoundData(room.round);
  room.currentQuestion = roundData;
  room.phase = 'question';
  // Reset live results and reasons for the new question
  io.to(ROOM_CODE).emit('yesno-results', { yes: [], no: [] });
  io.to(ROOM_CODE).emit('yesno-reasons-reset');
  io.to(ROOM_CODE).emit('phase', 'question');
  io.to(ROOM_CODE).emit('round-data', { round: room.round + 1, total: room.totalRounds, ...roundData });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Party Blitz running on port ${PORT}`);
});
