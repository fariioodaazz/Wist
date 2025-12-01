import * as THREE from "three";

export function loadLevel2() {
  const group = new THREE.Group();
  const platforms = [];

  const geometry = new THREE.BoxGeometry(20, 2, 10);
  const material = new THREE.MeshBasicMaterial({ color: 0xd442f5 });

  const p1 = new THREE.Mesh(geometry, material);
  p1.position.z = 0;
  group.add(p1);
  platforms.push(p1);

  const p2 = new THREE.Mesh(geometry, material);
  p2.position.z = -10;
  p2.position.y = 5;
  group.add(p2);
  platforms.push(p2);

  const p3Geometry = new THREE.BoxGeometry(10, 1, 10);
  const p3 = new THREE.Mesh(p3Geometry, material);
  p3.position.z = -20;
  p3.position.x = 5;
  p3.position.y = 12;
  group.add(p3);
  platforms.push(p3);

  const sideWallGeometry = new THREE.BoxGeometry(2, 50, 160);
  const backwallMaterial = new THREE.MeshBasicMaterial({
    color: "lightblue",
    transparent: true,
    opacity: 1.0,
  });

  const backwall = new THREE.Mesh(sideWallGeometry, backwallMaterial);
  backwall.position.x = -11;
  backwall.position.y = 24;
  backwall.position.z = -10;
  group.add(backwall);
  platforms.push(backwall);

  const invisibleWalls = new THREE.MeshBasicMaterial({
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

  return { group, platforms };
}
