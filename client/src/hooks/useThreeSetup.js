// hooks/useThreeSetup.js
import { useEffect } from "react";
import * as THREE from "three";

import Player from "../components/player/Player.js";
import { loadAllLevels } from "../components/Levels.js";

import momUrl from "../assets/Models/mom.glb";
import urotsukiUrl from "../assets/Models/urotsuki.glb";

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

    // Load levels/platforms
    const platforms = loadAllLevels(scene, role);
    const blocks = {};
    platforms.forEach((p, idx) => {
      if (p.userData && p.userData.isPushable) {
        const id = p.userData.id || `block-${idx}`;
        blocks[id] = p;
      }
    });

    // Spawns
    const spawnPos = new THREE.Vector3(0, 3, 0);
    const remoteSpawn = new THREE.Vector3(2, 3, 0);

    // Camera follow offset (must exist for your follow code)
    const cameraOffset = new THREE.Vector3(14, 18, 14);

    // Role-based models:
    // host => mom, client => urotsuki
    const localModelUrl = role === "host" ? momUrl : urotsukiUrl;
    const remoteRole = role === "host" ? "client" : "host";
    const remoteModelUrl = remoteRole === "host" ? momUrl : urotsukiUrl;

    // Remote avatar as Player instance (NO physics update, only mixer + position from network)
    const remotePlayer = new Player(scene, platforms, {
      position: remoteSpawn,
      speed: 0,
      jumpSpeed: 0,
      gravity: 0,
      network: null,
      otherPlayer: null,
      role: remoteRole,
      modelUrl: remoteModelUrl,
    });

    // Local player (full physics/input)
    const player = new Player(scene, platforms, {
      position: spawnPos,
      speed: 10,
      jumpSpeed: 24,
      gravity: -50,
      network,
      otherPlayer: remotePlayer.mesh, // collide vs remote avatar root
      role,
      modelUrl: localModelUrl,
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
      cameraOffset,
    };

    // Network handlers
    let lastRemotePos = new THREE.Vector3(
      remoteSpawn.x,
      remoteSpawn.y,
      remoteSpawn.z
    );

    if (network) {
      network.on("remotePlayerMove", ({ position }) => {
        const { remotePlayer } = threeRef.current;
        if (!remotePlayer) return;

        // Move remote avatar
        remotePlayer.mesh.position.set(position.x, position.y, position.z);

        // Walk/Idle based on movement
        const moved =
          remotePlayer.mesh.position.distanceToSquared(lastRemotePos) > 0.0001;

        if (moved) {
          // Prefer Walking, fallback to Idle/Rest if names differ
          if (remotePlayer.actions?.[remotePlayer.clipNames.walk]) {
            remotePlayer.fadeToAction(remotePlayer.clipNames.walk, 0.15);
          } else if (remotePlayer.actions?.["Walk"]) {
            remotePlayer.fadeToAction("Walk", 0.15);
          } else if (remotePlayer.actions?.[remotePlayer.clipNames.idle]) {
            remotePlayer.fadeToAction(remotePlayer.clipNames.idle, 0.15);
          }
        } else {
          if (remotePlayer.actions?.[remotePlayer.clipNames.idle]) {
            remotePlayer.fadeToAction(remotePlayer.clipNames.idle, 0.2);
          } else if (remotePlayer.actions?.[remotePlayer.clipNames.rest]) {
            remotePlayer.fadeToAction(remotePlayer.clipNames.rest, 0.2);
          }
        }

        // Face movement direction (optional but nice)
        if (moved) {
          const dx = remotePlayer.mesh.position.x - lastRemotePos.x;
          const dz = remotePlayer.mesh.position.z - lastRemotePos.z;
          if (dx * dx + dz * dz > 0.000001) {
            remotePlayer.mesh.rotation.y = Math.atan2(dx, dz);
          }
        }

        lastRemotePos.copy(remotePlayer.mesh.position);
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
      const { renderer, scene, camera, player, remotePlayer, cameraOffset } =
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

      // Local physics + local animations
      player.update(delta);

      // Remote animations ONLY (remote position comes from network handler)
      if (remotePlayer) remotePlayer.updateMixerOnly(delta);

      // Send local movement
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
      const a = w / h;
      const { camera, renderer, zoom } = threeRef.current;
      if (!camera || !renderer) return;

      camera.left = -a * zoom;
      camera.right = a * zoom;
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
  }, [containerRef, threeRef, network, role]);
}
