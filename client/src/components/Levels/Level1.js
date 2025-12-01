import * as THREE from "three";

export function loadLevel1() {
  const group = new THREE.Group();
  const platforms = [];

  const p1Geometry = new THREE.BoxGeometry(20, 2, 50);

  const geometry = new THREE.BoxGeometry(20, 2, 30);
  const material = new THREE.MeshStandardMaterial({ color: 0xffeeee });

  const p1 = new THREE.Mesh(p1Geometry, material);
  p1.position.z = 10;
  p1.receiveShadow = true;
  group.add(p1);
  platforms.push(p1);

  const p2 = new THREE.Mesh(geometry, material);
  p2.position.z = -38;
  p2.receiveShadow = true;
  group.add(p2);
  platforms.push(p2);

  const p3 = new THREE.Mesh(geometry, material);
  p3.position.z = -75;
  p3.receiveShadow = true;
  group.add(p3);
  platforms.push(p3);

  const sideWallGeometry = new THREE.BoxGeometry(2, 50, 160);
  const backwallMaterial = new THREE.MeshStandardMaterial({
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
