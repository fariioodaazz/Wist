// client/src/components/Levels/Level1Environment.js
import * as THREE from "three";
import { loadModel } from "../../utils/modelCache.js";

export async function buildLevel1Environment(scene, role = "host") {
  const envGroup = new THREE.Group();
  envGroup.name = "DenialEnvironment";
  const isMother = role === "host";

  try {
    console.log("Building Denial atmosphere for role:", role);
    scene.background = new THREE.Color(isMother ? 0x15181f : 0xfff9f0); // Much brighter for daughter
    scene.fog = new THREE.Fog(isMother ? 0x15181f : 0xffefd8, isMother ? 20 : 35, isMother ? 50 : 100);

    // ============================================
    // 🟢 GREEN AREA - Assets around platform edges
    // Position: radius 12-16 from center
    // ============================================
    console.log("Adding perimeter assets ...");

    const greenZoneAssets = [
    // Around the platform perimeter (kept off the main path)
    { pos: [-12, 0, -12], rot: Math.PI / 4, scale: 1.3, asset: "room-corner.glb" },
    { pos: [12, 0, -12], rot: -Math.PI / 4, scale: 1.3, asset: "room-corner.glb" },
    { pos: [-10, 0, 10], rot: Math.PI / 2, scale: 1.2, asset: "room-small.glb" },
    { pos: [10, 0, 10], rot: -Math.PI / 2, scale: 1.2, asset: "room-small.glb" },
    { pos: [0, 0, -14], rot: 0, scale: 1.3, asset: "corridor.glb" },
    
    // Gates near edges
    { pos: [-14, 0, 2], rot: Math.PI / 2, scale: 1.2, asset: "gate.glb" },
    { pos: [14, 0, 2], rot: -Math.PI / 2, scale: 1.2, asset: "gate.glb" },
    ];

    for (const { pos, rot, scale, asset } of greenZoneAssets) {
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
              // Bright warm tones for daughter
              child.material.color.set(0xffd9b3);
              child.material.emissive = new THREE.Color(0xffb380);
              child.material.emissiveIntensity = 0.3;
              child.material.roughness = 0.6;
              child.material.metalness = 0.1;
            }
          }
        });
        
        envGroup.add(structure);
      } catch (err) {
        console.warn(`Green zone asset ${asset} failed:`, err);
      }
    }
    console.log("Adding thinned background assets ...");

    const blueZoneAssets = [
      // Sparse distant structures for depth
      { pos: [-22, 0, -20], rot: Math.PI / 6, scale: 1.8, asset: "corridor-wide.glb" },
      { pos: [22, 0, -20], rot: -Math.PI / 6, scale: 1.8, asset: "corridor-wide.glb" },
      { pos: [-26, 0, 2], rot: Math.PI / 2, scale: 1.6, asset: "room-corner.glb" },
      { pos: [26, 0, 2], rot: -Math.PI / 2, scale: 1.6, asset: "room-corner.glb" },
      { pos: [0, 0, -26], rot: 0, scale: 2.0, asset: "gate.glb" },
    ];

    for (const { pos, rot, scale, asset } of blueZoneAssets) {
      try {
        const structure = await loadModel(`/assets/Models/GLB%20format/${asset}`);
        structure.position.set(...pos);
        structure.rotation.y = rot;
        structure.scale.setScalar(scale);
        
        structure.traverse((child) => {
          if (child.isMesh && child.material) {
            child.material = child.material.clone();
            if (isMother) {
              child.material.color.multiplyScalar(0.25); // Even darker for distance
              child.material.roughness = 0.95;
            } else {
              // Softer bright tones for distant daughter view
              child.material.color.set(0xffc299);
              child.material.emissive = new THREE.Color(0xff9966);
              child.material.emissiveIntensity = 0.2;
              child.material.roughness = 0.7;
            }
          }
        });
        
        envGroup.add(structure);
      } catch (err) {
        console.warn(`Blue zone asset ${asset} failed:`, err);
      }
    }
    console.log("Adding edge crystals...");

    const crystalPositions = [
      { pos: [-13, 0.5, -10], scale: 0.8, color: isMother ? 0x223344 : 0xffcc80 },
      { pos: [13, 0.5, -10], scale: 0.7, color: isMother ? 0x1a2633 : 0xffd699 },
      { pos: [-11, 0.5, 8], scale: 0.6, color: isMother ? 0x2a3344 : 0xffbb66 },
      { pos: [11, 0.5, 8], scale: 0.7, color: isMother ? 0x1f2a3a : 0xffc780 },
      { pos: [0, 0.5, -14], scale: 0.9, color: isMother ? 0x253040 : 0xffe0b3 },
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
            child.material.emissiveIntensity = isMother ? 0.25 : 0.6; // Much brighter glow for daughter
            child.material.roughness = isMother ? 0.85 : 0.4;
            if (!isMother) {
              child.material.metalness = 0.2;
            }
          }
        });

        envGroup.add(crystal);

        const dimLight = new THREE.PointLight(color, isMother ? 0.4 : 1.8, isMother ? 7 : 12); // Brighter crystal lights
        dimLight.position.set(...pos);
        envGroup.add(dimLight);

      } catch (err) {
        console.warn("Crystal load failed:", err);
      }
    }
    console.log("Setting up lighting...");

    if (isMother) {
      // DARK DENIAL LIGHTING
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
      const mainLight = new THREE.DirectionalLight(0xfff5e6, 2.5); // Much brighter
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

      const fillLight = new THREE.DirectionalLight(0xffe0cc, 2.0); // Warm fill
      fillLight.position.set(-12, 25, -8);
      envGroup.add(fillLight);

      const ambient = new THREE.AmbientLight(0xfff8f0, 1.6); // Very bright ambient
      envGroup.add(ambient);
      const topGlow = new THREE.PointLight(0xffcc99, 5.0, 60);
      topGlow.position.set(0, 25, 0);
      envGroup.add(topGlow);
      const leftGlow = new THREE.PointLight(0xffd9b3, 3.5, 45);
      leftGlow.position.set(-18, 15, 0);
      envGroup.add(leftGlow);

      const rightGlow = new THREE.PointLight(0xffd9b3, 3.5, 45);
      rightGlow.position.set(18, 15, 0);
      envGroup.add(rightGlow);
    }

    console.log("Adding underworld effects...");

    if (isMother) {
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
    } else {
      const warmGlow1 = new THREE.PointLight(0xffe0cc, 2.5, 40);
      warmGlow1.position.set(-12, 8, -12);
      envGroup.add(warmGlow1);

      const warmGlow2 = new THREE.PointLight(0xffe0cc, 2.5, 40);
      warmGlow2.position.set(12, 8, -12);
      envGroup.add(warmGlow2);

      const warmGlow3 = new THREE.PointLight(0xffd9b3, 2.5, 40);
      warmGlow3.position.set(-12, 8, 12);
      envGroup.add(warmGlow3);

      const warmGlow4 = new THREE.PointLight(0xffd9b3, 2.5, 40);
      warmGlow4.position.set(12, 8, 12);
      envGroup.add(warmGlow4);
    }
    const stoneMaterial = new THREE.MeshStandardMaterial({
      color: isMother ? 0x2a2d38 : 0xffc499,
      roughness: isMother ? 0.95 : 0.6,
      metalness: isMother ? 0.05 : 0.15,
    });

    if (!isMother) {
      stoneMaterial.emissive = new THREE.Color(0xffb380);
      stoneMaterial.emissiveIntensity = 0.2;
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

    console.log("Denial environment complete - layout as marked");

  } catch (error) {
    console.error("Error building environment:", error);
  }

  scene.add(envGroup);
}