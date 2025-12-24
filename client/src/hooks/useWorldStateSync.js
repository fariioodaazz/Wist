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

  // when changing rooms / rejoining, allow initial placement + respawn logic to run again
  useEffect(() => {
    lastRespawnTokenRef.current = null;
    didInitialPlacementRef.current = false;
  }, [roomId]);

  // Run once when room state is available to place players correctly.
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
      player.mesh.position.set(hostFinal.x, hostFinal.y, hostFinal.z);
      remotePlayer.position.set(clientFinal.x, clientFinal.y, clientFinal.z);
    } else {
      player.mesh.position.set(clientFinal.x, clientFinal.y, clientFinal.z);
      remotePlayer.position.set(hostFinal.x, hostFinal.y, hostFinal.z);
    }

    resetLocalPhysics(player);

    didInitialPlacementRef.current = true;
  }, [world, role, puzzleState, playerPositions, threeRef]);

  // Trigger when respawnToken changes.
  useEffect(() => {
    const { scene, player, remotePlayer, blocks } = threeRef.current || {};
    if (!scene || !world || !player || !remotePlayer || !role || !puzzleState)
      return;

    const token = puzzleState?.respawnToken;

    // Only respawn when token exists and changes
    if (!token) return;
    if (lastRespawnTokenRef.current === token) return;
    lastRespawnTokenRef.current = token;

    const level = puzzleState.level ?? 1;
    const spawns = getSpawnsForLevel(level);

    const hostSpawn = spawns.host;
    const clientSpawn = spawns.client;

    if (role === "host") {
      player.mesh.position.set(hostSpawn.x, hostSpawn.y, hostSpawn.z);
      remotePlayer.position.set(clientSpawn.x, clientSpawn.y, clientSpawn.z);
    } else {
      player.mesh.position.set(clientSpawn.x, clientSpawn.y, clientSpawn.z);
      remotePlayer.position.set(hostSpawn.x, hostSpawn.y, hostSpawn.z);
    }

    resetLocalPhysics(player);

    // Reset blocks on respawn
    if (blocks) {
      Object.values(blocks).forEach((blockMesh) => {
        const init = blockMesh.userData?.initialPosition;
        if (!init) return;

        blockMesh.position.copy(init);

        // If host is authoritative, sync reset to others
        if (role === "host" && player.network && blockMesh.userData?.id) {
          player.network.sendObjectUpdate(blockMesh.userData.id, {
            x: blockMesh.position.x,
            y: blockMesh.position.y,
            z: blockMesh.position.z,
          });
        }
      });
    }
  }, [world, role, threeRef, puzzleState?.respawnToken]);
}
