// GameCanvas.jsx
import { useRef } from "react";
import * as THREE from "three";

import { useThreeSetup } from "../hooks/useThreeSetup.js";
import { useRoleSetup } from "../hooks/useRoleSetup.js";
import { useWorldStateSync } from "../hooks/useWorldStateSync.js";
import { useRoleAudio } from "../hooks/useRoleAudio.js";

export default function GameCanvas({
  network,
  role,
  world,
  puzzleState,
  objects,
  playerPositions,
}) {
  const containerRef = useRef(null);

  const threeRef = useRef({
    scene: null,
    camera: null,
    renderer: null,
    player: null,
    remotePlayer: null,
    blocks: {},
    animationId: null,
    zoom: 14,
    cameraOffset: new THREE.Vector3(14, 18, 14),
    platforms: [],
  });

  useThreeSetup({ containerRef, threeRef, network, role });

  useRoleSetup({ role, threeRef });

  useWorldStateSync({
    world,
    role,
    puzzleState,
    objects,
    playerPositions,
    threeRef,
  });

  useRoleAudio({ role, world });

  return (
    <div
      ref={containerRef}
      style={{ width: "100vw", height: "100vh", overflow: "hidden" }}
    />
  );
}
