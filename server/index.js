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
import { getRoundData, getYesNoResults, debateTopics } from './rounds.js';

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
      // Add more stages here as they're built
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
