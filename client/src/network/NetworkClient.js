import { io } from "socket.io-client";

export class NetworkClient {
  constructor() {
    this.socket = io("http://localhost:3000");

    // Basic connection / identity
    this.roomId = null;
    this.isHost = false;
    this.players = [];
    this.playerId = null; // your own socket id (on connect)
    this.hostId = null;   // first player in room
    this.clientId = null; // second player in room (if any)
    this.userId = null;

    // For throttling movement updates
    this._lastMove = {
      t: 0,
      pos: null,
    };

    // Local event handlers for React side
    this._handlers = {
      gameCreated: [],
      joinError: [],
      remotePlayerMove: [],
      objectUpdated: [],
      puzzleStateChanged: [],
      playerJoined: [],
      playerLeft: [],
      roomState: [],
      connected: [],
      disconnected: [],
      roleAssigned: [],
      createError: [],
      gameClosed: [],
      inviteError: [],
      inviteSent: [],
      inviteReceived: [],
    };

    this._registerCoreHandlers();
  }

  // ───────────────────────────
  // Socket.IO event wiring
  // ───────────────────────────
  _registerCoreHandlers() {
    this.socket.on("connect", () => {
      this.playerId = this.socket.id;
      console.log("Connected:", this.socket.id);
      this._emitLocal("connected", { playerId: this.playerId });
    });

    this.socket.on("disconnect", () => {
      console.log("Disconnected");
      this._emitLocal("disconnected", {});
    });

    this.socket.on("gameCreated", ({ roomId, playerId, role }) => {
      this.roomId = roomId;
      this.isHost = role === "host";
      this.playerId = playerId ?? this.socket.id;
      // host is always first player
      this.hostId = this.playerId;
      console.log("Game created:", roomId, "role:", role);

      this._emitLocal("gameCreated", {
        roomId,
        playerId: this.playerId,
        role,
      });
    });

    this.socket.on("joinError", ({ message }) => {
      console.error("Join error:", message);
      this._emitLocal("joinError", { message });
    });

    this.socket.on("playerJoined", ({ roomId, players }) => {
      this.roomId = roomId;
      this.players = players;

      this.hostId = players?.host ?? null;
      this.clientId = players?.client ?? null;

      console.log("Players in room:", players);
      this._emitLocal("playerJoined", {
        roomId,
        players,
        hostId: this.hostId,
        clientId: this.clientId,
      });
    });

    this.socket.on("playerLeft", ({ roomId, leftPlayerId, players }) => {
      this.roomId = roomId;
      this.players = players || { host: null, client: null };
      console.log("Player left:", leftPlayerId, "Remaining:", this.players);

      this._emitLocal("playerLeft", {
        roomId,
        leftPlayerId,
        players: this.players,
      });
    });

    this.socket.on("roomState", (state) => {
      // state might contain puzzleState, world, objects, etc.
      this._emitLocal("roomState", state);
    });

    this.socket.on("remotePlayerMove", (data) => {
      this._emitLocal("remotePlayerMove", data);
    });

    this.socket.on("objectUpdated", (payload) => {
      this._emitLocal("objectUpdated", payload);
    });

    this.socket.on("puzzleStateChanged", (puzzleState) => {
      this._emitLocal("puzzleStateChanged", puzzleState);
    });

    this.socket.on("roleAssigned", ({ roomId, role }) => {
      this.isHost = role === "host";
      console.log("Role assigned:", role, "for room", roomId);
      this._emitLocal("roleAssigned", { roomId, role });
    });

    this.socket.on("createError", ({ message }) => {
      this._emitLocal("createError", { message });
    });

    this.socket.on("gameClosed", ({ roomId }) => {
      this._emitLocal("gameClosed", { roomId });
    });

    this.socket.on("inviteError", ({ message }) => {
      this._emitLocal("inviteError", { message });
    });

    this.socket.on("inviteSent", ({ roomId, invitedUserId, invitedUsername }) => {
      this._emitLocal("inviteSent", { roomId, invitedUserId, invitedUsername });
    });

    this.socket.on("inviteReceived", (payload) => {
      this._emitLocal("inviteReceived", payload);
    });
  }

  // ───────────────────────────
  // Local event system (for React)
  // ───────────────────────────
  _emitLocal(event, payload) {
    if (!this._handlers[event]) return;
    this._handlers[event].forEach((cb) => cb(payload));
  }

  on(event, callback) {
    if (!this._handlers[event]) {
      console.warn("Unknown network event:", event);
      return;
    }
    this._handlers[event].push(callback);
  }

  // ───────────────────────────
  // Public helpers for teammates
  // ───────────────────────────
  getRoomId() {
    return this.roomId;
  }

  getRole() {
    return this.isHost ? "host" : "client";
  }

  isHostPlayer() {
    return this.isHost;
  }

  getPlayerIds() {
    return {
      self: this.playerId,
      hostId: this.hostId,
      clientId: this.clientId,
    };
  }

  setUser(user) {
    this.userId = user?.id ?? null;
    if (this.userId) {
      this.socket.emit("identify", { userId: this.userId });
    }
  }

  // ───────────────────────────
  // Outgoing messages
  // ───────────────────────────
  createGame({ inviteUsername } = {}) {
    this.socket.emit("createGame", {
      userId: this.userId,
      inviteUsername,
    });
  }

  sendInvite({ roomId, inviteUsername }) {
    this.socket.emit("sendInvite", {
      roomId,
      inviteUsername,
      userId: this.userId,
    });
  }

  joinGame(roomId) {
    this.socket.emit("joinGame", { roomId, userId: this.userId });
  }

  /**
   * Send player movement to server with light throttling
   * - limits frequency (every ~50ms)
   * - skips if position barely changed
   */
  sendPlayerMove(position) {
    if (!this.roomId) return;

    const now = performance.now();
    const MIN_INTERVAL = 50; // ms
    const EPS = 0.001;

    const last = this._lastMove;
    if (last.pos && now - last.t < MIN_INTERVAL) {
      const dx = position.x - last.pos.x;
      const dy = position.y - last.pos.y;
      const dz = position.z - last.pos.z;
      const distSq = dx * dx + dy * dy + dz * dz;
      if (distSq < EPS * EPS) {
        return; // too soon and barely moved -> skip
      }
    }

    this._lastMove = {
      t: now,
      pos: { ...position },
    };

    this.socket.emit("playerMove", {
      roomId: this.roomId,
      position,
    });
  }

  sendObjectUpdate(objectId, state) {
    if (!this.roomId) return;
    this.socket.emit("objectUpdate", {
      roomId: this.roomId,
      objectId,
      state,
    });
  }

  sendPuzzleUpdate(partialPuzzleState) {
    if (!this.roomId) return;
    this.socket.emit("puzzleUpdate", {
      roomId: this.roomId,
      puzzleState: partialPuzzleState,
    });
  }

  exitGame() {
    if (!this.roomId) return;
    this.socket.emit("exitGame", {
      roomId: this.roomId,
      userId: this.userId,
    });
  }

  /**
   * Disconnect from the current room/game
   */
  disconnect() {
    if (this.socket && this.socket.connected) {
      this.socket.disconnect();
      // Reconnect immediately for potential new games
      setTimeout(() => {
        this.socket.connect();
      }, 100);
    }
    // Reset local state
    this.roomId = null;
    this.isHost = false;
    this.players = [];
    this.hostId = null;
    this.clientId = null;
  }
}
