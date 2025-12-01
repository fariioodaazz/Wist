import * as THREE from "three";

export function loadLevel2() {
  const group = new THREE.Group();
  const platforms = [];

  const ground = new THREE.Mesh(
    new THREE.BoxGeometry(20, 2, 20),
    new THREE.MeshStandardMaterial({ color: "lightblue" })
  );

  ground.position.y = 0;
  group.add(ground);
  platforms.push(ground);

  const block = new THREE.Mesh(
    new THREE.BoxGeometry(5, 5, 5),
    new THREE.MeshStandardMaterial({ color: "blue" })
  );

  block.position.y = 0;
  block.userData.isPushable = true;
  group.add(block);
  platforms.push(block);
  block.userData.id = "block1";

  // const ground1 = new THREE.Mesh(
  //   new THREE.BoxGeometry(50, 2, 50),
  //   new THREE.MeshStandardMaterial({ color: "lightblue" })
  // );

  // ground1.position.z = -60;
  // group.add(ground1);
  // platforms.push(ground1);

  const geometry = new THREE.TetrahedronGeometry(20, 2, 20);
  const material = new THREE.MeshBasicMaterial({ color: 0xffff00 });
  const tetrahedron = new THREE.Mesh(geometry, material);
  tetrahedron.position.y = 0;
  tetrahedron.position.z = -60;
  group.add(tetrahedron);
  platforms.push(tetrahedron);

  return { group, platforms };
}
