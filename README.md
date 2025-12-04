# Wist

Wist is a 3D cooperative puzzle platformer centered around two characters — a Mother and Daughter — who are transported into a mysterious dream-world following an emotional confrontation after the passing of the father. Each player experiences the world differently through unique visual themes and asymmetric abilities. The goal is for players to communicate, collaborate, and navigate puzzle-based levels that symbolically represent the five stages of grief: Denial, Anger, Bargaining, Depression, and Acceptance.

---

Table of contents
- Project overview
- Repo structure and file descriptions
- How it works (architecture & networking)
- Prerequisites
- Local setup and run instructions
  - Server
  - Client (development)
  - Building for production (client)
- Configuration & environment
- Developer notes (events, data shapes)
- Troubleshooting
- Contributing & license

---

Project overview
- Wist is a lightweight multiplayer demo: one host creates a room, a second player can join, and both players can move and interact with a small 3D scene (blocks, holes, puzzle state). The server keeps authoritative room state (world, objects, puzzleState) in memory and relays events between connected clients.

Repo structure and file descriptions (key files observed)


- server/
  - index.js
    - Main Socket.IO + Express server.
    - Handles room creation, joining, movement updates, object/block updates, puzzle updates, and disconnect behavior.
    - Uses in-memory rooms object to store per-room state:
      - rooms[roomId] contains players (host, client), puzzleState, world, objects, playerPositions.
    - Exposes Socket.IO events that clients emit and events it emits back to clients (see Developer notes/events below).
    - Default server port: 3000 (see code).

- client/
  - src/
    - App.jsx
      - Main React application container and lobby UI.
      - Connects to the network client, creates/joins games, shows dialogs and room/player info.
      - Subscribes to network events like gameCreated, playerJoined, roomState, playerLeft, roleAssigned, etc.
      - Passes world, puzzleState, objects, playerPositions and role props down to the 3D canvas component.
    - components/
      - GameCanvas.jsx
        - Three.js-based 3D renderer and gameplay canvas.
        - Initializes scene, camera and renderer.
        - Creates local and remote player meshes and renders blocks/objects from server state.
        - Listens for remote player position updates, applies saved world state (spawn points, blocks, player positions), and updates visuals.
        - Handles keyboard input (movement) and sends/receives movement updates via network.
    - network/
      - NetworkClient.js
        - Socket.IO client wrapper for emitting and subscribing to network events.
        - Registers local handlers and provides a local event-emitter-like interface for the React app to react to socket messages.
        - Handles events like roomState, puzzleStateChanged, roleAssigned, remotePlayerMove, objectUpdated, joinError, etc.

- (Other expected files; create if missing)
  - package.json (in root and/or in client and server directories)
  - client/package.json typically contains Vite/React scripts (e.g., `npm run dev`, `npm run build`).
  - server/package.json typically contains a start script (e.g., `node index.js` or `npm start`).


---

How it works (architecture & networking)
- Stack:
  - Server: Node.js + Express + Socket.IO
  - Client: React + Three.js (Three) + Socket.IO client, typically served with Vite during development
- Basic session flow:
  1. Host clicks "Create Game" → client emits createGame to server.
  2. Server creates a 5-character room ID, stores initial world/puzzle state, marks socket as host and emits back:
     - gameCreated (roomId, playerId, role)
     - roleAssigned (roomId, role)
     - initial roomState (world, puzzleState, objects, playerPositions)
  3. A joining client emits joinGame with the roomId.
     - Server assigns a role (host or client) to the joining socket depending on which slot is free, emits roleAssigned for that socket, and then emits playerJoined and roomState to the room so everyone has current state.
  4. Movement and interactions:
     - Clients emit playerMove events with { roomId, position }.
     - Server forwards moves to the other client(s) using remotePlayerMove.
     - Clients can emit objectUpdate events to change block/object state; the server stores and broadcasts the server-authoritative object state.
     - puzzleUpdate events update puzzleState on the server and are broadcast with puzzleStateChanged.
  5. Disconnect behavior:
     - If a socket disconnects, server nulls the appropriate slot (host or client) but retains room state while at least one player remains. If the room becomes empty, it is deleted.

Developer notes — events & data shapes
- Client → Server (emits):
  - createGame
  - joinGame { roomId }
  - playerMove { roomId, position: { x, y, z } }
  - objectUpdate { roomId, objectId, state: {...} }
  - puzzleUpdate { roomId, puzzleState: {...} }
