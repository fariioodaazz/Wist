// client/src/components/MainMenu.jsx
import React from "react";
import "./MainMenu.css";

export default function MainMenu({
  onPlay,
  user,
  authMode,
  authForm,
  authError,
  onAuthChange,
  onAuthSubmit,
  onToggleAuthMode,
  onLogout,
}) {
  return (
    <div className="main-menu">
      <div className="menu-background">
        {/* Animated background elements */}
        <div className="bg-clouds">
          <div className="cloud cloud-1"></div>
          <div className="cloud cloud-2"></div>
          <div className="cloud cloud-3"></div>
        </div>

        {/* Game title */}
        <div className="game-title">
          <h1 className="title-text">WIST</h1>
          <p className="subtitle"></p>
        </div>

        {/* Menu buttons */}
        <div className="menu-buttons">
          <button
            className={`menu-btn play-btn ${!user ? "menu-btn-disabled" : ""}`}
            onClick={onPlay}
            disabled={!user}
          >
            <span className="btn-text">PLAY</span>
          </button>
        </div>

        {/* Auth panel */}
        <div className="auth-panel">
          {user ? (
            <>
              <div className="auth-title">Welcome, {user.username}</div>
              <div className="auth-actions">
                <button className="menu-btn auth-btn" onClick={onPlay}>
                  <span className="btn-text">CONTINUE</span>
                </button>
                <button className="menu-btn auth-secondary" onClick={onLogout}>
                  <span className="btn-text">LOGOUT</span>
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="auth-title">
                {authMode === "login" ? "Login" : "Register"}
              </div>
              <div className="auth-fields">
                <input
                  className="auth-input"
                  type="text"
                  placeholder="Username"
                  value={authForm.username}
                  onChange={(e) =>
                    onAuthChange({ ...authForm, username: e.target.value })
                  }
                />
                <input
                  className="auth-input"
                  type="password"
                  placeholder="Password"
                  value={authForm.password}
                  onChange={(e) =>
                    onAuthChange({ ...authForm, password: e.target.value })
                  }
                />
              </div>
              {authError && <div className="auth-error">{authError}</div>}
              <div className="auth-actions">
                <button className="menu-btn auth-btn" onClick={onAuthSubmit}>
                  <span className="btn-text">
                    {authMode === "login" ? "LOGIN" : "REGISTER"}
                  </span>
                </button>
                <button className="auth-toggle" onClick={onToggleAuthMode}>
                  {authMode === "login"
                    ? "Need an account? Register"
                    : "Have an account? Login"}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Decorative elements */}
        <div className="menu-decorations">
          <div className="crystal-glow crystal-left"></div>
          <div className="crystal-glow crystal-right"></div>
        </div>
      </div>
    </div>
  );
}
