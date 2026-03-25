const rooms = {};

// ── Session persistence ──────────────────────────────
// Maps sessionID -> { name, isAdmin }
const sessions = {};

export function createSession(name, isAdmin = false) {
  const id = generateSessionId();
  sessions[id] = { name, isAdmin };
  return id;
}

export function getSession(id) {
  return sessions[id] || null;
}

export function updateSession(id, data) {
  if (sessions[id]) Object.assign(sessions[id], data);
}

export function deleteSession(id) {
  delete sessions[id];
}

export function findSessionByName(name) {
  for (const [id, data] of Object.entries(sessions)) {
    if (data.name === name) return { id, ...data };
  }
  return null;
}

function generateSessionId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 24; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  if (sessions[id]) return generateSessionId();
  return id;
}

// ── Admin state ──────────────────────────────────────
let activeAdminSocketId = null;
let activeAdminSessionId = null;

export function getActiveAdmin() {
  return { socketId: activeAdminSocketId, sessionId: activeAdminSessionId };
}

export function setActiveAdmin(socketId, sessionId) {
  activeAdminSocketId = socketId;
  activeAdminSessionId = sessionId;
}

export function clearActiveAdmin() {
  activeAdminSocketId = null;
  activeAdminSessionId = null;
}

export function isAdminSocket(socketId) {
  return activeAdminSocketId === socketId;
}

// ── Rooms ────────────────────────────────────────────

export function createRoom() {
  const code = generateCode();
  rooms[code] = {
    players: {},
    phase: 'lobby',
    round: 0,
    totalRounds: 11,
    currentQuestion: null,
    host: null,
  };
  return code;
}

export function getRoom(code) {
  return rooms[code] || null;
}

export function deleteRoom(code) {
  delete rooms[code];
}

export function addPlayer(code, name) {
  const room = rooms[code];
  if (!room) return null;
  // If the player already exists and is disconnected, let them rejoin (keep score)
  if (room.players[name]) {
    if (room.players[name].disconnected) {
      room.players[name].disconnected = false;
      return room;
    }
    return null; // Name taken by an active player
  }
  room.players[name] = { score: 0, answered: false, answer: null, disconnected: false };
  return room;
}

export function removePlayer(code, name) {
  const room = rooms[code];
  if (!room || !room.players[name]) return;
  // Don't delete — mark as disconnected so they can rejoin and keep their score
  room.players[name].disconnected = true;
}

export function getActivePlayerNames(code) {
  const room = rooms[code];
  if (!room) return [];
  return Object.entries(room.players)
    .filter(([, data]) => !data.disconnected)
    .map(([name]) => name);
}

export function getPlayerNames(code) {
  const room = rooms[code];
  if (!room) return [];
  return Object.keys(room.players);
}

export function getScoreboard(code) {
  const room = rooms[code];
  if (!room) return [];
  // Include all players (even disconnected) so their scores are preserved on the board
  return Object.entries(room.players)
    .map(([name, data]) => ({ name, score: data.score, disconnected: !!data.disconnected }))
    .sort((a, b) => b.score - a.score);
}

export function resetAnswers(code) {
  const room = rooms[code];
  if (!room) return;
  for (const player of Object.values(room.players)) {
    player.answered = false;
    player.answer = null;
  }
}

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  if (rooms[code]) return generateCode();
  return code;
}
