// components/GameStatusBar.jsx
export default function GameStatusBar({
  connected,
  network,
  role,
  playerCount,
}) {
  if (!connected) return null;

  return (
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
  );
}
