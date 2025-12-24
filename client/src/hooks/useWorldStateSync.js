// hooks/useWorldStateSync.js
import { useEffect, useRef } from "react";
import * as THREE from "three";

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

export function useWorldStateSync({
  world,
  role,
  puzzleState,
  objects,
  playerPositions,
  threeRef,
}) {
  const lastRespawnTokenRef = useRef(null);

  useEffect(() => {
    const { scene, player, remotePlayer, blocks } = threeRef.current || {};
    if (!scene || !world || !player || !remotePlayer || !role || !puzzleState) {
      return;
    }

    const token = puzzleState?.respawnToken;

    // Only respawn when token changes (ignore first render)
    if (!token) return;
    if (lastRespawnTokenRef.current === token) return;
    lastRespawnTokenRef.current = token;

    // ✅ Use current puzzleState.level to decide where to respawn,
    // but DO NOT trigger the effect when level changes.
    const level = puzzleState.level ?? 1;
    const spawns = LEVEL_SPAWNS[level] || LEVEL_SPAWNS[1];

    const hostSpawn = spawns.host;
    const clientSpawn = spawns.client;

    if (role === "host") {
      player.mesh.position.set(hostSpawn.x, hostSpawn.y, hostSpawn.z);
      remotePlayer.position.set(clientSpawn.x, clientSpawn.y, clientSpawn.z);
    } else {
      player.mesh.position.set(clientSpawn.x, clientSpawn.y, clientSpawn.z);
      remotePlayer.position.set(hostSpawn.x, hostSpawn.y, hostSpawn.z);
    }

    // Reset local physics so you don't keep falling after respawn
    if (player.velocity) {
      player.velocity.set(0, 0, 0);
    }
    player.onGround = false;

    // Reset blocks on respawn ONLY
    if (blocks) {
      Object.values(blocks).forEach((blockMesh) => {
        const init = blockMesh.userData?.initialPosition;
        if (init) {
          blockMesh.position.copy(init);

          // If this client is the "authoritative" one, sync it to others
          if (role === "host" && player.network && blockMesh.userData.id) {
            player.network.sendObjectUpdate(blockMesh.userData.id, {
              x: blockMesh.position.x,
              y: blockMesh.position.y,
              z: blockMesh.position.z,
            });
          }
        }
      });
    }
  }, [world, role, threeRef, puzzleState?.respawnToken]);
}
