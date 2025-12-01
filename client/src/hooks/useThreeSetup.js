// hooks/useThreeSetup.js
import { useEffect } from "react";
import * as THREE from "three";

import Player from "../components/player/Player.js";
import { loadAllLevels } from "../components/Levels.js";

export function useThreeSetup({ containerRef, threeRef, network, role }) {
  useEffect(() => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const aspect = width / height;
    const zoom = 14;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x222222);

    // Orthographic isometric camera
    const camera = new THREE.OrthographicCamera(
      -aspect * zoom,
      aspect * zoom,
      zoom,
      -zoom,
      -200,
      200
    );

    camera.position.set(14, 18, 14);
    camera.rotation.order = "YXZ";
    camera.rotation.y = Math.PI / 4;
    camera.rotation.x = Math.atan(Math.sqrt(2)) * 0.9;
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const container = containerRef.current;
    if (container) container.appendChild(renderer.domElement);

    // Lights
    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(10, 20, -10);
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.castShadow = true;
    const cam = dirLight.shadow.camera;
    cam.near = 1;
    cam.far = 100;
    cam.left = -50;
    cam.right = 50;
    cam.top = 50;
    cam.bottom = -50;
    cam.updateProjectionMatrix();
    scene.add(dirLight);

    const ambient = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(ambient);

    // Load all levels (platforms array)
    const platforms = loadAllLevels(scene);
    const blocks = {};
    platforms.forEach((p, idx) => {
      if (p.userData && p.userData.isPushable) {
        const id = p.userData.id || `block-${idx}`;
        blocks[id] = p;
      }
    });

    // Remote player cube
    const remotePlayer = new THREE.Mesh(
      new THREE.BoxGeometry(2, 2, 2),
      new THREE.MeshStandardMaterial({ color: 0x777777 })
    );
    remotePlayer.position.set(2, 3, 0);
    remotePlayer.castShadow = true;
    remotePlayer.receiveShadow = true;
    scene.add(remotePlayer);

    // Initial spawn (can be overridden later by world/playerPositions effect)
    const spawnPos = new THREE.Vector3(0, 3, 0);

    // Local Player using your Player class
    const player = new Player(scene, platforms, {
      position: spawnPos,
      speed: 10,
      jumpSpeed: 24,
      gravity: -50,
      network,
      otherPlayer: remotePlayer,
      role,
    });

    threeRef.current = {
      ...threeRef.current,
      scene,
      camera,
      renderer,
      player,
      remotePlayer,
      platforms,
      blocks,
      zoom,
    };

    // Network: remote movement & object updates
    if (network) {
      network.on("remotePlayerMove", ({ position }) => {
        const { remotePlayer } = threeRef.current;
        if (!remotePlayer) return;
        remotePlayer.position.set(position.x, position.y, position.z);
      });

      network.on("objectUpdated", ({ objectId, state }) => {
        const { blocks } = threeRef.current;
        const mesh = blocks[objectId];
        if (!mesh || !state) return;
        mesh.position.set(state.x, state.y, state.z);
      });
    }

    // Animation loop
    const clock = new THREE.Clock();

    const animate = () => {
      const { renderer, scene, camera, player, cameraOffset } =
        threeRef.current;
      if (!renderer || !scene || !camera || !player) {
        threeRef.current.animationId = requestAnimationFrame(animate);
        return;
      }

      let delta = clock.getDelta();
      const MAX_DELTA = 0.05;
      if (delta > MAX_DELTA) delta = MAX_DELTA;
      if (delta <= 0) {
        threeRef.current.animationId = requestAnimationFrame(animate);
        return;
      }

      player.update(delta);
      if (network) {
        const p = player.mesh.position;
        network.sendPlayerMove({ x: p.x, y: p.y, z: p.z });
      }

      // Isometric camera follow
      camera.position.copy(player.mesh.position).add(cameraOffset);
      camera.lookAt(player.mesh.position);

      renderer.render(scene, camera);
      threeRef.current.animationId = requestAnimationFrame(animate);
    };

    animate();

    // Resize
    const onResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const aspect = w / h;
      const { camera, renderer, zoom } = threeRef.current;
      if (!camera || !renderer) return;

      camera.left = -aspect * zoom;
      camera.right = aspect * zoom;
      camera.top = zoom;
      camera.bottom = -zoom;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    // Cleanup
    return () => {
      cancelAnimationFrame(threeRef.current.animationId);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      if (container?.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [containerRef, threeRef, network]);
}
