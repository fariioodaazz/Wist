// components/LobbyControls.jsx
export default function LobbyControls({
  connected,
  roomIdInput,
  onRoomIdChange,
  onCreate,
  onJoin,
}) {
  if (connected) return null;

  return (
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
      <button onClick={onCreate}>Create Game</button>
      <input
        placeholder="Room ID"
        value={roomIdInput}
        onChange={(e) => onRoomIdChange(e.target.value)}
        style={{ padding: "4px 8px" }}
      />
      <button onClick={onJoin}>Join Game</button>
    </div>
  );
}
