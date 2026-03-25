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
import { getRoundData, getYesNoResults } from './rounds.js';

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
      socket.emit('phase', room.phase);
      if (room.currentQuestion) {
        socket.emit('round-data', { round: room.round + 1, total: room.totalRounds, ...room.currentQuestion });
      }
      if (room.phase === 'question' || room.phase === 'reveal') {
        socket.emit('yesno-results', getYesNoResults(room));
      }
      if (room.phase === 'scoreboard' || room.phase === 'gameover') {
        socket.emit('scoreboard', getScoreboard(ROOM_CODE));
      }
    }
  });

  // Host starts the game
  socket.on('start-game', () => {
    const room = getRoom(ROOM_CODE);
    if (!room || socket.id !== room.host) return;
    if (Object.keys(room.players).length < 1) return;
    room.round = 0;
    startRound();
  });

  // Host advances to next round
  socket.on('next-round', () => {
    const room = getRoom(ROOM_CODE);
    if (!room || socket.id !== room.host) return;
    room.round++;
    if (room.round >= room.totalRounds) {
      room.phase = 'gameover';
      io.to(ROOM_CODE).emit('phase', 'gameover');
      io.to(ROOM_CODE).emit('scoreboard', getScoreboard(ROOM_CODE));
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
