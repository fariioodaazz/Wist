// src/materials/levelMaterials.js (example path)
import * as THREE from "three";

import RockDiff from "../assets/Textures/Rock_04/Rock_04_DIFF.png";
import RockDisp from "../assets/Textures/Rock_04/Rock_04_DISP.png";
import RockNorm from "../assets/Textures/Rock_04/Rock_04_NRM.png";
import RockOcc from "../assets/Textures/Rock_04/Rock_04_OCC.png";
import RockSpec from "../assets/Textures/Rock_04/Rock_04_SPEC.png";

import DonutBase from "../assets/Textures/Donut/Donut_BaseColor.jpg";
import DonutDisp from "../assets/Textures/Donut/Donut_Displacement.png";
import DonutMetallic from "../assets/Textures/Donut/Donut_Metallic.jpg";
import DonutNormal from "../assets/Textures/Donut/Donut_Normal.png";
import DonutRough from "../assets/Textures/Donut/Donut_Roughness.jpg";
import DonutScatter from "../assets/Textures/Donut/Donut_ScatteringColor.jpg";

const loader = new THREE.TextureLoader();

let cachedRockMaterial = null;
let cachedDonutMaterial = null;

export function getRockMaterial({
  repeatX = 2,
  repeatY = 4,
  displacementScale = 0.1,
} = {}) {
  if (cachedRockMaterial) return cachedRockMaterial;

  const diff = loader.load(RockDiff);
  const disp = loader.load(RockDisp);
  const norm = loader.load(RockNorm);
  const occ = loader.load(RockOcc);
  const spec = loader.load(RockSpec);

  const allMaps = [diff, disp, norm, occ, spec];
  allMaps.forEach((t) => {
    if (!t) return;
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeatX, repeatY);
    t.anisotropy = 8;
  });

  const rockMaterial = new THREE.MeshStandardMaterial({
    map: diff,
    normalMap: norm,
    displacementMap: disp,
    displacementScale,
    aoMap: occ,
    roughnessMap: spec,
    roughness: 1.0,
    metalness: 0.0,
  });

  cachedRockMaterial = rockMaterial;
  return rockMaterial;
}

export function getDonutMaterial({
  repeatX = 2,
  repeatY = 2,
  displacementScale = 0.05,
  metalness = 0.8,
} = {}) {
  if (cachedDonutMaterial) return cachedDonutMaterial;

  const base = loader.load(DonutBase);
  const disp = loader.load(DonutDisp);
  const metallic = loader.load(DonutMetallic);
  const normal = loader.load(DonutNormal);
  const rough = loader.load(DonutRough);
  const scatter = loader.load(DonutScatter);

  const allMaps = [base, disp, metallic, normal, rough, scatter];
  allMaps.forEach((t) => {
    if (!t) return;
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeatX, repeatY);
    t.anisotropy = 8;
  });

  const donutMaterial = new THREE.MeshStandardMaterial({
    map: base,
    normalMap: normal,
    displacementMap: disp,
    displacementScale,
    metalnessMap: metallic,
    metalness,
    roughnessMap: rough,
    roughness: 1.0,
    aoMap: scatter,
  });

  cachedDonutMaterial = donutMaterial;
  return donutMaterial;
}

export function getRoleMaterial(role, options = {}) {
  if (role === "host") {
    return getRockMaterial(options);
  }
  return getDonutMaterial(options);
}
