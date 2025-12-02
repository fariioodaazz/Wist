// client/src/components/MainMenu.jsx
import React from 'react';
import './MainMenu.css';

export default function MainMenu({ onPlay }) {
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
          <button className="menu-btn play-btn" onClick={onPlay}>
            <span className="btn-text">PLAY</span>
          </button>
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