import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import QRCode from 'qrcode';

function getLanIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return 'localhost';
}
import {
  createRoom, getRoom, addPlayer, removePlayer,
  getPlayerNames, getScoreboard, resetAnswers, deleteRoom,
} from './gameState.js';
import { getRoundData, scoreTrivia } from './rounds.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
});

// Serve built Svelte app in production
const distPath = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(distPath));

// QR code endpoint
app.get('/api/qr/:code', async (req, res) => {
  const { code } = req.params;
  let joinUrl;
  if (process.env.NODE_ENV === 'production') {
    joinUrl = `${req.protocol}://${req.get('host')}/#/play/${code}`;
  } else {
    const lanIP = getLanIP();
    joinUrl = `http://${lanIP}:5173/#/play/${code}`;
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
  let currentRoom = null;
  let currentName = null;

  // Host creates a room
  socket.on('create-room', (callback) => {
    const code = createRoom();
    const room = getRoom(code);
    room.host = socket.id;
    currentRoom = code;
    socket.join(code);
    callback({ code });
  });

  // Player joins a room
  socket.on('join-room', ({ code, name }, callback) => {
    const room = getRoom(code);
    if (!room) return callback({ error: 'Room not found' });
    if (room.phase !== 'lobby') return callback({ error: 'Game already started' });
    const result = addPlayer(code, name);
    if (!result) return callback({ error: 'Name taken or room not found' });

    currentRoom = code;
    currentName = name;
    socket.join(code);
    callback({ ok: true });

    // Notify everyone in the room
    io.to(code).emit('player-list', getPlayerNames(code));
  });

  // Host starts the game
  socket.on('start-game', () => {
    const room = getRoom(currentRoom);
    if (!room || socket.id !== room.host) return;
    if (Object.keys(room.players).length < 1) return;

    room.round = 0;
    startRound(currentRoom);
  });

  // Host advances to next round
  socket.on('next-round', () => {
    const room = getRoom(currentRoom);
    if (!room || socket.id !== room.host) return;

    room.round++;
    if (room.round >= room.totalRounds) {
      room.phase = 'gameover';
      io.to(currentRoom).emit('phase', 'gameover');
      io.to(currentRoom).emit('scoreboard', getScoreboard(currentRoom));
      return;
    }
    startRound(currentRoom);
  });

  // Player submits a trivia answer
  socket.on('trivia-answer', ({ answerIndex }) => {
    const room = getRoom(currentRoom);
    if (!room || !currentName) return;
    if (room.phase !== 'question') return;

    scoreTrivia(room, currentName, answerIndex, room.currentQuestion.correctIndex);

    // Check if all players answered
    const allAnswered = Object.values(room.players).every(p => p.answered);
    if (allAnswered) {
      revealAnswer(currentRoom);
    }
  });

  // Player submits a creative/draw answer
  socket.on('submit-answer', ({ answer }) => {
    const room = getRoom(currentRoom);
    if (!room || !currentName) return;

    const player = room.players[currentName];
    if (!player || player.answered) return;
    player.answered = true;
    player.answer = answer;

    const allAnswered = Object.values(room.players).every(p => p.answered);
    if (allAnswered) {
      // Send all answers to host for voting/display
      const answers = Object.entries(room.players).map(([name, p]) => ({
        name,
        answer: p.answer,
      }));
      room.phase = 'reveal';
      io.to(currentRoom).emit('phase', 'reveal');
      io.to(currentRoom).emit('answers', answers);
    }
  });

  // Host triggers vote for a creative answer
  socket.on('vote', ({ playerName }) => {
    const room = getRoom(currentRoom);
    if (!room) return;
    const player = room.players[playerName];
    if (player) {
      player.score += 500;
    }
    io.to(currentRoom).emit('scoreboard', getScoreboard(currentRoom));
  });

  // Show scoreboard between rounds
  socket.on('show-scoreboard', () => {
    const room = getRoom(currentRoom);
    if (!room || socket.id !== room.host) return;
    room.phase = 'scoreboard';
    io.to(currentRoom).emit('phase', 'scoreboard');
    io.to(currentRoom).emit('scoreboard', getScoreboard(currentRoom));
  });

  socket.on('disconnect', () => {
    if (currentRoom && currentName) {
      removePlayer(currentRoom, currentName);
      io.to(currentRoom).emit('player-list', getPlayerNames(currentRoom));
    }
    // If host disconnects, clean up
    const room = getRoom(currentRoom);
    if (room && room.host === socket.id) {
      io.to(currentRoom).emit('phase', 'ended');
      deleteRoom(currentRoom);
    }
  });
});

function startRound(code) {
  const room = getRoom(code);
  if (!room) return;

  resetAnswers(code);
  const roundData = getRoundData(room.round);
  room.currentQuestion = roundData;
  room.phase = 'question';

  // Send round info (hide correct answer from players)
  const clientData = { ...roundData };
  delete clientData.correctIndex;

  io.to(code).emit('phase', 'question');
  io.to(code).emit('round-data', { round: room.round + 1, total: room.totalRounds, ...clientData });
}

function revealAnswer(code) {
  const room = getRoom(code);
  if (!room) return;

  room.phase = 'reveal';
  io.to(code).emit('phase', 'reveal');
  io.to(code).emit('reveal', {
    correctIndex: room.currentQuestion.correctIndex,
    scoreboard: getScoreboard(code),
  });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Party Blitz running on port ${PORT}`);
});
