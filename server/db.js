import fs from "fs";
import path from "path";
import crypto from "crypto";
import Database from "better-sqlite3";

const dataDir = path.resolve("data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, "wist.db");
const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS games (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id TEXT NOT NULL UNIQUE,
    host_user_id INTEGER NOT NULL,
    client_user_id INTEGER,
    invited_user_id INTEGER,
    status TEXT NOT NULL DEFAULT 'waiting',
    last_level INTEGER NOT NULL DEFAULT 1,
    state_json TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    FOREIGN KEY (host_user_id) REFERENCES users(id),
    FOREIGN KEY (client_user_id) REFERENCES users(id),
    FOREIGN KEY (invited_user_id) REFERENCES users(id)
  );
`);

function ensureColumn(tableName, columnName, columnDef) {
  const columns = db
    .prepare(`PRAGMA table_info(${tableName})`)
    .all()
    .map((row) => row.name);
  if (!columns.includes(columnName)) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnDef}`);
  }
}

ensureColumn("games", "last_level", "last_level INTEGER NOT NULL DEFAULT 1");

function nowIso() {
  return new Date().toISOString();
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const iterations = 120000;
  const hash = crypto
    .pbkdf2Sync(password, salt, iterations, 64, "sha512")
    .toString("hex");
  return `pbkdf2$${iterations}$${salt}$${hash}`;
}

function verifyPassword(password, storedHash) {
  const [scheme, iterStr, salt, hash] = storedHash.split("$");
  if (scheme !== "pbkdf2") return false;
  const iterations = Number(iterStr);
  if (!iterations || !salt || !hash) return false;
  const candidate = crypto
    .pbkdf2Sync(password, salt, iterations, 64, "sha512")
    .toString("hex");
  return crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(hash));
}

export function createUser({ username, password }) {
  const stmt = db.prepare(
    "INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)"
  );
  const info = stmt.run(username, hashPassword(password), nowIso());
  return getUserById(info.lastInsertRowid);
}

export function getUserByUsername(username) {
  return db.prepare("SELECT * FROM users WHERE username = ?").get(username);
}

export function getUserById(id) {
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id);
}

export function verifyUser(username, password) {
  const user = getUserByUsername(username);
  if (!user) return null;
  if (!verifyPassword(password, user.password_hash)) return null;
  return user;
}

export function updateGameLastLevel(roomId, levelReached) {
  db.prepare(
    "UPDATE games SET last_level = MAX(COALESCE(last_level, 1), ?), updated_at = ? WHERE room_id = ?"
  ).run(levelReached, nowIso(), roomId);
}

export function createGameRecord({
  roomId,
  hostUserId,
  invitedUserId,
  status,
  state,
}) {
  const timestamp = nowIso();
  db.prepare(
    `INSERT INTO games
      (room_id, host_user_id, client_user_id, invited_user_id, status, last_level, state_json, created_at, updated_at)
     VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?)`
  ).run(
    roomId,
    hostUserId,
    invitedUserId ?? null,
    status,
    1,
    state ? JSON.stringify(state) : null,
    timestamp,
    timestamp
  );
  return getGameByRoomId(roomId);
}

export function getGameByRoomId(roomId) {
  return db.prepare("SELECT * FROM games WHERE room_id = ?").get(roomId);
}

export function updateGameState(roomId, state) {
  db.prepare(
    "UPDATE games SET state_json = ?, updated_at = ? WHERE room_id = ?"
  ).run(JSON.stringify(state), nowIso(), roomId);
}

export function assignClientToGame(roomId, userId) {
  db.prepare(
    "UPDATE games SET client_user_id = ?, status = 'active', updated_at = ? WHERE room_id = ?"
  ).run(userId, nowIso(), roomId);
  return getGameByRoomId(roomId);
}

export function acceptInvite(roomId, userId) {
  db.prepare(
    `UPDATE games
     SET client_user_id = ?, status = 'active', updated_at = ?
     WHERE room_id = ? AND invited_user_id = ? AND status = 'invited'`
  ).run(userId, nowIso(), roomId, userId);
  return getGameByRoomId(roomId);
}

export function closeGame(roomId) {
  db.prepare(
    "UPDATE games SET status = 'closed', deleted_at = ?, updated_at = ? WHERE room_id = ?"
  ).run(nowIso(), nowIso(), roomId);
}

export function inviteUserToGame(roomId, invitedUserId) {
  db.prepare(
    `UPDATE games
     SET invited_user_id = ?, status = 'invited', updated_at = ?
     WHERE room_id = ? AND status = 'waiting'`
  ).run(invitedUserId, nowIso(), roomId);
  return getGameByRoomId(roomId);
}

export function listActiveGamesForUser(userId) {
  return db
    .prepare(
      `SELECT
          g.room_id,
          g.status,
          g.last_level,
          g.host_user_id,
          g.client_user_id,
          g.updated_at,
          g.state_json,
          host.username AS host_username,
          client.username AS client_username,
          CASE
            WHEN g.host_user_id = ? THEN client.username
            ELSE host.username
          END AS opponent_username
       FROM games g
       LEFT JOIN users host ON host.id = g.host_user_id
       LEFT JOIN users client ON client.id = g.client_user_id
       WHERE g.deleted_at IS NULL
         AND g.status != 'closed'
         AND (g.host_user_id = ? OR g.client_user_id = ?)
       ORDER BY g.updated_at DESC`
    )
    .all(userId, userId, userId);
}

export function listInvitesForUser(userId) {
  return db
    .prepare(
      `SELECT
          g.room_id,
          g.host_user_id,
          g.updated_at,
          host.username AS host_username
       FROM games g
       LEFT JOIN users host ON host.id = g.host_user_id
       WHERE g.deleted_at IS NULL
         AND g.status = 'invited'
         AND g.invited_user_id = ?
       ORDER BY g.updated_at DESC`
    )
    .all(userId);
}
