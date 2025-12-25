import * as THREE from "three";
import { getRoleMaterial } from "../../materials/levelMaterial.js";
// import { buildLevel1Environment } from "./Level1Environment.js";

export function loadLevel1(role) {
  const group = new THREE.Group();
  const platforms = [];

  // await buildLevel1Environment(group, role);

  const p1Geometry = new THREE.BoxGeometry(20, 2, 50);
  const geometry = new THREE.BoxGeometry(20, 2, 30);

  const platformMaterial = getRoleMaterial(role, {
    repeatX: 2,
    repeatY: 4,
  });

  const p1 = new THREE.Mesh(p1Geometry, platformMaterial);
  p1.position.z = 10;
  p1.receiveShadow = true;
  group.add(p1);
  platforms.push(p1);

  const p2 = new THREE.Mesh(geometry, platformMaterial);
  p2.position.z = -38;
  p2.receiveShadow = true;
  // p2.userData.id = "p2";
  // p2.userData.isBreakable = true;
  // p2.userData.onlyMomBreaks = true;
  // p2.userData.initialState = {
  //   position: p2.position.clone(),
  //   rotation: p2.rotation.clone(),
  //   scale: p2.scale.clone(),
  //   visible: true,
  //   broken: false,
  // };
  group.add(p2);
  platforms.push(p2);

  const p3 = new THREE.Mesh(geometry, platformMaterial);
  p3.position.z = -75;
  p3.receiveShadow = true;
  group.add(p3);
  platforms.push(p3);

  const sideWallGeometry = new THREE.BoxGeometry(2, 50, 160);
  const backwallMaterial = new THREE.MeshStandardMaterial({
    color: "lightblue",
    transparent: true,
    opacity: 0.0,
  });

  const backwall = new THREE.Mesh(sideWallGeometry, backwallMaterial);
  backwall.position.x = -11;
  backwall.position.y = 24;
  backwall.position.z = -10;
  group.add(backwall);
  platforms.push(backwall);

  const invisibleWalls = new THREE.MeshStandardMaterial({
    color: "lightblue",
    transparent: true,
    opacity: 0.0,
  });

  const frontwall = new THREE.Mesh(sideWallGeometry, invisibleWalls);
  frontwall.position.x = 11;
  frontwall.position.y = 24;
  frontwall.position.z = -25;
  group.add(frontwall);
  platforms.push(frontwall);

  const blockwallGeometry = new THREE.BoxGeometry(20, 50, 2);
  const blockwall = new THREE.Mesh(blockwallGeometry, invisibleWalls);
  blockwall.position.z = 5;
  blockwall.position.x = 5;
  group.add(blockwall);
  platforms.push(blockwall);

  return { group, platforms };
}
