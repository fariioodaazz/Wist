import { useEffect, useRef } from "react";
import * as THREE from "three";

export default function GameCanvas({
  network,
  role,
  world,
  puzzleState,
  objects,
  playerPositions,
}) {
  const containerRef = useRef(null);

  // Store Three.js objects & block meshes
  const threeRef = useRef({
    scene: null,
    camera: null,
    renderer: null,
    localPlayer: null,
    remotePlayer: null,
    blocks: {}, // { blockId: THREE.Mesh }
    animationId: null,
  });

  const keysRef = useRef({});
  const positionRef = useRef({ x: 0, y: 0.5, z: 0 });

  // ───────────────────────────
  // 1) Init Three.js scene once
  // ───────────────────────────
  useEffect(() => {
    const width = window.innerWidth;
    const height = window.innerHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x202030);

    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 100);
    camera.position.set(0, 3, 6);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    const container = containerRef.current;
    if (container) container.appendChild(renderer.domElement);

    // Lights
    const ambient = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambient);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(5, 10, 5);
    dirLight.castShadow = true;
    scene.add(dirLight);

    // Ground
    const groundGeo = new THREE.PlaneGeometry(20, 20);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Local player cube
    const localPlayer = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial()
    );
    localPlayer.position.set(0, 0.5, 0);
    localPlayer.castShadow = true;
    scene.add(localPlayer);

    // Remote player cube
    const remotePlayer = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial()
    );
    remotePlayer.position.set(2, 0.5, 0);
    remotePlayer.castShadow = true;
    scene.add(remotePlayer);

    threeRef.current = {
      scene,
      camera,
      renderer,
      localPlayer,
      remotePlayer,
      blocks: {},
      animationId: null,
    };

    // Keyboard
    const handleKeyDown = (e) => {
      keysRef.current[e.key.toLowerCase()] = true;
    };
    const handleKeyUp = (e) => {
      keysRef.current[e.key.toLowerCase()] = false;
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    // Resize
    const onResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    // Network: remote movement
    if (network) {
      network.on("remotePlayerMove", ({ position }) => {
        const { remotePlayer } = threeRef.current;
        if (!remotePlayer) return;
        remotePlayer.position.set(position.x, position.y, position.z);
      });

      // Later: you can also listen to "objectUpdated" here to move blocks
      // network.on("objectUpdated", ({ objectId, state }) => { ... });
    }

    // Animation loop
    const clock = new THREE.Clock();

    const animate = () => {
      const { renderer, scene, camera, localPlayer } = threeRef.current;
      if (!renderer || !scene || !camera || !localPlayer) {
        threeRef.current.animationId = requestAnimationFrame(animate);
        return;
      }

      const delta = clock.getDelta();
      const speed = 3;
      let moved = false;

      const keys = keysRef.current;
      if (keys["a"]) {
        localPlayer.position.x -= speed * delta;
        moved = true;
      }
      if (keys["d"]) {
        localPlayer.position.x += speed * delta;
        moved = true;
      }
      if (keys["w"]) {
        localPlayer.position.z -= speed * delta;
        moved = true;
      }
      if (keys["s"]) {
        localPlayer.position.z += speed * delta;
        moved = true;
      }

      if (moved && network) {
        const p = localPlayer.position;
        positionRef.current = { x: p.x, y: p.y, z: p.z };
        network.sendPlayerMove(positionRef.current);
      }

      renderer.render(scene, camera);
      threeRef.current.animationId = requestAnimationFrame(animate);
    };

    animate();

    // Cleanup
    return () => {
      cancelAnimationFrame(threeRef.current.animationId);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      if (container?.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [network]);

  // ───────────────────────────
  // 2) Apply role-based colors (host/client)
  // ───────────────────────────
  useEffect(() => {
    const { localPlayer, remotePlayer } = threeRef.current;
    if (!localPlayer || !remotePlayer) return;

    let localHex = 0x777777;
    let remoteHex = 0x777777;

    if (role === "host") {
      localHex = 0xff5555; // host = red
      remoteHex = 0x55ffff; // client = cyan
    } else if (role === "client") {
      localHex = 0x55ffff; // client = cyan
      remoteHex = 0xff5555; // host = red
    }

    localPlayer.material.color.setHex(localHex);
    remotePlayer.material.color.setHex(remoteHex);
  }, [role]);

  // ───────────────────────────
  // 3) Reapply saved world state (spawnPoints + blocks + playerPositions)
  // ───────────────────────────
  useEffect(() => {
    const { scene, localPlayer, remotePlayer, blocks } = threeRef.current;
    if (!scene || !world) return;

    // 3.1 Player spawn positions from either playerPositions or world.spawnPoints
    if (localPlayer && remotePlayer && role) {

    // defaults
    let hostSpawn = world.spawnPoints?.host ?? { x: -2, y: 0.5, z: 0 };
    let clientSpawn = world.spawnPoints?.client ?? { x: 2, y: 0.5, z: 0 };

    // override from persistent server state (host/client fixed identity)
    if (playerPositions) {
        if (playerPositions.host) hostSpawn = playerPositions.host;
        if (playerPositions.client) clientSpawn = playerPositions.client;
    }

    // apply to scene based on MY role
    if (role === "host") {
        localPlayer.position.set(hostSpawn.x, hostSpawn.y, hostSpawn.z);
        remotePlayer.position.set(clientSpawn.x, clientSpawn.y, clientSpawn.z);
    } else {
        localPlayer.position.set(clientSpawn.x, clientSpawn.y, clientSpawn.z);
        remotePlayer.position.set(hostSpawn.x, hostSpawn.y, hostSpawn.z);
    }
    }


    // 3.2 Blocks from persisted objects OR static world.blocks
    const blockStates =
      (objects && Object.keys(objects).length > 0 && objects) ||
      (world && world.blocks) ||
      {};

    // Remove blocks that no longer exist
    Object.keys(blocks).forEach((id) => {
      if (!blockStates[id]) {
        scene.remove(blocks[id]);
        delete blocks[id];
      }
    });

    // Add or update blocks
    Object.entries(blockStates).forEach(([id, data]) => {
      const { x, y, z } = data;
      let mesh = blocks[id];

      if (!mesh) {
        mesh = new THREE.Mesh(
          new THREE.BoxGeometry(1, 1, 1),
          new THREE.MeshStandardMaterial({ color: 0x8888ff })
        );
        mesh.castShadow = true;
        scene.add(mesh);
        blocks[id] = mesh;
      }

      mesh.position.set(x, y, z);
    });

    // puzzleState can later be used to change visuals (e.g., filled holes)
  }, [world, role, puzzleState, objects, playerPositions, network]);

  return (
    <div
      ref={containerRef}
      style={{ width: "100vw", height: "100vh", overflow: "hidden" }}
    />
  );
}
