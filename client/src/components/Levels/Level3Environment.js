// client/src/components/Levels/Level3Environment.js
import * as THREE from "three";
import { loadModel } from "../../utils/modelCache.js";

/**
 * Level 3 Environment (Acceptance) with per-role mood:
 * host (Mother) stays cooler/darker, client (Daughter) is warm/brighter.
 * Decorations sit outside the main path; no colliders.
 */
export async function buildLevel3Environment(scene, role = "host") {
  const envGroup = new THREE.Group();
  envGroup.name = "Level3Environment";
  const isMother = role === "host";

  // Background / fog
  scene.background = new THREE.Color(isMother ? 0x1a1d24 : 0xfffaef);
  scene.fog = new THREE.Fog(
    isMother ? 0x1a1d24 : 0xfffaef,
    isMother ? 22 : 40,
    isMother ? 60 : 120
  );

  // Perimeter modules (keep clear of center path)
  const perimeter = [
    { pos: [-18, 0, -24], rot: Math.PI / 4, scale: 1.3, asset: "room-corner.glb" },
    { pos: [18, 0, -24], rot: -Math.PI / 4, scale: 1.3, asset: "room-corner.glb" },
    { pos: [-22, 0, 14], rot: Math.PI / 2, scale: 1.2, asset: "room-small.glb" },
    { pos: [22, 0, 14], rot: -Math.PI / 2, scale: 1.2, asset: "room-small.glb" },
    { pos: [0, 0, -28], rot: 0, scale: 1.6, asset: "corridor-wide.glb" },
    { pos: [0, 0, 20], rot: Math.PI, scale: 1.2, asset: "gate.glb" },
  ];

  for (const { pos, rot, scale, asset } of perimeter) {
    try {
      const mesh = await loadModel(`/assets/Models/GLB%20format/${asset}`);
      mesh.position.set(...pos);
      mesh.rotation.y = rot;
      mesh.scale.setScalar(scale);
      mesh.traverse((c) => {
        if (c.isMesh && c.material) {
          c.material = c.material.clone();
          if (isMother) {
            c.material.color.multiplyScalar(0.35);
            c.material.roughness = 0.9;
          } else {
            c.material.color.multiplyScalar(1.0);
            c.material.emissive = new THREE.Color(0xffd9b3);
            c.material.emissiveIntensity = 0.2;
            c.material.roughness = 0.65;
          }
        }
      });
      envGroup.add(mesh);
    } catch (err) {
      console.warn("Level3 perimeter failed:", asset, err);
    }
  }

  // Crystals at edges
  const crystals = [
    { pos: [-16, 0.5, -12], scale: 0.9, color: isMother ? 0x224466 : 0xffd4a8 },
    { pos: [16, 0.5, -12], scale: 0.8, color: isMother ? 0x1a2a44 : 0xffcfa2 },
    { pos: [-14, 0.5, 10], scale: 0.7, color: isMother ? 0x2a3a55 : 0xffc299 },
    { pos: [14, 0.5, 10], scale: 0.8, color: isMother ? 0x1f3048 : 0xffb98a },
    { pos: [0, 0.5, -20], scale: 1.0, color: isMother ? 0x25384f : 0xffe0bf },
  ];

  for (const { pos, scale, color } of crystals) {
    try {
      const crystal = await loadModel("/assets/Crystals%20Folder/Crystal.glb");
      crystal.position.set(...pos);
      crystal.scale.setScalar(scale);
      crystal.traverse((c) => {
        if (c.isMesh && c.material) {
          c.material = c.material.clone();
          c.material.color.set(color);
          c.material.emissive = new THREE.Color(color);
          c.material.emissiveIntensity = isMother ? 0.25 : 0.6;
          c.material.roughness = isMother ? 0.85 : 0.45;
        }
      });
      envGroup.add(crystal);

      const light = new THREE.PointLight(
        color,
        isMother ? 0.4 : 1.6,
        isMother ? 7 : 12
      );
      light.position.set(...pos);
      envGroup.add(light);
    } catch (err) {
      console.warn("Level3 crystal failed:", err);
    }
  }

  // Lighting
  if (isMother) {
    const main = new THREE.DirectionalLight(0x8a9aaf, 1.3);
    main.position.set(14, 28, 10);
    main.castShadow = true;
    envGroup.add(main);

    const fill = new THREE.DirectionalLight(0x5a6a7f, 0.9);
    fill.position.set(-12, 22, -8);
    envGroup.add(fill);

    const ambient = new THREE.AmbientLight(0x3a4a5f, 0.7);
    envGroup.add(ambient);

    const underGlow = new THREE.PointLight(0xff6633, 2.8, 40);
    underGlow.position.set(0, -10, 0);
    envGroup.add(underGlow);
  } else {
    const main = new THREE.DirectionalLight(0xfff8e6, 2.3);
    main.position.set(14, 30, 10);
    main.castShadow = true;
    envGroup.add(main);

    const fill = new THREE.DirectionalLight(0xe8f0d8, 2.0);
    fill.position.set(-12, 24, -8);
    envGroup.add(fill);

    const ambient = new THREE.AmbientLight(0xf5f8f0, 1.5);
    envGroup.add(ambient);

    const topGlow = new THREE.PointLight(0xffe6c0, 4.5, 60);
    topGlow.position.set(0, 36, -8);
    envGroup.add(topGlow);
  }

  scene.add(envGroup);
}
