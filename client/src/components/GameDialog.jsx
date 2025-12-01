// components/GameDialog.jsx
export default function GameDialog({
  dialog,
  onClose,
  isWaitingForSecondPlayer,
}) {
  if (!dialog.open) return null;

  return (
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
              if (isWaitingForSecondPlayer) return;
              onClose();
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
  );
}
