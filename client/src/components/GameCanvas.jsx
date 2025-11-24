import { useEffect, useRef } from "react";
import * as THREE from "three";

export default function GameCanvas({ network }) {
  const containerRef = useRef(null);
  const threeRef = useRef({
    scene: null,
    camera: null,
    renderer: null,
    localPlayer: null,
    remotePlayer: null,
    animationId: null,
  });

  const keysRef = useRef({});
  const positionRef = useRef({ x: 0, y: 0.5, z: 0 });

  useEffect(() => {
    // ── Setup scene ──
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
      new THREE.MeshStandardMaterial({ color: 0xff5555 })
    );
    localPlayer.position.set(0, 0.5, 0);
    localPlayer.castShadow = true;
    scene.add(localPlayer);

    // Remote player cube
    const remotePlayer = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: 0x55ffff })
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
    };

    // ── Keyboard handling ──
    const handleKeyDown = (e) => {
      keysRef.current[e.key.toLowerCase()] = true;
    };
    const handleKeyUp = (e) => {
      keysRef.current[e.key.toLowerCase()] = false;
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    // ── Network: remote movement ──
    if (network) {
      network.on("remotePlayerMove", ({ position }) => {
        remotePlayer.position.set(position.x, position.y, position.z);
      });
    }

    // ── Resize ──
    const onResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    // ── Animation loop ──
    const clock = new THREE.Clock();

    const animate = () => {
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

    // ── Cleanup ──
    return () => {
      cancelAnimationFrame(threeRef.current.animationId);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      if (container && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [network]);


  return <div ref={containerRef} style={{ width: "100vw", height: "100vh" }} />;
}
