import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";

// HTTP + Socket.IO setup
const app = express();
app.use(cors());

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173", // Vite dev server
    methods: ["GET", "POST"]
  }
});

// In-memory room state
// rooms[roomId] = {
//   players: [socketId, socketId],
//   puzzleState: {...},        // e.g., which holes filled
//   objects: {...}             // e.g., blocks positions (later)
// }
const rooms = {};

function createRoomId() {
  // 5-character room code, e.g. "a9xk3"
  return Math.random().toString(36).slice(2, 7);
}

// Helper: find which room a socket is in
function findRoomOfSocket(socketId) {
  for (const [roomId, room] of Object.entries(rooms)) {
    if (room.players.includes(socketId)) return roomId;
  }
  return null;
}

// Socket.IO connection logic
io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);

  // Create game (host)
  socket.on("createGame", () => {
    const roomId = createRoomId();

    rooms[roomId] = {
        players: [socket.id],
        puzzleState: { level: 1 },
        world: {
            spawnPoints: {
            host: { x: -2, y: 0.5, z: 0 },
            client: { x:  2, y: 0.5, z: 0 },
            },
            blocks: {
            "block_1": { x: 0, y: 0.5, z: -2 },
            "block_2": { x: 3, y: 0.5, z: -1 },
            },
            holes: {
            "hole_A": { x: 0, z: -4, filled: false },
            "hole_B": { x: 4, z: -3, filled: false },
            },
        },
    };

    console.log("ROOM CREATED", roomId, "by", socket.id);
    console.log("ROOM STATE:", rooms[roomId]);


    socket.join(roomId);
    console.log(`Room created: ${roomId} by ${socket.id}`);

    socket.emit("gameCreated", {
      roomId,
      playerId: socket.id,
      role: "host"
    });
  });

  // Join existing game
  socket.on("joinGame", ({ roomId }) => {
    const room = rooms[roomId];

    console.log("JOIN REQUEST to", roomId, "by", socket.id);

    if (!room) {
      socket.emit("joinError", { message: "Room not found" });
      return;
    }

    if (room.players.length >= 2) {
      socket.emit("joinError", { message: "Room is full" });
      return;
    }

    room.players.push(socket.id);
    socket.join(roomId);

    console.log(`Player ${socket.id} joined room ${roomId}`);
    console.log("ROOM PLAYERS after join:", room.players);

    // notify both players
    io.to(roomId).emit("playerJoined", {
      roomId,
      players: room.players,
      hostId: room.players[0],
      clientId: room.players[1] ?? null,
    });

    // send current room state to the new player
    socket.emit("roomState", {
      puzzleState: room.puzzleState,
      world: room.world,
    });
  });

  // Player movement (x, y, z)
  socket.on("playerMove", ({ roomId, position }) => {
    // Forward movement to the *other* player in the same room
    socket.to(roomId).emit("remotePlayerMove", {
      id: socket.id,
      position
    });
  });

  // Object / Block updates (you'll use this later for puzzles)
  socket.on("objectUpdate", ({ roomId, objectId, state }) => {
    const room = rooms[roomId];
    if (!room) return;

    // store server-authoritative state
    room.objects[objectId] = state;

    // broadcast to other clients
    socket.to(roomId).emit("objectUpdated", { objectId, state });
  });

  // Puzzle state updates (e.g., hole filled, puzzle completed)
  socket.on("puzzleUpdate", ({ roomId, puzzleState }) => {
    const room = rooms[roomId];
    if (!room) return;

    room.puzzleState = {
      ...room.puzzleState,
      ...puzzleState
    };

    io.to(roomId).emit("puzzleStateChanged", room.puzzleState);
  });

  // Handle disconnect
  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);

    const roomId = findRoomOfSocket(socket.id);
    if (!roomId) return;

    const room = rooms[roomId];
    const wasHost = room.players[0] === socket.id;

    // remove player from room array
    room.players = room.players.filter((id) => id !== socket.id);

    console.log("ROOM PLAYERS after disconnect:", room.players);

    if (wasHost) {
      // Host left -> close room for everyone
      io.to(roomId).emit("roomClosed", { roomId });
      delete rooms[roomId];
      console.log(`Room ${roomId} closed because host left`);
      return;
    }

    if (room.players.length === 0) {
      console.log(`Deleting empty room ${roomId}`);
      delete rooms[roomId];
    } else {
      // Tell remaining players that someone left + send updated players list
      io.to(roomId).emit("playerLeft", {
        roomId,
        leftPlayerId: socket.id,
        players: room.players,
      });
    }
  });

});


// Start server
const PORT = 3000;
httpServer.listen(PORT, () => {
  console.log(`Socket.IO server running on http://localhost:${PORT}`);
});