- Server → Client (emits):
  - gameCreated { roomId, playerId, role }
  - roleAssigned { roomId, role }  // explicit role (host | client)
  - roomState { world, puzzleState, objects, playerPositions }
  - playerJoined { roomId, players } // players is { host: socketId|null, client: socketId|null }
  - playerLeft { roomId, leftRole, players } // leftRole = "host"|"client"
  - remotePlayerMove { id, position }
  - objectUpdated { objectId, state }
  - puzzleStateChanged { ... }
  - joinError { message }
- Typical world object (example from server):
  - world.spawnPoints: { host: {x,y,z}, client: {x,y,z} }
  - world.blocks: { block_1: { x, y, z }, ... }
  - world.holes: { hole_A: { x, z, filled: false }, ... }
- Room state keeps server-authoritative objects and playerPositions.

---

Prerequisites
- Node.js (recommended >= 16). Check with: node -v
- npm or yarn
- Modern browser (Chrome/Edge/Firefox) with WebGL enabled
- Ports:
  - Server: 3000 (default in server/index.js)
  - Client dev server: 5173 (Vite default; server CORS is configured to allow origin http://localhost:5173)

Dependencies used in the code (explicitly referenced)
- server:
  - express
  - socket.io
  - cors
- client:
  - react / react-dom
  - three
  - socket.io-client
  - vite (commonly used for dev server; code references an origin at http://localhost:5173)

Install these via package.json (recommended) or with npm/yarn if package.json is absent.

---

Local setup and run instructions

1) Clone the repo
   git clone https://github.com/fariioodaazz/Wist.git
   cd Wist

2) Server: install & start
   - If server has its own package.json (server/package.json)
     cd server
     npm install
     npm start
     - If there is no start script, run:
       node index.js
   - Server listens on port 3000 by default. You should see:
     "Socket.IO server running on http://localhost:3000"

3) Client (development): install & start
   - Open a second terminal
     cd client
     npm install
     npm run dev
   - Vite default dev server runs on http://localhost:5173. Browse to that URL to open the client app.
   - The server code currently allows CORS from http://localhost:5173.

4) Play locally
   - Open two browser windows (or two devices on the same network, and change origin/CORS accordingly).
   - In one window, create a game — you should receive a room code or see a "Game Created" dialog.
   - In the second window, join the same room code. The UI indicates role: host or client.
   - Move your player (keyboard controls; the client code tracks key presses) and watch movement sync between clients.

Building client for production (typical)
- cd client
- npm run build
- Serve the generated static files (dist/) with any static file server.
- For production you will likely want to:
  - Serve the static client from a web server and point the client to the running Socket.IO server URL.
  - Update CORS in server/index.js to allow your production origin(s).
  - Consider making server port configurable (e.g., process.env.PORT) if deploying.

Configuration & environment
- By default, server/index.js sets PORT = 3000. If you want to expose this via environment variable, edit server/index.js to read process.env.PORT.
- CORS origin is currently set to http://localhost:5173. If you serve client from another origin, update the server CORS config accordingly.
- The server stores room data in memory. For persistence across restarts or for scaling, integrate a database or a central store (Redis, etc.) and add proper locking/consensus.

Troubleshooting
- The client fails to connect:
  - Ensure server is running: node server/index.js
  - Check console for CORS errors — confirm origin matches server CORS settings.
  - Confirm client is requesting socket to the correct server URL (http://localhost:3000).
- Movement isn't visible to the other client:
  - Make sure both clients joined the same room and the server emitted roomState and playerJoined events.
  - Check server logs for remotePlayerMove forwarding.
- Room disappears when someone leaves:
  - Current server logic deletes a room only when both host and client are disconnected. If host leaves but the other player remains, the room persists with host slot set to null.

Contributing
- Pull requests welcome. Suggested workflow:
  - Fork repo → create a feature branch → open PR with descriptive title and changelog.
  - Keep code style consistent with existing files (ES modules, modern JS).
  - If you add server-side changes that alter public events or state shapes, update this README and client code accordingly.

License
- No license file was detected in the observed project files. Add a LICENSE file if you intend to open-source under a particular license.

Thank you — enjoy exploring and exploring Wist!
