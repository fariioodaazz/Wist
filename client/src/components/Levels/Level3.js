import * as THREE from "three";

export function loadLevel3() {
  const group = new THREE.Group();
  const platforms = [];

  const geometry = new THREE.BoxGeometry(20, 2, 40);
  const material = new THREE.MeshStandardMaterial({ color: 0x42f5a7 });

  const p1 = new THREE.Mesh(geometry, material);
  p1.position.z = 0;
  p1.receiveShadow = true;
  group.add(p1);
  platforms.push(p1);

  const p2 = new THREE.Mesh(geometry, material);
  p2.position.z = -60;
  p2.receiveShadow = true;
  group.add(p2);
  platforms.push(p2);

  const block1 = new THREE.Mesh(
    new THREE.BoxGeometry(7, 7, 7),
    new THREE.MeshStandardMaterial({ color: "blue" })
  );

  block1.position.y = 2;
  block1.receiveShadow = true;
  block1.castShadow = true;

  block1.userData.isPushable = true;
  block1.userData.onlyHostCanPush = true;

  group.add(block1);
  platforms.push(block1);

  block1.userData.id = "block1";
  block1.userData.initialPosition = block1.position.clone();

  const block2 = new THREE.Mesh(
    new THREE.BoxGeometry(5, 5, 5),
    new THREE.MeshStandardMaterial({ color: "lightblue" })
  );

  block2.position.z = -50;
  block2.receiveShadow = true;
  block2.castShadow = true;

  block2.userData.isPushable = true;
  group.add(block2);
  platforms.push(block2);
  block2.userData.id = "block2";
  block2.userData.initialPosition = block2.position.clone();

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

  return { group, platforms };
}
