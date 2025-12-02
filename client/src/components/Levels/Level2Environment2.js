// client/src/components/Levels/Level2Environment.js
import * as THREE from "three";
import { loadModel } from "../../utils/modelCache.js";

/**
 * Build Level 2 Environment with per-role mood
 * role: "host" => Mother (dark), "client" => Daughter (bright with nature)
 */
export async function buildLevel2Environment(scene, role = "host") {
  const envGroup = new THREE.Group();
  envGroup.name = "Level2Environment";
  const isMother = role === "host";

  try {
    console.log("Building Level 2 atmosphere for role:", role);

    // ============================================
    // BACKGROUND SETUP - neutral backdrop (no blue spill)
    // ============================================
    
    // Set scene background - this fills empty space
    scene.background = new THREE.Color(isMother ? 0x0b0b0f : 0xfff7e8);
    
    // Add fog for depth
    scene.fog = new THREE.Fog(
      isMother ? 0x0b0b0f : 0xfff7e8,
      isMother ? 20 : 40,
      isMother ? 50 : 120
    );

    // ============================================
    // PERIMETER ASSETS - Using available dungeon pieces (no nature GLBs)
    // ============================================
    console.log("Adding perimeter assets...");

    // Spread along z so the forward path is clear; add arches framing the path
    const perimeterAssets = [
      { pos: [-16, 0, -22], rot: Math.PI / 4, scale: 1.3, asset: "room-corner.glb" },
      { pos: [16, 0, -22], rot: -Math.PI / 4, scale: 1.3, asset: "room-corner.glb" },
      { pos: [-20, 0, -6], rot: Math.PI / 2, scale: 1.2, asset: "room-small.glb" },
      { pos: [20, 0, -6], rot: -Math.PI / 2, scale: 1.2, asset: "room-small.glb" },
      { pos: [0, 0, -26], rot: 0, scale: 1.6, asset: "corridor-wide.glb" },
      // Arches framing the path behind/aside the player
      { pos: [0, 0, -4], rot: 0, scale: 1.2, asset: "gate.glb" },
      { pos: [-10, 0, -14], rot: Math.PI / 2, scale: 1.1, asset: "gate.glb" },
      { pos: [10, 0, -14], rot: -Math.PI / 2, scale: 1.1, asset: "gate.glb" },
    ];

    for (const { pos, rot, scale, asset } of perimeterAssets) {
      try {
        const structure = await loadModel(`/assets/Models/GLB%20format/${asset}`);
        structure.position.set(...pos);
        structure.rotation.y = rot;
        structure.scale.setScalar(scale);
        
        structure.traverse((child) => {
          if (child.isMesh && child.material) {
            child.material = child.material.clone();
            if (isMother) {
              child.material.color.multiplyScalar(0.35); // Dark for mother
              child.material.roughness = 0.9;
            } else {
              child.material.color.multiplyScalar(0.95); // brighter for daughter
              child.material.emissive = new THREE.Color(0xffd9b3);
              child.material.emissiveIntensity = 0.25;
              child.material.roughness = 0.65;
            }
          }
        });
        
        envGroup.add(structure);
      } catch (err) {
        console.warn(`Perimeter asset ${asset} failed:`, err);
      }
    }

    // ============================================
    // BACKGROUND ASSETS - Distant depth (dungeon only)
    // ============================================
    console.log("Adding background assets...");

    const backgroundAssets = [
      { pos: [-24, 0, -28], rot: Math.PI / 6, scale: 1.8, asset: "corridor-wide.glb" },
      { pos: [24, 0, -28], rot: -Math.PI / 6, scale: 1.8, asset: "corridor-wide.glb" },
      { pos: [-28, 0, 6], rot: Math.PI / 2, scale: 1.6, asset: "room-corner.glb" },
      { pos: [28, 0, 6], rot: -Math.PI / 2, scale: 1.6, asset: "room-corner.glb" },
      { pos: [0, 0, -34], rot: 0, scale: 2.0, asset: "gate.glb" },
    ];

    for (const { pos, rot, scale, asset } of backgroundAssets) {
      try {
        const structure = await loadModel(`/assets/Models/GLB%20format/${asset}`);
        structure.position.set(...pos);
        structure.rotation.y = rot;
        structure.scale.setScalar(scale);
        
        structure.traverse((child) => {
          if (child.isMesh && child.material) {
            child.material = child.material.clone();
            if (isMother) {
              child.material.color.multiplyScalar(0.25); // Very dark for distance
              child.material.roughness = 0.95;
            } else {
              child.material.color.multiplyScalar(0.9); // Slightly muted for depth
              child.material.roughness = 0.8;
            }
          }
        });
        
        envGroup.add(structure);
      } catch (err) {
        console.warn(`Background asset ${asset} failed:`, err);
      }
    }

    // ============================================
    // CRYSTALS - Environmental markers
    // ============================================
    console.log("Adding crystals...");

    const crystalPositions = [
      { pos: [-15, 0.5, -12], scale: 0.9, color: isMother ? 0x223344 : 0xffd199 },
      { pos: [15, 0.5, -12], scale: 0.8, color: isMother ? 0x1a2633 : 0xffc799 },
      { pos: [-14, 0.5, 10], scale: 0.7, color: isMother ? 0x2a3344 : 0xffc0a0 },
      { pos: [14, 0.5, 10], scale: 0.8, color: isMother ? 0x1f2a3a : 0xffb894 },
      { pos: [0, 0.5, -18], scale: 1.0, color: isMother ? 0x253040 : 0xffdab6 },
    ];

    for (const { pos, scale, color } of crystalPositions) {
      try {
        const crystal = await loadModel("/assets/Crystals%20Folder/Crystal.glb");
        crystal.position.set(...pos);
        crystal.scale.setScalar(scale);
        
        crystal.traverse((child) => {
          if (child.isMesh && child.material) {
            child.material = child.material.clone();
            child.material.color.set(color);
            child.material.emissive = new THREE.Color(color);
            child.material.emissiveIntensity = isMother ? 0.25 : 0.6;
            child.material.roughness = isMother ? 0.85 : 0.4;
            if (!isMother) {
              child.material.metalness = 0.2;
            }
          }
        });

        envGroup.add(crystal);

        const crystalLight = new THREE.PointLight(color, isMother ? 0.4 : 1.8, isMother ? 7 : 12);
        crystalLight.position.set(...pos);
        envGroup.add(crystalLight);

      } catch (err) {
        console.warn("Crystal load failed:", err);
      }
    }

    // ============================================
    // LIGHTING - Dramatically different moods
    // ============================================
    console.log("Setting up lighting...");

    if (isMother) {
      // DARK LIGHTING FOR MOTHER
      const mainLight = new THREE.DirectionalLight(0x8a9aaf, 1.4);
      mainLight.position.set(15, 30, 12);
      mainLight.castShadow = true;
      mainLight.shadow.camera.left = -40;
      mainLight.shadow.camera.right = 40;
      mainLight.shadow.camera.top = 40;
      mainLight.shadow.camera.bottom = -40;
      mainLight.shadow.mapSize.width = 2048;
      mainLight.shadow.mapSize.height = 2048;
      mainLight.shadow.bias = -0.0001;
      envGroup.add(mainLight);

      const fillLight = new THREE.DirectionalLight(0x5a6a7f, 0.9);
      fillLight.position.set(-12, 25, -8);
      envGroup.add(fillLight);

      const ambient = new THREE.AmbientLight(0x4a5a6f, 0.7);
      envGroup.add(ambient);

    } else {
      // BRIGHT NATURAL LIGHTING FOR DAUGHTER
      const mainLight = new THREE.DirectionalLight(0xfff8e6, 2.5);
      mainLight.position.set(15, 30, 12);
      mainLight.castShadow = true;
      mainLight.shadow.camera.left = -40;
      mainLight.shadow.camera.right = 40;
      mainLight.shadow.camera.top = 40;
      mainLight.shadow.camera.bottom = -40;
      mainLight.shadow.mapSize.width = 2048;
      mainLight.shadow.mapSize.height = 2048;
      mainLight.shadow.bias = -0.0001;
      envGroup.add(mainLight);

      const fillLight = new THREE.DirectionalLight(0xe8f0d8, 2.0);
      fillLight.position.set(-12, 25, -8);
      envGroup.add(fillLight);

      const ambient = new THREE.AmbientLight(0xf5f8f0, 1.6);
      envGroup.add(ambient);

      // Gentle top-down natural glow
      const topGlow = new THREE.PointLight(0xf0f8d8, 3.5, 60);
      topGlow.position.set(0, 25, 0);
      envGroup.add(topGlow);

      // Natural side lights
      const leftGlow = new THREE.PointLight(0xe0f0c8, 2.5, 45);
      leftGlow.position.set(-18, 15, 0);
      envGroup.add(leftGlow);

      const rightGlow = new THREE.PointLight(0xe0f0c8, 2.5, 45);
      rightGlow.position.set(18, 15, 0);
      envGroup.add(rightGlow);
    }

    // ============================================
    // UNDERWORLD EFFECTS - Mother only
    // ============================================
    console.log("Adding atmospheric effects...");

    if (isMother) {
      // Dark underworld glow for mother
      const underworldGlow = new THREE.PointLight(0xff6633, 3.0, 45);
      underworldGlow.position.set(0, -12, 0);
      envGroup.add(underworldGlow);

      const glowPositions = [
        [-8, -10, -8],
        [8, -10, -8],
        [-8, -10, 8],
        [8, -10, 8],
        [0, -10, 0],
      ];

      for (const pos of glowPositions) {
        const glow = new THREE.PointLight(0xff7744, 1.8, 28);
        glow.position.set(...pos);
        envGroup.add(glow);
      }

      const rimLeft = new THREE.PointLight(0xff8855, 1.4, 32);
      rimLeft.position.set(-15, -8, 0);
      envGroup.add(rimLeft);

      const rimRight = new THREE.PointLight(0xff7744, 1.4, 32);
      rimRight.position.set(15, -8, 0);
      envGroup.add(rimRight);
    }
    // Daughter gets no underworld effects - natural lighting only

    // ============================================
    // MEMORY STONES - Environmental markers
    // ============================================
    const stoneMaterial = new THREE.MeshStandardMaterial({
      color: isMother ? 0x2a2d38 : 0xa8c898,
      roughness: isMother ? 0.95 : 0.7,
      metalness: isMother ? 0.05 : 0.1,
    });

    if (!isMother) {
      stoneMaterial.emissive = new THREE.Color(0x90b880);
      stoneMaterial.emissiveIntensity = 0.15;
    }

    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const radius = 18;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;

      const stoneGeo = new THREE.CylinderGeometry(0.5, 0.7, 3.5, 8);
      const stone = new THREE.Mesh(stoneGeo, stoneMaterial);
      stone.position.set(x, 0, z);
      stone.rotation.y = -angle;
      stone.castShadow = true;
      stone.receiveShadow = true;
      envGroup.add(stone);
    }

    console.log("✅ Level 2 environment complete");

  } catch (error) {
    console.error("❌ Error building Level 2 environment:", error);
  }

  scene.add(envGroup);
}
