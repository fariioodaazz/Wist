import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";

const app = express();
app.use(cors());

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

// ─────────────────────────────
// In-memory rooms
// ─────────────────────────────
const rooms = {};

function createRoomId() {
  return Math.random().toString(36).slice(2, 7);
}

// players is now { host: socketId|null, client: socketId|null }
function findRoomOfSocket(socketId) {
  for (const [roomId, room] of Object.entries(rooms)) {
    if (room.players.host === socketId) return roomId;
    if (room.players.client === socketId) return roomId;
  }
  return null;
}

// ─────────────────────────────
// Socket.IO connection
// ─────────────────────────────
io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);

  // ───────────── CREATE GAME (host) ─────────────
  socket.on("createGame", () => {
    const roomId = createRoomId();

    const world = {
      spawnPoints: {
        host: { x: -2, y: 3, z: 0 },
        client: { x: 2, y: 3, z: 0 },
      },
      blocks: {
        block_1: { x: 0, y: 0.5, z: -2 },
        block_2: { x: 3, y: 0.5, z: -1 },
      },
      holes: {
        hole_A: { x: 0, z: -4, filled: false },
        hole_B: { x: 4, z: -3, filled: false },
      },
    };

    rooms[roomId] = {
      players: {
        host: socket.id,
        client: null,
      },
      puzzleState: { level: 1, hostLevel: 1, clientLevel: 1, respawnToken: 0 },
      world,
      objects: { ...world.blocks },
      playerPositions: {
        host: null,
        client: null,
      },
    };

    socket.join(roomId);

    console.log("ROOM CREATED:", roomId, rooms[roomId]);

    // initial state → host only
    socket.emit("roomState", {
      world: rooms[roomId].world,
      puzzleState: rooms[roomId].puzzleState,
      objects: rooms[roomId].objects,
      playerPositions: rooms[roomId].playerPositions,
    });

    socket.emit("gameCreated", {
      roomId,
      playerId: socket.id,
      role: "host",
    });

    // also tell host explicitly its role (used later too)
    socket.emit("roleAssigned", { roomId, role: "host" });
  });

  // ───────────── JOIN GAME (client OR returning host) ─────────────
  socket.on("joinGame", ({ roomId }) => {
    const room = rooms[roomId];

    if (!room) {
      socket.emit("joinError", { message: "Room not found" });
      return;
    }

    let role = null;

    // If host slot free → this socket becomes host (returning host)
    if (room.players.host === null) {
      role = "host";
      room.players.host = socket.id;
    }
    // else if client slot free → this socket becomes client
    else if (room.players.client === null) {
      role = "client";
      room.players.client = socket.id;
    } else {
      socket.emit("joinError", { message: "Room is full" });
      return;
    }

    socket.join(roomId);
    console.log(`Socket ${socket.id} joined ${roomId} as ${role}`);

    // Tell this socket which role it has
    socket.emit("roleAssigned", { roomId, role });

    // Tell everyone the current players
    io.to(roomId).emit("playerJoined", {
      roomId,
      players: room.players,
    });

    // Send full state (world + progress) to everyone
    io.to(roomId).emit("roomState", {
      world: room.world,
      puzzleState: room.puzzleState,
      objects: room.objects,
      playerPositions: room.playerPositions,
    });
  });

  // ───────────── PLAYER MOVE ─────────────
  socket.on("playerMove", ({ roomId, position }) => {
    const room = rooms[roomId];
    if (!room) return;

    const identity = socket.id === room.players.host ? "host" : "client";

    room.playerPositions[identity] = position;

    socket.to(roomId).emit("remotePlayerMove", {
      id: socket.id,
      position,
    });
  });

  // ───────────── OBJECT / BLOCK UPDATE ─────────────
  socket.on("objectUpdate", ({ roomId, objectId, state }) => {
    const room = rooms[roomId];
    if (!room) return;

    room.objects[objectId] = {
      ...(room.objects[objectId] || {}),
      ...state,
    };

    socket.to(roomId).emit("objectUpdated", {
      objectId,
      state: room.objects[objectId],
    });
  });

  // ───────────── PUZZLE UPDATE ─────────────
  socket.on("puzzleUpdate", ({ roomId, puzzleState }) => {
    const room = rooms[roomId];
    if (!room) return;

    let role = null;
    if (socket.id === room.players.host) role = "host";
    else if (socket.id === room.players.client) role = "client";

    if (typeof puzzleState.levelReached === "number" && role) {
      if (role === "host")
        room.puzzleState.hostLevel = puzzleState.levelReached;
      else room.puzzleState.clientLevel = puzzleState.levelReached;

      const hostLevel = room.puzzleState.hostLevel || 1;
      const clientLevel = room.puzzleState.clientLevel || 1;

      // Shared room level is the LOWER (min) of both players
      room.puzzleState.level = Math.min(hostLevel, clientLevel);
    }

    if (typeof puzzleState.respawnToken !== "undefined") {
      room.puzzleState.respawnToken = puzzleState.respawnToken;
    }

    io.to(roomId).emit("puzzleStateChanged", room.puzzleState);
  });

  // ───────────── DISCONNECT (Option B) ─────────────
  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);

    const roomId = findRoomOfSocket(socket.id);
    if (!roomId) return;

    const room = rooms[roomId];
    let leftRole = null;

    if (room.players.host === socket.id) {
      leftRole = "host";
      room.players.host = null;
    } else if (room.players.client === socket.id) {
      leftRole = "client";
      room.players.client = null;
    }

    // 👇 DO NOT clear playerPositions here → progress is kept

    // If room empty → delete it
    if (!room.players.host && !room.players.client) {
      console.log(`Deleting empty room ${roomId}`);
      delete rooms[roomId];
      return;
    }

    // Otherwise just notify remaining players
    io.to(roomId).emit("playerLeft", {
      roomId,
      leftRole,
      players: room.players,
    });
  });
});

const PORT = 3000;
httpServer.listen(PORT, () => {
  console.log(`Socket.IO server running on http://localhost:${PORT}`);
});
