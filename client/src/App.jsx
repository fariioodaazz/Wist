import { useEffect, useMemo, useRef, useState } from "react";
import GameCanvas from "./components/GameCanvas.jsx";
import { NetworkClient } from "./network/NetworkClient.js";

import GameDialog from "./components/GameDialog.jsx";
import GameStatusBar from "./components/GameStatusBar.jsx";
import MainMenu from "./components/MainMenu.jsx";

import menuImage from "./assets/menu.jpeg";
import dadImage from "./assets/dad_removed.png";
import houseImage from "./assets/house_removed.png";

function App() {
  const [screen, setScreen] = useState("mainMenu"); // "mainMenu" | "lobby" | "waiting" | "game"
  const [prevScreen, setPrevScreen] = useState("mainMenu");
  const [connected, setConnected] = useState(false);

  const [roomIdInput, setRoomIdInput] = useState("");
  const [roomId, setRoomId] = useState("");
  const [role, setRole] = useState(null); // "host" or "client"

  const [world, setWorld] = useState(null);
  const [puzzleState, setPuzzleState] = useState(null);
  const [objects, setObjects] = useState(null);
  const [playerPositions, setPlayerPositions] = useState(null);
  const [players, setPlayers] = useState({ host: null, client: null });
  const playerCount = (players?.host ? 1 : 0) + (players?.client ? 1 : 0);

  const [isPaused, setIsPaused] = useState(false);
  const [hasExitedGame, setHasExitedGame] = useState(false);

  const [dialog, setDialog] = useState({
    open: false,
    title: "",
    message: "",
  });

  const API_BASE = "http://localhost:3000";
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({ username: "", password: "" });
  const [authError, setAuthError] = useState("");

  const [invites, setInvites] = useState([]);
  const [activeGames, setActiveGames] = useState([]);
  const [inviteTarget, setInviteTarget] = useState("");
  const [inviteStatus, setInviteStatus] = useState("");

  // Lobby sub-modes:
  // home => 4 bottom buttons only
  // continue => list saved games + rejoin
  // join => input room code + join
  const [lobbyMode, setLobbyMode] = useState("home");

  // Invite popup modal
  const [invitePopup, setInvitePopup] = useState({
    open: false,
    roomId: "",
    hostUserId: null,
    hostUsername: "",
  });

  const screenRef = useRef(screen);
  const network = useMemo(() => new NetworkClient(), []);

  const refreshGames = async () => {
    if (!user) return;
    const res = await fetch(`${API_BASE}/api/games?userId=${user.id}`);
    if (!res.ok) return;
    const data = await res.json();
    setActiveGames(data.games || []);
  };

  const refreshInvites = async () => {
    if (!user) return;
    const res = await fetch(`${API_BASE}/api/invites?userId=${user.id}`);
    if (!res.ok) return;
    const data = await res.json();
    setInvites(data.invites || []);
  };

  const handleAuthSubmit = async () => {
    setAuthError("");
    if (!authForm.username || !authForm.password) {
      setAuthError("Username and password required");
      return;
    }

    const endpoint = authMode === "login" ? "login" : "register";
    const res = await fetch(`${API_BASE}/api/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(authForm),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setAuthError(data.message || "Authentication failed");
      return;
    }

    setUser(data);
    setAuthForm({ username: "", password: "" });
  };

  const handleLogout = () => {
    network.disconnect();
    network.setUser(null);
    setUser(null);
    setAuthForm({ username: "", password: "" });
    setAuthError("");
    setRoomId("");
    setRoomIdInput("");
    setLobbyMode("home");
    setScreen("mainMenu");
  };

  useEffect(() => {
    screenRef.current = screen;
  }, [screen]);

  useEffect(() => {
    // game created - host waits for second player
    network.on("gameCreated", ({ roomId, role }) => {
      setRole(role);
      setRoomId(roomId);
      setConnected(true);
      setPlayers({ host: network.playerId, client: null });
      setScreen("waiting");
      setHasExitedGame(false);
      setInviteStatus("");
      setInviteTarget("");
    });

    // somebody joined (fires on both host + client)
    network.on("playerJoined", ({ roomId, players }) => {
      setPlayers(players);
      console.log("Joined room", roomId, "players:", players);

      const count = (players?.host ? 1 : 0) + (players?.client ? 1 : 0);
      if (count === 2) {
        setPrevScreen(screenRef.current);
        setScreen("game");
      }
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

    network.on("puzzleStateChanged", (puzzleState) => {
      setPuzzleState(puzzleState);
    });

    network.on("playerLeft", ({ leftPlayerId, players }) => {
      setPlayers(players || { host: null, client: null });
      console.log("Player left:", leftPlayerId, "remaining:", players);
    });

    network.on("joinError", ({ message }) => {
      setDialog({ open: true, title: "Join Error", message });
    });

    network.on("roleAssigned", ({ role }) => {
      setRole(role);
      setConnected(true);
      setHasExitedGame(false);
    });

    network.on("createError", ({ message }) => {
      setDialog({ open: true, title: "Create Error", message });
    });

    network.on("gameClosed", ({ roomId }) => {
      setDialog({
        open: true,
        title: "Game Closed",
        message: `Room ${roomId} was closed by the host.`,
      });
      handleBackToMainMenu();
    });

    network.on("inviteError", ({ message }) => {
      setDialog({ open: true, title: "Invite Error", message });
    });

    network.on("inviteSent", ({ invitedUsername }) => {
      setInviteStatus(`Invite sent to ${invitedUsername}`);
      setInviteTarget("");
      refreshInvites();
    });

    // INVITE POPUP
    network.on("inviteReceived", ({ roomId, hostUserId, hostUsername }) => {
      setInvites((prev) => {
        if (prev.some((invite) => invite.room_id === roomId)) return prev;
        const nextInvite = {
          room_id: roomId,
          host_user_id: hostUserId,
          host_username: hostUsername,
          updated_at: new Date().toISOString(),
        };
        return [nextInvite, ...prev];
      });

      setInvitePopup({
        open: true,
        roomId,
        hostUserId,
        hostUsername,
      });
    });
  }, [network]);

  useEffect(() => {
    if (!user) return;
    network.setUser(user);
    refreshGames();
    refreshInvites();
  }, [user, network]);

  // Menu navigation handlers
  const handlePlayFromMainMenu = () => {
    if (!user) {
      setDialog({
        open: true,
        title: "Login required",
        message: "Please login to start playing.",
      });
      return;
    }
    refreshGames();
    refreshInvites();
    setLobbyMode("home");
    setScreen("lobby");
  };

  const handleBackToMainMenu = () => {
    if (connected) {
      network.disconnect();
    }

    setScreen("mainMenu");
    setConnected(false);
    setRole(null);
    setRoomId("");
    setRoomIdInput("");
    setIsPaused(false);
    setWorld(null);
    setPuzzleState(null);
    setObjects(null);
    setPlayerPositions(null);
    setPlayers({ host: null, client: null });
    setHasExitedGame(false);

    setLobbyMode("home");
    setInviteTarget("");
    setInviteStatus("");
  };

  const handleCreate = () => {
    if (!user) {
      setDialog({
        open: true,
        title: "Login required",
        message: "Please login to create a game.",
      });
      return;
    }
    network.createGame();
  };

  const handleJoin = () => {
    if (!user) {
      setDialog({
        open: true,
        title: "Login required",
        message: "Please login to join a game.",
      });
      return;
    }
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

  const handleAcceptInvite = async (inviteRoomId) => {
    if (!user) return;
    const res = await fetch(`${API_BASE}/api/accept-invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, roomId: inviteRoomId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setDialog({
        open: true,
        title: "Invite Error",
        message: data.message || "Failed to accept invite",
      });
      return;
    }
    refreshInvites();
    refreshGames();
    network.joinGame(inviteRoomId);
  };

  const handleRejoinGame = (gameRoomId) => {
    if (connected && roomId === gameRoomId) {
      setScreen("game");
      return;
    }
    network.joinGame(gameRoomId);
  };

  const handleSendInvite = () => {
    if (!inviteTarget.trim()) {
      setDialog({
        open: true,
        title: "Invite Error",
        message: "Please enter a username to invite.",
      });
      return;
    }
    if (!roomId) {
      setDialog({
        open: true,
        title: "Invite Error",
        message: "Create a room first.",
      });
      return;
    }
    network.sendInvite({
      roomId,
      inviteUsername: inviteTarget.trim(),
    });
  };

  // LOBBY button behavior
  const handleContinueGame = async () => {
    if (!user) {
      setDialog({
        open: true,
        title: "Login required",
        message: "Please login to continue a game.",
      });
      return;
    }
    await refreshGames();
    setLobbyMode("continue");
  };

  // ✅ NEW GAME: immediately create + show WAITING screen (not a "Create Room" section)
  const handleLobbyNewGame = () => {
    if (!user) {
      setDialog({
        open: true,
        title: "Login required",
        message: "Please login to create a game.",
      });
      return;
    }
    // clear invite UI
    setInviteTarget("");
    setInviteStatus("");
    // create the game -> network.on("gameCreated") will move to screen="waiting"
    handleCreate();
  };

  const handleLobbyJoinGame = () => {
    if (!user) {
      setDialog({
        open: true,
        title: "Login required",
        message: "Please login to join a game.",
      });
      return;
    }
    setLobbyMode("join");
  };

  const handleLobbyBack = () => {
    if (screen === "lobby" && lobbyMode !== "home") {
      setLobbyMode("home");
      return;
    }
    handleBackToMainMenu();
  };

  const handleExitGame = () => {
    const currentRoomId = roomId;
    const isHostExit = role === "host";

    if (isHostExit) {
      network.exitGame();
      network.disconnect();

      setScreen("lobby");
      setConnected(false);
      setRole(null);

      setRoomIdInput("");
      setRoomId("");

      setIsPaused(false);
      setWorld(null);
      setPuzzleState(null);
      setObjects(null);
      setPlayerPositions(null);
      setPlayers({ host: null, client: null });
      setHasExitedGame(false);

      setLobbyMode("home");
      return;
    }

    setScreen(prevScreen);
    setIsPaused(false);
    setRoomIdInput(currentRoomId);
    setHasExitedGame(true);
  };

  const handleBackFromGame = () => {
    setScreen(prevScreen);
    setIsPaused(false);
  };

  const togglePause = () => {
    setIsPaused(!isPaused);
  };

  const getGameLevel = (game) => game?.last_level ?? null;

  const lobbyBgImages = [menuImage, dadImage, houseImage];

  const [bgA, setBgA] = useState(0);
  const [bgB, setBgB] = useState(1);
  const [showB, setShowB] = useState(false);

  useEffect(() => {
    if (screen !== "lobby") return;

    const fadeMs = 1200;
    const holdMs = 1500;

    let i = 0; // A is i, B is i+1
    let t1, t2;

    const step = () => {
      if (i >= lobbyBgImages.length - 1) {
        // we're at the last image -> stay
        setShowB(false);
        setBgA(lobbyBgImages.length - 1);
        return;
      }

      setBgA(i);
      setBgB(i + 1);
      setShowB(true);

      // after fade, lock A to the new image and prepare next step
      t1 = setTimeout(() => {
        i = i + 1;
        setShowB(false);

        t2 = setTimeout(step, holdMs);
      }, fadeMs);
    };

    step();

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [screen]);

  return (
    <>
      {/* Main Menu */}
      {screen === "mainMenu" && (
        <MainMenu
          onPlay={handlePlayFromMainMenu}
          user={user}
          authMode={authMode}
          authForm={authForm}
          authError={authError}
          onAuthChange={setAuthForm}
          onAuthSubmit={handleAuthSubmit}
          onToggleAuthMode={() =>
            setAuthMode(authMode === "login" ? "register" : "login")
          }
          onLogout={handleLogout}
        />
      )}

      {/* Lobby (background only here) */}
      {/* Lobby (background only here) */}
      {screen === "lobby" && (
        <div
          style={{
            minHeight: "100vh",
            width: "100vw",
            backgroundColor: "#D9D9D9",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Layer A */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: `url(${lobbyBgImages[bgA]})`,
              backgroundRepeat: "no-repeat",
              backgroundPosition: "center",
              backgroundSize: "contain",
              zIndex: 0,
            }}
          />

          {/* Layer B fades in over A */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: `url(${lobbyBgImages[bgB]})`,
              backgroundRepeat: "no-repeat",
              backgroundPosition: "center",
              backgroundSize: "contain",
              opacity: showB ? 1 : 0,
              transition: "opacity 1200ms ease",
              zIndex: 1,
            }}
          />

          {/* Foreground UI (header + buttons) */}
          <div style={{ position: "relative", zIndex: 100 }}>
            {/* Username header */}
            <h1
              style={{
                position: "fixed",
                top: 16,
                left: 0,
                right: 0,
                textAlign: "center",
                color: "black",
                margin: 0,
                zIndex: 300,
                pointerEvents: "none",
              }}
            >
              Welcome back, {user?.username}!
            </h1>

            {/* ✅ Center overlay panels (Continue / Join) - FIXED + CENTERED */}
            <div
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 16,
                boxSizing: "border-box",
                zIndex: 200, // above images, below popup
                pointerEvents: lobbyMode === "home" ? "none" : "auto",
              }}
            >
              {/* CONTINUE VIEW */}
              {lobbyMode === "continue" && (
                <div
                  style={{
                    width: "min(900px, 92vw)",
                    maxHeight: "70vh",
                    overflow: "auto",
                    background: "rgba(0,0,0,0.45)",
                    padding: 16,
                    borderRadius: 12,
                    color: "white",
                    boxSizing: "border-box",
                    pointerEvents: "auto",
                  }}
                >
                  <h2 style={{ marginTop: 0 }}>Saved Games</h2>

                  {activeGames.length === 0 ? (
                    <div>No saved games found.</div>
                  ) : (
                    <div style={{ display: "grid", gap: 10 }}>
                      {activeGames.map((game) => (
                        <div
                          key={game.room_id}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: 12,
                            padding: 12,
                            borderRadius: 10,
                            background: "rgba(255,255,255,0.12)",
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 700 }}>
                              Room {game.room_id}{" "}
                              {getGameLevel(game)
                                ? `(Level ${getGameLevel(game)})`
                                : ""}
                            </div>
                            <div style={{ opacity: 0.9 }}>
                              Opponent: {game.opponent_username || "Waiting"}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRejoinGame(game.room_id)}
                            style={{ pointerEvents: "auto" }}
                          >
                            Rejoin
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* JOIN GAME VIEW */}
              {lobbyMode === "join" && (
                <div
                  style={{
                    width: "min(700px, 92vw)",
                    background: "rgba(0,0,0,0.45)",
                    padding: 16,
                    borderRadius: 12,
                    color: "white",
                    display: "grid",
                    gap: 12,
                    boxSizing: "border-box",
                    pointerEvents: "auto",
                  }}
                >
                  <h2 style={{ marginTop: 0 }}>Join Game</h2>

                  <input
                    type="text"
                    placeholder="Enter Room Code"
                    value={roomIdInput}
                    onChange={(e) => setRoomIdInput(e.target.value)}
                    style={{
                      width: "100%",
                      padding: 10,
                      borderRadius: 10,
                      border: "none",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />

                  <button type="button" onClick={handleJoin}>
                    Join
                  </button>
                </div>
              )}
            </div>

            {/* Bottom buttons */}
            <div
              style={{
                position: "fixed",
                left: 0,
                right: 0,
                bottom: 0,
                padding: 12,
                display: "grid",
                gap: 12,
                zIndex: 9999,
                boxSizing: "border-box",
              }}
            >
              {lobbyMode === "home" ? (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(4, 1fr)",
                    gap: 12,
                  }}
                >
                  <button type="button" onClick={handleContinueGame}>
                    Continue Game
                  </button>

                  <button type="button" onClick={handleLobbyNewGame}>
                    New Game
                  </button>

                  <button type="button" onClick={handleLobbyJoinGame}>
                    Join Game
                  </button>

                  <button type="button" onClick={handleLobbyBack}>
                    Back
                  </button>
                </div>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr",
                    gap: 12,
                  }}
                >
                  <button type="button" onClick={handleLobbyBack}>
                    Back
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ✅ Invite Popup (full-screen fixed + centered) */}
          {invitePopup.open && (
            <div
              style={{
                position: "fixed",
                inset: 0,
                width: "100vw",
                height: "100vh",
                backgroundColor: "rgba(0,0,0,0.6)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 16,
                zIndex: 999999,
              }}
              onClick={() => setInvitePopup((p) => ({ ...p, open: false }))}
            >
              <div
                style={{
                  width: "min(520px, 92vw)",
                  backgroundColor: "white",
                  padding: 16,
                  borderRadius: 12,
                  display: "grid",
                  gap: 12,
                  boxSizing: "border-box",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <h3 style={{ margin: 0 }}>Game Invite</h3>

                <div style={{ color: "black" }}>
                  <b>{invitePopup.hostUsername || invitePopup.hostUserId}</b>{" "}
                  invited you to room <b>{invitePopup.roomId}</b>
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: 12,
                    justifyContent: "flex-end",
                  }}
                >
                  <button
                    type="button"
                    onClick={() =>
                      setInvitePopup((p) => ({ ...p, open: false }))
                    }
                  >
                    Decline
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const rid = invitePopup.roomId;
                      setInvitePopup((p) => ({ ...p, open: false }));
                      handleAcceptInvite(rid);
                    }}
                  >
                    Accept
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Waiting Screen - styled like the rest*/}
      {screen === "waiting" && (
        <div
          style={{
            minHeight: "100vh",
            width: "100vw",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            boxSizing: "border-box",
            overflow: "hidden",
          }}
        >
          {/* Center panel */}
          <div
            style={{
              width: "min(700px, 92vw)",
              maxHeight: "calc(100vh - 96px)",
              overflow: "auto",
              background: "rgba(0,0,0,0.45)",
              padding: 16,
              borderRadius: 12,
              color: "white",
              display: "grid",
              gap: 12,
              boxSizing: "border-box",
            }}
          >
            <h2 style={{ margin: 0 }}>Waiting for Player 2...</h2>

            <div style={{ display: "grid", gap: 8 }}>
              <p style={{ margin: 0, opacity: 0.95 }}>
                Share this code with your friend:
              </p>
              <div
                style={{
                  padding: 12,
                  borderRadius: 10,
                  background: "rgba(255,255,255,0.12)",
                  fontSize: 20,
                  letterSpacing: 2,
                  textAlign: "center",
                  wordBreak: "break-word",
                }}
              >
                {roomId}
              </div>
            </div>

            <div style={{ display: "grid", gap: 8 }}>
              <input
                type="text"
                placeholder="Invite username"
                value={inviteTarget}
                onChange={(e) => setInviteTarget(e.target.value)}
                style={{
                  width: "100%",
                  padding: 10,
                  borderRadius: 10,
                  border: "none",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />

              <button type="button" onClick={handleSendInvite}>
                Send Invite
              </button>

              {inviteStatus && (
                <div style={{ opacity: 0.9 }}>{inviteStatus}</div>
              )}
            </div>
          </div>

          {/* Bottom Back button */}
          <div
            style={{
              position: "fixed",
              left: 0,
              right: 0,
              bottom: 0,
              padding: 12,
              boxSizing: "border-box",
              zIndex: 9999,
            }}
          >
            <button
              type="button"
              onClick={() => {
                // go back to lobby home buttons
                setScreen("lobby");
                setLobbyMode("home");
              }}
              style={{
                width: "min(700px, 92vw)",
                margin: "0 auto",
                display: "block",
              }}
            >
              Back
            </button>
          </div>
        </div>
      )}

      {/* Game Dialog */}
      <GameDialog
        dialog={dialog}
        isWaitingForSecondPlayer={false}
        onClose={() => setDialog((d) => ({ ...d, open: false }))}
      />

      {/* Game Canvas */}
      {screen === "game" && connected && (
        <div style={{ position: "relative", width: "100vw", height: "100vh" }}>
          <GameCanvas
            network={network}
            role={role}
            world={world}
            puzzleState={puzzleState}
            objects={objects}
            playerPositions={playerPositions}
          />

          {/* Game Controls Overlay */}
          <div
            style={{
              position: "absolute",
              top: "20px",
              left: "0",
              right: "0",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: "1rem",
              zIndex: 1000,
              pointerEvents: "none",
            }}
          >
            <button
              onClick={togglePause}
              style={{
                padding: "12px 20px",
                fontSize: "20px",
                fontWeight: "bold",
                backgroundColor: isPaused ? "#4A9A4A" : "#FFD700",
                color: "white",
                border: "4px solid",
                borderColor: isPaused ? "#2D5A2D" : "#FF8C42",
                borderRadius: "12px",
                cursor: "pointer",
                boxShadow:
                  "0 4px 0 rgba(0,0,0,0.3), 0 6px 15px rgba(0,0,0,0.4)",
                transition: "all 0.2s ease",
                pointerEvents: "auto",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span style={{ fontSize: "24px" }}>{isPaused ? "▶️" : "⏸️"}</span>
              <span>{isPaused ? "RESUME" : "PAUSE"}</span>
            </button>

            <button
              onClick={handleBackFromGame}
              style={{
                padding: "12px 20px",
                fontSize: "20px",
                fontWeight: "bold",
                backgroundColor: "#3498DB",
                color: "white",
                border: "4px solid #1F6FA3",
                borderRadius: "12px",
                cursor: "pointer",
                boxShadow:
                  "0 4px 0 rgba(0,0,0,0.3), 0 6px 15px rgba(0,0,0,0.4)",
                transition: "all 0.2s ease",
                pointerEvents: "auto",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span>BACK</span>
            </button>

            <button
              onClick={handleExitGame}
              style={{
                padding: "12px 20px",
                fontSize: "20px",
                fontWeight: "bold",
                backgroundColor: "#E74C3C",
                color: "white",
                border: "4px solid #C0392B",
                borderRadius: "12px",
                cursor: "pointer",
                boxShadow:
                  "0 4px 0 rgba(0,0,0,0.3), 0 6px 15px rgba(0,0,0,0.4)",
                transition: "all 0.2s ease",
                pointerEvents: "auto",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span style={{ fontSize: "24px" }}>🚪</span>
              <span>EXIT</span>
            </button>
          </div>

          {isPaused && (
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: "rgba(0, 0, 0, 0.7)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                zIndex: 999,
                backdropFilter: "blur(5px)",
              }}
            >
              <h1
                style={{
                  fontSize: "72px",
                  fontWeight: 900,
                  color: "white",
                  textShadow: "4px 4px 0 rgba(0,0,0,0.5)",
                  marginBottom: "2rem",
                }}
              >
                ⏸️ PAUSED
              </h1>
              <p
                style={{
                  fontSize: "24px",
                  color: "white",
                  textShadow: "2px 2px 0 rgba(0,0,0,0.5)",
                }}
              >
                Click RESUME to continue playing
              </p>
            </div>
          )}
        </div>
      )}

      {/* Status Bar */}
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
