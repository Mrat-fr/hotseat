const rooms = {};

export function createRoom() {
  const code = generateCode();
  rooms[code] = {
    players: {},
    phase: 'lobby',
    round: 0,
    totalRounds: 5,
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
  if (room.players[name]) return null;
  room.players[name] = { score: 0, answered: false, answer: null };
  return room;
}

export function removePlayer(code, name) {
  const room = rooms[code];
  if (!room) return;
  delete room.players[name];
}

export function getPlayerNames(code) {
  const room = rooms[code];
  if (!room) return [];
  return Object.keys(room.players);
}

export function getScoreboard(code) {
  const room = rooms[code];
  if (!room) return [];
  return Object.entries(room.players)
    .map(([name, data]) => ({ name, score: data.score }))
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
