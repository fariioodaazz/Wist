import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import {
  acceptInvite,
  assignClientToGame,
  closeGame,
  createGameRecord,
  createUser,
  getGameByRoomId,
  getUserById,
  getUserByUsername,
  inviteUserToGame,
  listActiveGamesForUser,
  listInvitesForUser,
  updateGameLastLevel,
  updateGameState,
  verifyUser,
} from "./db.js";

const app = express();
app.use(express.json());
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
const userSockets = new Map();

function createRoomId() {
  return Math.random().toString(36).slice(2, 7);
}

function buildWorld() {
  return {
    spawnPoints: {
      host: { x: -1, y: 3, z: 0 },
      client: { x: 1, y: 3, z: 0 },
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
}

function buildDefaultPuzzleState(hostLevel = 1, clientLevel = 1) {
  return {
    level: Math.min(hostLevel, clientLevel),
    hostLevel,
    clientLevel,
    respawnToken: 0,
  };
}

function buildStateSnapshot(room) {
  return {
    world: room.world,
    puzzleState: room.puzzleState,
    objects: room.objects,
    playerPositions: room.playerPositions,
  };
}

function loadRoomFromDb(roomId) {
  const game = getGameByRoomId(roomId);
  if (!game || game.status === "closed" || game.deleted_at) return null;

  let state = null;
  if (game.state_json) {
    try {
      state = JSON.parse(game.state_json);
    } catch {
      state = null;
    }
  }

  const world = state?.world || buildWorld();
  const puzzleState =
    state?.puzzleState || buildDefaultPuzzleState(1, 1);
  const objects = state?.objects || { ...world.blocks };
  const playerPositions = state?.playerPositions || {
    host: null,
    client: null,
  };

  rooms[roomId] = {
    players: {
      host: null,
      client: null,
    },
    puzzleState,
    world,
    objects,
    playerPositions,
    hostUserId: game.host_user_id,
    clientUserId: game.client_user_id,
    invitedUserId: game.invited_user_id,
    status: game.status,
  };

  return rooms[roomId];
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
// ?"??"??"??"??"??"??"??"??"??"??"??"? API ?"??"??"??"??"??"??"??"??"??"??"??"?
app.post("/api/register", (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    res.status(400).json({ message: "Username and password required" });
    return;
  }

  try {
    const user = createUser({ username, password });
    res.json({
      id: user.id,
      username: user.username,
    });
  } catch (err) {
    const message =
      err && err.code === "SQLITE_CONSTRAINT_UNIQUE"
        ? "Username already exists"
        : "Failed to create user";
    res.status(409).json({ message });
  }
});

app.post("/api/login", (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    res.status(400).json({ message: "Username and password required" });
    return;
  }

  const user = verifyUser(username, password);
  if (!user) {
    res.status(401).json({ message: "Invalid credentials" });
    return;
  }

  res.json({
    id: user.id,
    username: user.username,
  });
});

app.get("/api/games", (req, res) => {
  const userId = Number(req.query.userId);
  if (!userId) {
    res.status(400).json({ message: "Missing userId" });
    return;
  }
  res.json({ games: listActiveGamesForUser(userId) });
});

app.get("/api/invites", (req, res) => {
  const userId = Number(req.query.userId);
  if (!userId) {
    res.status(400).json({ message: "Missing userId" });
    return;
  }
  res.json({ invites: listInvitesForUser(userId) });
});

app.post("/api/accept-invite", (req, res) => {
  const { userId, roomId } = req.body || {};
  if (!userId || !roomId) {
    res.status(400).json({ message: "Missing userId or roomId" });
    return;
  }

  const game = acceptInvite(roomId, userId);
  if (!game || game.status !== "active") {
    res.status(404).json({ message: "Invite not found" });
    return;
  }

  res.json({ roomId: game.room_id });
});

// Socket.IO connection
// ─────────────────────────────
io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);

  socket.on("identify", ({ userId }) => {
    if (!userId) return;
    const key = String(userId);
    if (!userSockets.has(key)) {
      userSockets.set(key, new Set());
    }
    userSockets.get(key).add(socket.id);
    socket.data.userId = userId;
  });

  // ───────────── CREATE GAME (host) ─────────────
  socket.on("createGame", ({ userId, inviteUsername } = {}) => {
    if (!userId) {
      socket.emit("createError", { message: "Login required" });
      return;
    }

    const hostUser = getUserById(userId);
    if (!hostUser) {
      socket.emit("createError", { message: "User not found" });
      return;
    }

    const invitedUserId = null;
    const status = "waiting";

    const roomId = createRoomId();
    const world = buildWorld();
    const puzzleState = buildDefaultPuzzleState(1, 1);
    const objects = { ...world.blocks };
    const playerPositions = {
      host: null,
      client: null,
    };

    rooms[roomId] = {
      players: {
        host: socket.id,
        client: null,
      },
      puzzleState,
      world,
      objects,
      playerPositions,
      hostUserId: hostUser.id,
      clientUserId: null,
      invitedUserId,
      status,
    };


    socket.join(roomId);
    socket.data.userId = hostUser.id;

    console.log("ROOM CREATED:", roomId, rooms[roomId]);

    createGameRecord({
      roomId,
      hostUserId: hostUser.id,
      invitedUserId,
      status,
      state: buildStateSnapshot(rooms[roomId]),
    });

    // initial state - host only
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

  socket.on("sendInvite", ({ roomId, inviteUsername, userId }) => {
    const room = rooms[roomId] || loadRoomFromDb(roomId);
    if (!room) {
      socket.emit("inviteError", { message: "Room not found" });
      return;
    }
    if (!userId || userId !== room.hostUserId) {
      socket.emit("inviteError", { message: "Only host can invite" });
      return;
    }
    if (!inviteUsername) {
      socket.emit("inviteError", { message: "Invite username required" });
      return;
    }
    if (room.status !== "waiting") {
      socket.emit("inviteError", { message: "Room already has an invite" });
      return;
    }

    const invited = getUserByUsername(inviteUsername);
    if (!invited) {
      socket.emit("inviteError", { message: "Invite username not found" });
      return;
    }

    const updated = inviteUserToGame(roomId, invited.id);
    if (!updated) {
      socket.emit("inviteError", { message: "Failed to send invite" });
      return;
    }

    room.invitedUserId = invited.id;
    room.status = "invited";
    socket.emit("inviteSent", {
      roomId,
      invitedUserId: invited.id,
      invitedUsername: invited.username,
    });

    const targetSockets = userSockets.get(String(invited.id));
    if (targetSockets) {
      for (const socketId of targetSockets) {
        io.to(socketId).emit("inviteReceived", {
          roomId,
          hostUserId: room.hostUserId,
          hostUsername: (getUserById(room.hostUserId) || {}).username,
        });
      }
    }
  });

  // JOIN GAME (client or returning host)
  socket.on("joinGame", ({ roomId, userId }) => {
    if (!userId) {
      socket.emit("joinError", { message: "Login required" });
      return;
    }

    let room = rooms[roomId];
    if (!room) {
      room = loadRoomFromDb(roomId);
    }

    if (!room) {
      socket.emit("joinError", { message: "Room not found" });
      return;
    }

    let game = getGameByRoomId(roomId);
    if (!game || game.status === "closed" || game.deleted_at) {
      socket.emit("joinError", { message: "Room is closed" });
      return;
    }

    if (game.status === "invited") {
      if (userId === game.invited_user_id) {
        game = acceptInvite(roomId, userId);
        room.clientUserId = userId;
        room.status = "active";
      } else if (userId !== game.host_user_id) {
        socket.emit("joinError", { message: "Invite only: code disabled" });
        return;
      }
    }

    if (userId !== game.host_user_id && userId !== game.client_user_id) {
      if (!game.client_user_id) {
        game = assignClientToGame(roomId, userId);
        room.clientUserId = userId;
      } else {
        socket.emit("joinError", { message: "You are not part of this game" });
        return;
      }
    }

    let role = null;

    // If this socket is already in the room, allow idempotent join
    if (room.players.host === socket.id) {
      role = "host";
    } else if (room.players.client === socket.id) {
      role = "client";
    }

    // Otherwise assign to a free slot if allowed
    if (!role) {
      if (room.players.host === null && userId === game.host_user_id) {
        role = "host";
        room.players.host = socket.id;
        room.hostUserId = userId;
      } else if (room.players.client === null && userId === game.client_user_id) {
        role = "client";
        room.players.client = socket.id;
        room.clientUserId = userId;
      } else {
        socket.emit("joinError", { message: "Room is full" });
        return;
      }
    }



    socket.join(roomId);
    socket.data.userId = userId;
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

    updateGameState(roomId, buildStateSnapshot(room));
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
      updateGameLastLevel(roomId, room.puzzleState.level);

    }

    if (typeof puzzleState.respawnToken !== "undefined") {
      const hostLevel = room.puzzleState.hostLevel || 1;
      const clientLevel = room.puzzleState.clientLevel || 1;
      const lowestLevel = Math.min(hostLevel, clientLevel);

      room.puzzleState.hostLevel = lowestLevel;
      room.puzzleState.clientLevel = lowestLevel;
      room.puzzleState.level = lowestLevel;
      updateGameLastLevel(roomId, lowestLevel);
      room.puzzleState.respawnToken = puzzleState.respawnToken;
    }

    io.to(roomId).emit("puzzleStateChanged", room.puzzleState);
    updateGameState(roomId, buildStateSnapshot(room));
  });
  // EXIT GAME (host closes room)
  socket.on("exitGame", ({ roomId, userId }) => {
    const room = rooms[roomId] || loadRoomFromDb(roomId);
    if (!room) {
      socket.emit("joinError", { message: "Room not found" });
      return;
    }
    if (!userId || userId !== room.hostUserId) {
      socket.emit("joinError", { message: "Only host can close the room" });
      return;
    }

    closeGame(roomId);
    delete rooms[roomId];
    io.to(roomId).emit("gameClosed", { roomId });
  });
  // DISCONNECT (Option B)
  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);

    for (const [userId, sockets] of userSockets.entries()) {
      if (sockets.has(socket.id)) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          userSockets.delete(userId);
        }
        break;
      }
    }

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

    // dY`? DO NOT clear playerPositions here ?+' progress is kept

    // If room empty ?+' delete it
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
