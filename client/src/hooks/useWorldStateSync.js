// hooks/useWorldStateSync.js
import { useEffect, useRef } from "react";

const LEVEL_SPAWNS = {
  1: {
    host: { x: -2, y: 3, z: 0 },
    client: { x: 2, y: 3, z: 0 },
  },
  2: {
    host: { x: -2, y: 3, z: -80 },
    client: { x: 2, y: 3, z: -80 },
  },
  3: {
    host: { x: -2, y: 3, z: -140 },
    client: { x: 2, y: 3, z: -140 },
  },
};

function getSpawnsForLevel(level) {
  const lvl = Number(level) || 1;
  return LEVEL_SPAWNS[lvl] || LEVEL_SPAWNS[1];
}

function resetLocalPhysics(player) {
  if (!player) return;
  if (player.velocity && typeof player.velocity.set === "function") {
    player.velocity.set(0, 0, 0);
  }
  player.onGround = false;
}

function setTargetPosition(target, x, y, z) {
  if (!target) return;

  // Player instance
  if (
    target.mesh &&
    target.mesh.position &&
    typeof target.mesh.position.set === "function"
  ) {
    target.mesh.position.set(x, y, z);
    return;
  }

  // THREE.Object3D (Mesh/Group)
  if (target.position && typeof target.position.set === "function") {
    target.position.set(x, y, z);
  }
}

function resetBreakable(mesh) {
  if (!mesh) return;

  const st = mesh.userData?.initialState;
  if (!st) return;

  mesh.position.copy(st.position);
  mesh.rotation.copy(st.rotation);
  mesh.scale.copy(st.scale);

  mesh.visible = st.visible ?? true;
  mesh.userData.broken = false;
}

export function useWorldStateSync({
  roomId,
  world,
  role,
  puzzleState,
  objects,
  playerPositions,
  threeRef,
}) {
  const lastRespawnTokenRef = useRef(null);
  const didInitialPlacementRef = useRef(false);

  useEffect(() => {
    lastRespawnTokenRef.current = null;
    didInitialPlacementRef.current = false;
  }, [roomId]);

  // Initial placement
  useEffect(() => {
    const { scene, player, remotePlayer } = threeRef.current || {};
    if (!scene || !world || !player || !remotePlayer || !role || !puzzleState)
      return;
    if (didInitialPlacementRef.current) return;

    const level = puzzleState.level ?? 1;
    const spawns = getSpawnsForLevel(level);

    const hostSaved = playerPositions?.host;
    const clientSaved = playerPositions?.client;

    const hostFinal = hostSaved ?? spawns.host;
    const clientFinal = clientSaved ?? spawns.client;

    if (role === "host") {
      setTargetPosition(player, hostFinal.x, hostFinal.y, hostFinal.z);
      setTargetPosition(
        remotePlayer,
        clientFinal.x,
        clientFinal.y,
        clientFinal.z
      );
    } else {
      setTargetPosition(player, clientFinal.x, clientFinal.y, clientFinal.z);
      setTargetPosition(remotePlayer, hostFinal.x, hostFinal.y, hostFinal.z);
    }

    resetLocalPhysics(player);
    didInitialPlacementRef.current = true;
  }, [world, role, puzzleState, playerPositions, threeRef]);

  // Respawn token handling
  useEffect(() => {
    const { scene, player, remotePlayer, blocks } = threeRef.current || {};
    if (!scene || !world || !player || !remotePlayer || !role || !puzzleState)
      return;

    const token = puzzleState?.respawnToken;

    if (!token) return;
    if (lastRespawnTokenRef.current === token) return;
    lastRespawnTokenRef.current = token;

    const level = puzzleState.level ?? 1;
    const spawns = getSpawnsForLevel(level);

    const hostSpawn = spawns.host;
    const clientSpawn = spawns.client;

    if (role === "host") {
      setTargetPosition(player, hostSpawn.x, hostSpawn.y, hostSpawn.z);
      setTargetPosition(
        remotePlayer,
        clientSpawn.x,
        clientSpawn.y,
        clientSpawn.z
      );
    } else {
      setTargetPosition(player, clientSpawn.x, clientSpawn.y, clientSpawn.z);
      setTargetPosition(remotePlayer, hostSpawn.x, hostSpawn.y, hostSpawn.z);
    }

    resetLocalPhysics(player);
    if (player.breakCooldown?.clear) player.breakCooldown.clear();
    // Reset blocks on respawn
    // Reset blocks on respawn
    if (blocks) {
      Object.values(blocks).forEach((blockMesh) => {
        const initPos =
          blockMesh.userData?.initialPosition ??
          blockMesh.userData?.initialState?.position;

        if (initPos) blockMesh.position.copy(initPos);

        // This will restore visible + broken=false using initialState
        resetBreakable(blockMesh);

        if (role === "host" && player.network && blockMesh.userData?.id) {
          player.network.sendObjectUpdate(blockMesh.userData.id, {
            x: blockMesh.position.x,
            y: blockMesh.position.y,
            z: blockMesh.position.z,
            broken: false,
            visible: true,
          });
        }
      });
    }
  }, [world, role, threeRef, puzzleState?.respawnToken]);
}
