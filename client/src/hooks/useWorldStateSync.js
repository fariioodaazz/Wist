// hooks/useWorldStateSync.js
import { useEffect } from "react";
import * as THREE from "three";

const LEVEL_SPAWNS = {
  1: {
    host: { x: -2, y: 3, z: 0 },
    client: { x: 2, y: 3, z: 0 },
  },
  2: {
    // 👇 adjust these to match where Level 2 actually starts in your scene
    host: { x: -2, y: 3, z: -50 },
    client: { x: 2, y: 3, z: -50 },
  },
  // 3: { ... } // you can add more levels later
};

export function useWorldStateSync({
  world,
  role,
  puzzleState,
  objects,
  playerPositions,
  threeRef,
}) {
  useEffect(() => {
    const { scene, player, remotePlayer, blocks } = threeRef.current || {};
    if (!scene || !world || !player || !remotePlayer || !role || !puzzleState) {
      return;
    }

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

    // If you later re-enable syncing blocks from `objects` / `world.blocks`,
    // you can move that commented block logic here and use `scene` & `blocks`.

    // Example placeholder for when you uncomment that logic:
    //
    // const blockStates =
    //   (objects && Object.keys(objects).length > 0 && objects) ||
    //   (world && world.blocks) ||
    //   {};
    //
    // Object.keys(blocks).forEach((id) => {
    //   if (!blockStates[id]) {
    //     scene.remove(blocks[id]);
    //     delete blocks[id];
    //   }
    // });
    //
    // Object.entries(blockStates).forEach(([id, data]) => {
    //   const { x, y, z } = data;
    //   let mesh = blocks[id];
    //
    //   if (!mesh) {
    //     mesh = new THREE.Mesh(
    //       new THREE.BoxGeometry(1, 1, 1),
    //       new THREE.MeshStandardMaterial({ color: 0x8888ff })
    //     );
    //     mesh.castShadow = true;
    //     scene.add(mesh);
    //     blocks[id] = mesh;
    //   }
    //
    //   mesh.position.set(x, y, z);
    // });

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
  }, [
    world,
    role,
    puzzleState,
    puzzleState?.level,
    puzzleState?.respawnToken,
    threeRef,
  ]);
}
