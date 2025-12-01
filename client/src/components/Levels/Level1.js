import * as THREE from "three";

export function loadLevel1() {
  const group = new THREE.Group();
  const platforms = [];

  const geometry = new THREE.BoxGeometry(20, 2, 10);
  const material = new THREE.MeshBasicMaterial({ color: 0xffeeee });
  const p1 = new THREE.Mesh(geometry, material);
  group.add(p1);
  platforms.push(p1);

  const p2 = new THREE.Mesh(geometry, material);
  p2.position.z = -15;
  group.add(p2);
  platforms.push(p2);

  const p3 = new THREE.Mesh(geometry, material);
  p3.position.z = -30;
  group.add(p3);
  platforms.push(p3);

  const sideWallGeometry = new THREE.BoxGeometry(2, 50, 100);
  const backwallMaterial = new THREE.MeshBasicMaterial({
    color: "lightblue",
    transparent: true,
    opacity: 1.0,
  });

  const backwall = new THREE.Mesh(sideWallGeometry, backwallMaterial);
  backwall.position.x = -11;
  backwall.position.y = 24;
  backwall.position.z = -30;
  group.add(backwall);
  platforms.push(backwall);

  const invisibleWalls = new THREE.MeshBasicMaterial({
    color: "lightblue",
    transparent: true,
    opacity: 0.0,
  });

  const p5 = new THREE.Mesh(sideWallGeometry, invisibleWalls);
  p5.position.x = 11;
  p5.position.y = 24;
  p5.position.z = -30;
  group.add(p5);
  platforms.push(p5);

  // const floorGeometry = new THREE.BoxGeometry(200, 2, 200);
  // const material3 = new THREE.MeshBasicMaterial({
  //   color: "blue",
  //   transparent: true,
  //   opacity: 1.0,
  // });

  // // const floor = new THREE.Mesh(floorGeometry, material3);
  // // floor.position.y = -30;
  // // floor.position.x = 0;
  // // floor.position.z = 0;
  // // group.add(floor);
  // // platforms.push(floor);

  return { group, platforms };
}
