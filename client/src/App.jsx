import { useEffect, useMemo, useState } from "react";
import GameCanvas from "./components/GameCanvas.jsx";
import { NetworkClient } from "./network/NetworkClient.js";

function App() {
  const [connected, setConnected] = useState(false);
  const [roomIdInput, setRoomIdInput] = useState("");
  const [role, setRole] = useState(null); // "host" or "client"
  const [world, setWorld] = useState(null);
  const [puzzleState, setPuzzleState] = useState(null);
  const [players, setPlayers] = useState([]);
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
      setPlayers([network.playerId]);
      setDialog({
        open: true,
        title: "Game Created",
        message: `Share this Room ID with your friend:\n${roomId}`,
      });
    });

    // somebody joined (fires on both host + client)
    network.on("playerJoined", ({ roomId, players }) => {
      setPlayers(players); // 🔹 update on both tabs

      if (!network.isHost && role !== "host") {
        setRole("client");
        setConnected(true);
      }

      console.log("Joined room", roomId, "players:", players);
    });

    // initial world & puzzle state
    network.on("roomState", ({ world, puzzleState }) => {
      if (world !== undefined) setWorld(world);
      if (puzzleState !== undefined) setPuzzleState(puzzleState);
      console.log("Room state received:", { world, puzzleState });
    });

    // 🔹 when someone leaves but room stays alive
    network.on("playerLeft", ({ roomId, leftPlayerId, players }) => {
      setPlayers(players || []);
      console.log("Player left:", leftPlayerId, "remaining:", players);
    });

    // 🔹 when host closes and room is destroyed
    network.on("roomClosed", ({ roomId }) => {
      setDialog({
        open: true,
        title: "Room Closed",
        message: `The host left. Room ${roomId} was closed.`,
      });
      setConnected(false);
      setRole(null);
      setPlayers([]);
      setWorld(null);
      setPuzzleState(null);
    });

    // join errors
    network.on("joinError", ({ message }) => {
      setDialog({
        open: true,
        title: "Join Error",
        message,
      });
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
              <button onClick={() => setDialog((d) => ({ ...d, open: false }))}>
                Close
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
          <div>Players: {players.length}</div>
        </div>
      )}

    </>
  );
}

export default App;
