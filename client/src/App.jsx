import { useEffect, useMemo, useState } from "react";
import GameCanvas from "./components/GameCanvas.jsx";
import { NetworkClient } from "./network/NetworkClient.js";

import LobbyControls from "./components/LobbyControls.jsx";
import GameDialog from "./components/GameDialog.jsx";
import GameStatusBar from "./components/GameStatusBar.jsx";

function App() {
  const [connected, setConnected] = useState(false);
  const [roomIdInput, setRoomIdInput] = useState("");
  const [role, setRole] = useState(null); // "host" or "client"
  const [world, setWorld] = useState(null);
  const [puzzleState, setPuzzleState] = useState(null);
  const [objects, setObjects] = useState(null);
  const [playerPositions, setPlayerPositions] = useState(null);
  const [players, setPlayers] = useState({ host: null, client: null });
  const playerCount = (players?.host ? 1 : 0) + (players?.client ? 1 : 0);

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
      setPlayers(players);
      console.log("Joined room", roomId, "players:", players);
    });

    // initial world & puzzle state
    network.on(
      "roomState",
      ({ world, puzzleState, objects, playerPositions }) => {
        if (world !== undefined) setWorld(world);
        if (puzzleState !== undefined) setPuzzleState(puzzleState);
        if (objects !== undefined) setObjects(objects);
        if (playerPositions !== undefined) setPlayerPositions(playerPositions);

        console.log("Room state received:", {
          world,
          puzzleState,
          objects,
          playerPositions,
        });
      }
    );

    // when someone leaves but room stays alive
    network.on("playerLeft", ({ leftPlayerId, players }) => {
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
      setRole(role);
      setConnected(true);
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
      <LobbyControls
        connected={connected}
        roomIdInput={roomIdInput}
        onRoomIdChange={setRoomIdInput}
        onCreate={handleCreate}
        onJoin={handleJoin}
      />

      <GameDialog
        dialog={dialog}
        isWaitingForSecondPlayer={isWaitingForSecondPlayer}
        onClose={() => setDialog((d) => ({ ...d, open: false }))}
      />

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

      <GameStatusBar
        connected={connected}
        network={network}
        role={role}
        playerCount={playerCount}
      />
    </>
  );
}

export default App;
