import { useEffect, useMemo, useRef, useState } from "react";
import GameCanvas from "./components/GameCanvas.jsx";
import { NetworkClient } from "./network/NetworkClient.js";

import GameDialog from "./components/GameDialog.jsx";
import GameStatusBar from "./components/GameStatusBar.jsx";
import MainMenu from "./components/MainMenu.jsx";
import "./components/Lobby.css";

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
  const [hasExitedGame, setHasExitedGame] = useState(false); // Track if user exited from an active game

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
      setHasExitedGame(false); // Reset flag when creating new game
      setInviteStatus("");
      setInviteTarget("");
    });

    // somebody joined (fires on both host + client)
    network.on("playerJoined", ({ roomId, players }) => {
      setPlayers(players);
      console.log("Joined room", roomId, "players:", players);

      // When second player joins, transition both to game
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

    // role assigned for client joining
    network.on("roleAssigned", ({ role }) => {
      setRole(role);
      setConnected(true);
      setHasExitedGame(false); // Reset flag when successfully joining
      // Client will transition to game when playerJoined event fires
    });

    network.on("createError", ({ message }) => {
      setDialog({
        open: true,
        title: "Create Error",
        message,
      });
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
      setDialog({
        open: true,
        title: "Invite Error",
        message,
      });
    });

    network.on("inviteSent", ({ invitedUsername }) => {
      setInviteStatus(`Invite sent to ${invitedUsername}`);
      setInviteTarget("");
      refreshInvites();
    });

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
    setScreen("lobby");
  };

  const handleBackToMainMenu = () => {
    // Disconnect if connected
    if (connected) {
      network.disconnect();
    }

    // Reset all state
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


  const handleExitGame = () => {
    // Store the current room ID before disconnecting (so user can rejoin)
    const currentRoomId = roomId;
    const isHostExit = role === "host";

    if (isHostExit) {
      network.exitGame();
      // Disconnect from the network
      network.disconnect();

      // Reset game state but keep room info for rejoining
      setScreen("lobby");
      setConnected(false);
      setRole(null);
      // Keep roomId in input so user can easily rejoin
      setRoomIdInput("");
      setRoomId("");
      setIsPaused(false);
      setWorld(null);
      setPuzzleState(null);
      setObjects(null);
      setPlayerPositions(null);
      setPlayers({ host: null, client: null });
      // Mark that user exited from an active game
      setHasExitedGame(false);
      return;
    }

    // Client exit just goes back without closing the room
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

      {/* Lobby - Create or Join */}
      {screen === "lobby" && (
        <div className="lobby-container">
          {/* Decorative clouds */}
          <div className="lobby-clouds">
            <div className="lobby-cloud lobby-cloud-1"></div>
            <div className="lobby-cloud lobby-cloud-2"></div>
            <div className="lobby-cloud lobby-cloud-3"></div>
          </div>

          {/* Floating decorative elements */}
          <div style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: 5
          }}>
            <div style={{
              position: 'absolute',
              top: '15%',
              left: '10%',
              fontSize: '48px',
              animation: 'float 4s ease-in-out infinite',
              animationDelay: '0s'
            }}>🎲</div>
            <div style={{
              position: 'absolute',
              top: '70%',
              right: '15%',
              fontSize: '42px',
              animation: 'float 3.5s ease-in-out infinite',
              animationDelay: '1s'
            }}>🎯</div>
            <div style={{
              position: 'absolute',
              bottom: '20%',
              left: '12%',
              fontSize: '38px',
              animation: 'float 4.5s ease-in-out infinite',
              animationDelay: '0.5s'
            }}>🏆</div>
            <div style={{
              position: 'absolute',
              top: '25%',
              right: '12%',
              fontSize: '45px',
              animation: 'float 3.8s ease-in-out infinite',
              animationDelay: '2s'
            }}>⚡</div>
          </div>

          <div className="lobby-box">
            <h1 className="lobby-title">Choose Players</h1>


            {user && (
              <div className="lobby-profile">
                <div className="lobby-profile-title">Profile</div>
                <div className="lobby-profile-row">User: {user.username}</div>
              </div>
            )}

            {invites.length > 0 && (
              <div className="lobby-section">
                <div className="lobby-section-title">Invites</div>
                <div className="lobby-list">
                  {invites.map((invite) => (
                    <div className="lobby-list-row" key={invite.room_id}>
                      <div className="lobby-chip">
                        Room {invite.room_id} • Host{" "}
                        {invite.host_username || invite.host_user_id}
                      </div>
                      <button
                        className="lobby-small-button"
                        onClick={() => handleAcceptInvite(invite.room_id)}
                      >
                        Accept
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeGames.length > 0 && (
              <div className="lobby-section">
                <div className="lobby-section-title">Active Games</div>
                <div className="lobby-list">
                  {activeGames.map((game) => (
                    <div className="lobby-list-row" key={game.room_id}>
                      <div className="lobby-chip">
                        Room {game.room_id} •{" "}
                        {game.opponent_username || "Waiting"}{" "}
                        {getGameLevel(game) ? `(Level ${getGameLevel(game)})` : ""}
                      </div>
                      <button
                        className="lobby-small-button"
                        onClick={() => handleRejoinGame(game.room_id)}
                      >
                        Rejoin
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}


            {hasExitedGame && roomIdInput && (
              <div style={{
                background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
                padding: '1rem',
                borderRadius: '12px',
                marginBottom: '1.5rem',
                border: '4px solid #FF8C42',
                boxShadow: '0 4px 0 #CC7000, 0 6px 15px rgba(0,0,0,0.3)'
              }}>
                <p style={{
                  margin: 0,
                  color: 'white',
                  fontWeight: 'bold',
                  fontSize: '18px',
                  textShadow: '2px 2px 0 rgba(0,0,0,0.3)'
                }}>
                  💾 Ready to rejoin: {roomIdInput}
                </p>
              </div>
            )}

            <button onClick={handleCreate} className="lobby-button create-button">
              🎮 Create New Game 🎮
            </button>

            <div className="lobby-divider">OR</div>

            <input
              type="text"
              placeholder="Room Code"
              value={roomIdInput}
              onChange={(e) => setRoomIdInput(e.target.value)}
              className="lobby-input"
            />

            <button onClick={handleJoin} className="lobby-button join-button">
              {hasExitedGame && roomIdInput ? '🔄 Rejoin Game 🔄' : '🚀 Join Game 🚀'}
            </button>

            <button onClick={handleBackToMainMenu} className="lobby-button back-button">
              ← Back
            </button>
          </div>
        </div>
      )}

      {/* Waiting Screen - Host waits for player 2 */}
      {screen === "waiting" && (
        <div className="waiting-container">
          {/* Decorative clouds */}
          <div className="lobby-clouds">
            <div className="lobby-cloud lobby-cloud-1"></div>
            <div className="lobby-cloud lobby-cloud-2"></div>
            <div className="lobby-cloud lobby-cloud-3"></div>
          </div>

          <div className="waiting-box">
            <h2 className="waiting-title">Waiting for Player 2...</h2>

            <div className="room-code-display">
              <p className="room-code-label">Share this code with your friend:</p>
              <p className="room-code-text">{roomId}</p>
            </div>

            <div className="waiting-invite">
              <input
                type="text"
                placeholder="Invite username"
                value={inviteTarget}
                onChange={(e) => setInviteTarget(e.target.value)}
                className="lobby-input waiting-invite-input"
              />
              <button
                className="lobby-button join-button"
                onClick={handleSendInvite}
              >
                Send Invite
              </button>
              {inviteStatus && (
                <div className="waiting-invite-status">{inviteStatus}</div>
              )}
            </div>

            </div>

            <div className="waiting-icon">⏳</div>
            <p className="waiting-message">Game will start when both players are ready</p>
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
        <div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
          <GameCanvas
            network={network}
            role={role}
            world={world}
            puzzleState={puzzleState}
            objects={objects}
            playerPositions={playerPositions}
          />

          {/* Game Controls Overlay */}
          <div style={{
            position: 'absolute',
            top: '20px',
            left: '0',
            right: '0',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '1rem',
            zIndex: 1000,
            pointerEvents: 'none'
          }}>
            {/* Pause/Play Button */}
            <button
              onClick={togglePause}
              style={{
                padding: '12px 20px',
                fontSize: '20px',
                fontWeight: 'bold',
                backgroundColor: isPaused ? '#4A9A4A' : '#FFD700',
                color: 'white',
                border: '4px solid',
                borderColor: isPaused ? '#2D5A2D' : '#FF8C42',
                borderRadius: '12px',
                cursor: 'pointer',
                boxShadow: '0 4px 0 rgba(0,0,0,0.3), 0 6px 15px rgba(0,0,0,0.4)',
                transition: 'all 0.2s ease',
                pointerEvents: 'auto',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
              onMouseEnter={(e) => {
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = '0 6px 0 rgba(0,0,0,0.3), 0 8px 20px rgba(0,0,0,0.5)';
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = '0 4px 0 rgba(0,0,0,0.3), 0 6px 15px rgba(0,0,0,0.4)';
              }}
            >
              <span style={{ fontSize: '24px' }}>{isPaused ? '▶️' : '⏸️'}</span>
              <span>{isPaused ? 'RESUME' : 'PAUSE'}</span>
            </button>

            {/* Back Button */}
            <button
              onClick={handleBackFromGame}
              style={{
                padding: '12px 20px',
                fontSize: '20px',
                fontWeight: 'bold',
                backgroundColor: '#3498DB',
                color: 'white',
                border: '4px solid #1F6FA3',
                borderRadius: '12px',
                cursor: 'pointer',
                boxShadow: '0 4px 0 rgba(0,0,0,0.3), 0 6px 15px rgba(0,0,0,0.4)',
                transition: 'all 0.2s ease',
                pointerEvents: 'auto',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
              onMouseEnter={(e) => {
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = '0 6px 0 rgba(0,0,0,0.3), 0 8px 20px rgba(0,0,0,0.5)';
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = '0 4px 0 rgba(0,0,0,0.3), 0 6px 15px rgba(0,0,0,0.4)';
              }}
            >
              <span>BACK</span>
            </button>

            {/* Exit/Back Button */}
            <button
              onClick={handleExitGame}
              style={{
                padding: '12px 20px',
                fontSize: '20px',
                fontWeight: 'bold',
                backgroundColor: '#E74C3C',
                color: 'white',
                border: '4px solid #C0392B',
                borderRadius: '12px',
                cursor: 'pointer',
                boxShadow: '0 4px 0 rgba(0,0,0,0.3), 0 6px 15px rgba(0,0,0,0.4)',
                transition: 'all 0.2s ease',
                pointerEvents: 'auto',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
              onMouseEnter={(e) => {
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = '0 6px 0 rgba(0,0,0,0.3), 0 8px 20px rgba(0,0,0,0.5)';
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = '0 4px 0 rgba(0,0,0,0.3), 0 6px 15px rgba(0,0,0,0.4)';
              }}
            >
              <span style={{ fontSize: '24px' }}>🚪</span>
              <span>EXIT</span>
            </button>
          </div>

          {/* Pause Overlay */}
          {isPaused && (
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 999,
              backdropFilter: 'blur(5px)'
            }}>
              <h1 style={{
                fontSize: '72px',
                fontWeight: 900,
                color: 'white',
                textShadow: '4px 4px 0 rgba(0,0,0,0.5)',
                marginBottom: '2rem'
              }}>
                ⏸️ PAUSED
              </h1>
              <p style={{
                fontSize: '24px',
                color: 'white',
                textShadow: '2px 2px 0 rgba(0,0,0,0.5)'
              }}>
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
