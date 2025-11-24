import { useEffect, useMemo, useState } from "react";
import GameCanvas from "./components/GameCanvas.jsx";
import { NetworkClient } from "./network/NetworkClient.js";

function App() {
  const [connected, setConnected] = useState(false);
  const [roomIdInput, setRoomIdInput] = useState("");
  const [role, setRole] = useState(null); // "host" or "client"
  const [world, setWorld] = useState(null);
  const [puzzleState, setPuzzleState] = useState(null);
  const [objects, setObjects] = useState(null);
  const [playerPositions, setPlayerPositions] = useState(null);
  const [players, setPlayers] = useState({ host: null, client: null });
  const playerCount =
  (players?.host ? 1 : 0) + (players?.client ? 1 : 0);

  const [dialog, setDialog] = useState({
    open: false,
    title: "",
    message: "",
  });

  const network = useMemo(() => new NetworkClient(), []);

  useEffect(() => {
    // game created
    network.on("gameCreated", ({ roomId, role }) => {
      setRole(role);
      setConnected(true);
      setPlayers({ host: network.playerId, client: null });
      setDialog({
        open: true,
        title: "Game Created",
        message: `Share this Room ID with your friend:\n${roomId}`,
      });
    });

    // somebody joined (fires on both host + client)
    network.on("playerJoined", ({ roomId, players }) => {
      setPlayers(players); // 🔹 update on both tabs
      console.log("Joined room", roomId, "players:", players);
    });

    // initial world & puzzle state
    network.on("roomState", ({ world, puzzleState, objects, playerPositions }) => {
      if (world !== undefined) setWorld(world);
      if (puzzleState !== undefined) setPuzzleState(puzzleState);
      if (objects !== undefined) setObjects(objects);
      if (playerPositions !== undefined) setPlayerPositions(playerPositions);

      console.log("Room state received:", {
        world,
        puzzleState,
        objects,
        playerPositions
      });
    });


    // 🔹 when someone leaves but room stays alive
    network.on("playerLeft", ({leftPlayerId, players }) => {
      setPlayers(players || { host: null, client: null });
      console.log("Player left:", leftPlayerId, "remaining:", players);
    });

    // join errors
    network.on("joinError", ({ message }) => {
      setDialog({
        open: true,
        title: "Join Error",
        message,
      });
    });

    network.on("roleAssigned", ({ role }) => {
      setRole(role);        // host / client
      setConnected(true);   // we now know we’re in a room
    });

  }, [network, role]);


  const handleCreate = () => {
    network.createGame();
  };

  const handleJoin = () => {
    if (!roomIdInput.trim()) {
      setDialog({
        open: true,
        title: "Missing Room ID",
        message: "Please enter a valid Room ID to join.",
      });
      return;
    }
    network.joinGame(roomIdInput.trim());
  };

  const isWaitingForSecondPlayer =
    role === "host" &&
    dialog.open &&
    dialog.title === "Game Created" &&
    playerCount < 2;

  return (
    <>
      {/* Lobby controls */}
      {!connected && (
        <div
          style={{
            position: "fixed",
            top: 20,
            left: 20,
            zIndex: 10,
            background: "#111827cc",
            padding: "12px 16px",
            borderRadius: 8,
            color: "white",
            display: "flex",
            gap: 8,
            alignItems: "center",
          }}
        >
          <button onClick={handleCreate}>Create Game</button>
          <input
            placeholder="Room ID"
            value={roomIdInput}
            onChange={(e) => setRoomIdInput(e.target.value)}
            style={{ padding: "4px 8px" }}
          />
          <button onClick={handleJoin}>Join Game</button>
        </div>
      )}

      {/* Dialog overlay */}
      {dialog.open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "#00000080",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 20,
          }}
        >
          <div
            style={{
              background: "#111827",
              color: "white",
              padding: "16px 20px",
              borderRadius: 10,
              minWidth: 280,
              maxWidth: 400,
              boxShadow: "0 10px 25px rgba(0,0,0,0.4)",
            }}
          >
            <h2 style={{ marginBottom: 8 }}>{dialog.title}</h2>
            <p style={{ whiteSpace: "pre-line", marginBottom: 16 }}>
              {dialog.message}
            </p>
            <div style={{ textAlign: "right" }}>
              <button
                disabled={isWaitingForSecondPlayer}
                onClick={() => {
                  if (isWaitingForSecondPlayer) return; // extra safety
                  setDialog((d) => ({ ...d, open: false }));
                }}
                style={{
                  opacity: isWaitingForSecondPlayer ? 0.6 : 1,
                  cursor: isWaitingForSecondPlayer ? "not-allowed" : "pointer",
                }}
              >
                {isWaitingForSecondPlayer ? "Waiting for Player 2..." : "Close"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Game Scene (Three.js) */}
      {connected && (
          <GameCanvas
            network={network}
            role={role}
            world={world}
            puzzleState={puzzleState}
            objects={objects}
            playerPositions={playerPositions}
          />
      )}
      {connected && (
        <div
          style={{
            position: "fixed",
            bottom: 16,
            left: 16,
            padding: "8px 12px",
            borderRadius: 8,
            background: "#00000080",
            color: "white",
            fontSize: 12,
            zIndex: 5,
          }}
        >
          <div>Room: {network.getRoomId?.() ?? network.roomId}</div>
          <div>Role: {role ?? network.getRole?.()}</div>
          <div>Players: {playerCount}</div>
        </div>
      )}

    </>
  );
}

export default App;
