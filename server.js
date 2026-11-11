const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;
const waiting = [];
const matches = new Map();

app.use(express.static(path.join(__dirname, 'public')));
app.get('/health', (_req, res) => res.json({ ok: true }));

function removeFromQueue(socket) {
  const index = waiting.indexOf(socket);
  if (index !== -1) waiting.splice(index, 1);
}

function pairPlayers() {
  while (waiting.length >= 2) {
    const first = waiting.shift();
    const second = waiting.shift();
    if (!first.connected || !second.connected) continue;
    const room = `match-${first.id}-${second.id}`;
    const match = { room, players: [first.id, second.id], ended: false };
    matches.set(room, match);
    first.join(room);
    second.join(room);
    const startAt = Date.now() + 2500;
    io.to(room).emit('match-found', {
      room,
      startAt,
      players: [
        { id: first.id, name: first.data.name || 'Player 1' },
        { id: second.id, name: second.data.name || 'Player 2' }
      ]
    });
  }
}

io.on('connection', (socket) => {
  socket.on('find-match', (name) => {
    removeFromQueue(socket);
    socket.data.name = String(name || 'Player').trim().slice(0, 16) || 'Player';
    socket.emit('queue-status', { position: waiting.length + 1 });
    waiting.push(socket);
    pairPlayers();
  });

  socket.on('cancel-match', () => {
    removeFromQueue(socket);
    socket.emit('queue-cancelled');
  });

  socket.on('board-update', (payload) => {
    const match = matches.get(payload?.room);
    if (!match || match.ended || !match.players.includes(socket.id)) return;
    socket.to(match.room).emit('opponent-board', {
      board: payload.board,
      score: payload.score,
      lines: payload.lines,
      level: payload.level
    });
  });

  socket.on('game-over', (room) => {
    const match = matches.get(room);
    if (!match || match.ended || !match.players.includes(socket.id)) return;
    match.ended = true;
    const winnerId = match.players.find((id) => id !== socket.id);
    io.to(match.room).emit('match-over', { winnerId, loserId: socket.id });
  });

  socket.on('leave-match', (room) => {
    const match = matches.get(room);
    if (!match || !match.players.includes(socket.id)) return;
    socket.leave(room);
    if (!match.ended) {
      match.ended = true;
      io.to(match.room).emit('opponent-left', { id: socket.id });
    }
    matches.delete(room);
  });

  socket.on('disconnect', () => {
    removeFromQueue(socket);
    for (const [room, match] of matches) {
      if (match.players.includes(socket.id)) {
        if (!match.ended) io.to(room).emit('opponent-left', { id: socket.id });
        matches.delete(room);
      }
    }
  });
});

server.listen(PORT, '0.0.0.0', () => console.log(`Duo Tetris listening on ${PORT}`));
