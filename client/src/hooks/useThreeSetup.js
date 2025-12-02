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

    const container = containerRef.current;
    if (container) container.appendChild(renderer.domElement);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(10, 20, 10);
    dirLight.castShadow = true;
    scene.add(dirLight);

    const ambient = new THREE.AmbientLight(0xffffff, 0.35);
    scene.add(ambient);

    const cleanupFns = [];
    let disposed = false;

    const init = async () => {
      const platforms = await loadAllLevels(scene, role);
      if (!platforms || disposed) return;

      const blocks = {};
      platforms.forEach((p, idx) => {
        if (p.userData && p.userData.isPushable) {
          const id = p.userData.id || `block-${idx}`;
          blocks[id] = p;
        }
      });

      const remotePlayer = new THREE.Mesh(
        new THREE.BoxGeometry(2, 2, 2),
        new THREE.MeshStandardMaterial({ color: 0x777777 })
      );
      remotePlayer.position.set(2, 3, 0);
      remotePlayer.castShadow = true;
      scene.add(remotePlayer);

      const spawnPos = new THREE.Vector3(0, 3, 0);

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
        cameraOffset: threeRef.current.cameraOffset || new THREE.Vector3(14, 18, 14),
      };

      if (network) {
        const moveHandler = ({ position }) => {
          const { remotePlayer: rp } = threeRef.current;
          if (!rp) return;
          rp.position.set(position.x, position.y, position.z);
        };
        network.on("remotePlayerMove", moveHandler);
        cleanupFns.push(() => network.off?.("remotePlayerMove", moveHandler));

        const objectHandler = ({ objectId, state }) => {
          const { blocks: blk } = threeRef.current;
          const mesh = blk?.[objectId];
          if (!mesh || !state) return;
          mesh.position.set(state.x, state.y, state.z);
        };
        network.on("objectUpdated", objectHandler);
        cleanupFns.push(() => network.off?.("objectUpdated", objectHandler));
      }

      const clock = new THREE.Clock();

      const animate = () => {
        const { renderer: r, scene: s, camera: c, player: pl, cameraOffset: co } =
          threeRef.current;
        if (!r || !s || !c || !pl) {
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

        pl.update(delta);
        if (network) {
          const p = pl.mesh.position;
          network.sendPlayerMove({ x: p.x, y: p.y, z: p.z });
        }

        c.position.copy(pl.mesh.position).add(co);
        c.lookAt(pl.mesh.position);

        r.render(s, c);
        threeRef.current.animationId = requestAnimationFrame(animate);
      };

      animate();
    };

    init();

    const onResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const aspectNew = w / h;
      const { camera: cam, renderer: rend, zoom: zm } = threeRef.current;
      if (!cam || !rend) return;

      cam.left = -aspectNew * zm;
      cam.right = aspectNew * zm;
      cam.top = zm;
      cam.bottom = -zm;
      cam.updateProjectionMatrix();
      rend.setSize(w, h);
    };

    window.addEventListener("resize", onResize);

    return () => {
      disposed = true;
      cancelAnimationFrame(threeRef.current.animationId);
      window.removeEventListener("resize", onResize);
      cleanupFns.forEach((fn) => fn && fn());
      renderer.dispose();
      if (container?.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [containerRef, threeRef, network, role]);
}
