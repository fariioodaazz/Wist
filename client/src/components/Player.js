import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.164/build/three.module.js";

export default class Player {
  constructor(scene, platforms, options = {}) {
    this.platforms = platforms;

    const {
      mesh = null,

      geometry = new THREE.BoxGeometry(2, 2, 2),
      material = new THREE.MeshStandardMaterial({ color: 0x00ff00 }),

      position = new THREE.Vector3(0, 3, 0),

      speed = 20,
      jumpSpeed = 18,
      gravity = -40,
      network = null,

      otherPlayer = null,
    } = options;

    this.network = network;
    this.otherPlayer = otherPlayer;

    if (mesh instanceof THREE.Mesh) {
      this.mesh = mesh;
      this.mesh.position.copy(position);
    } else {
      this.mesh = new THREE.Mesh(geometry, material);
      this.mesh.position.copy(position);
    }

    scene.add(this.mesh);

    // ====== PHYSICS CONFIG ======
    this.velocity = new THREE.Vector3();
    this.speed = speed;
    this.jumpSpeed = jumpSpeed;
    this.gravity = gravity;
    this.onGround = false;

    // ====== INPUT ======
    this.keys = {};
    window.addEventListener("keydown", (e) => (this.keys[e.code] = true));
    window.addEventListener("keyup", (e) => (this.keys[e.code] = false));

    // ====== COLLISION SETTINGS ======
    this.playerHalfHeight = 1;
    this.playerHalfSize = new THREE.Vector3(1, 1, 1);

    this.raycaster = new THREE.Raycaster();
    this.skin = 0.05;
    this.rayOriginOffset = 0.1;
    this.groundEpsilon = 0.05;
  }

  castRay(origin, direction, maxDistance) {
    this.raycaster.set(origin, direction.normalize());
    const hits = this.raycaster.intersectObjects(this.platforms, false);
    if (hits.length === 0) return null;
    const hit = hits[0];
    return hit.distance <= maxDistance ? hit : null;
  }

  update(delta) {
    let moveX = 0,
      moveZ = 0;

    if (this.keys["KeyW"] || this.keys["ArrowUp"]) moveZ -= 1;
    if (this.keys["KeyS"] || this.keys["ArrowDown"]) moveZ += 1;
    if (this.keys["KeyA"] || this.keys["ArrowLeft"]) moveX -= 1;
    if (this.keys["KeyD"] || this.keys["ArrowRight"]) moveX += 1;

    const inputDir = new THREE.Vector3(moveX, 0, moveZ);

    if (inputDir.lengthSq() > 0) {
      inputDir.normalize().multiplyScalar(this.speed);
      this.velocity.x = inputDir.x;
      this.velocity.z = inputDir.z;
    } else {
      this.velocity.x = 0;
      this.velocity.z = 0;
    }

    // Jump
    if ((this.keys["Space"] || this.keys["KeyJ"]) && this.onGround) {
      this.velocity.y = this.jumpSpeed;
      this.onGround = false;
    }

    // Gravity
    this.velocity.y += this.gravity * delta;

    let deltaPos = this.velocity.clone().multiplyScalar(delta);
    let newPos = this.mesh.position.clone();

    // ── X movement (with pushable support)
    if (deltaPos.x !== 0) {
      const dirX = new THREE.Vector3(Math.sign(deltaPos.x), 0, 0);
      const originX = new THREE.Vector3(
        this.mesh.position.x,
        this.mesh.position.y,
        this.mesh.position.z
      );

      const maxX = this.playerHalfSize.x + this.skin + Math.abs(deltaPos.x);

      const hitX = this.castRay(originX, dirX, maxX);

      if (hitX) {
        const hitObj = hitX.object;

        if (hitObj.userData && hitObj.userData.isPushable) {
          hitObj.position.x += deltaPos.x;

          if (this.network && hitObj.userData.id) {
            this.network.sendObjectUpdate(hitObj.userData.id, {
              x: hitObj.position.x,
              y: hitObj.position.y,
              z: hitObj.position.z,
            });
          }
        } else {
          deltaPos.x = 0;
          this.velocity.x = 0;
        }
      }
    }
    newPos.x += deltaPos.x;

    if (deltaPos.z !== 0) {
      const dirZ = new THREE.Vector3(0, 0, Math.sign(deltaPos.z));
      const originZ = new THREE.Vector3(
        newPos.x,
        this.mesh.position.y,
        this.mesh.position.z
      );

      const maxZ = this.playerHalfSize.z + this.skin + Math.abs(deltaPos.z);

      const hitZ = this.castRay(originZ, dirZ, maxZ);

      if (hitZ) {
        const hitObj = hitZ.object;

        if (hitObj.userData && hitObj.userData.isPushable) {
          hitObj.position.z += deltaPos.z;

          if (this.network && hitObj.userData.id) {
            this.network.sendObjectUpdate(hitObj.userData.id, {
              x: hitObj.position.x,
              y: hitObj.position.y,
              z: hitObj.position.z,
            });
          }
        } else {
          deltaPos.z = 0;
          this.velocity.z = 0;
        }
      }
    }
    newPos.z += deltaPos.z;

    // ── Vertical
    this.onGround = false;
    let deltaY = deltaPos.y;

    // Ceiling
    if (deltaY > 0) {
      const upDir = new THREE.Vector3(0, 1, 0);
      const upOrigin = new THREE.Vector3(
        newPos.x,
        this.mesh.position.y + this.playerHalfHeight - this.skin,
        newPos.z
      );

      const maxUp = this.skin + Math.abs(deltaY);
      const hitUp = this.castRay(upOrigin, upDir, maxUp);

      if (hitUp) {
        const ceilingY = hitUp.point.y;
        newPos.y = ceilingY - this.playerHalfHeight - this.skin;
        deltaY = 0;
        this.velocity.y = 0;
      }
    }

    newPos.y += deltaY;

    // Ground
    const downDir = new THREE.Vector3(0, -1, 0);
    const downOrigin = new THREE.Vector3(
      newPos.x,
      newPos.y + this.rayOriginOffset,
      newPos.z
    );

    const maxDown =
      this.playerHalfHeight +
      this.groundEpsilon +
      Math.max(0, -this.velocity.y * delta);

    const hitDown = this.castRay(downOrigin, downDir, maxDown);

    if (hitDown && this.velocity.y <= 0) {
      const groundY = hitDown.point.y;
      newPos.y = groundY + this.playerHalfHeight;
      this.velocity.y = 0;
      this.onGround = true;
    }

    if (this.otherPlayer) {
      const otherPos = this.otherPlayer.position;

      // Only consider horizontal distance (XZ plane)
      const dx = newPos.x - otherPos.x;
      const dz = newPos.z - otherPos.z;
      const distSq = dx * dx + dz * dz;

      const radius = 1.0; // "radius" of each player
      const minDist = radius * 2; // min center-to-center distance
      const minDistSq = minDist * minDist;

      if (distSq < minDistSq) {
        const dist = Math.sqrt(distSq) || 0.0001; // avoid div by zero
        const overlap = minDist - dist;

        // Direction from other → this player
        const nx = dx / dist;
        const nz = dz / dist;

        // Push our newPos away just enough so they're not overlapping
        newPos.x += nx * overlap;
        newPos.z += nz * overlap;
      }

      const FALL_LIMIT = -50; // tweak as needed
      if (newPos.y < FALL_LIMIT) {
        if (this.network) {
          this.network.sendPuzzleUpdate({
            // any value that changes will do; timestamp is easy
            respawnToken: Date.now(),
          });
        }
        // Don’t apply the falling position; wait for respawn from world sync
        return;
      }
    }

    // Finally apply position
    this.mesh.position.copy(newPos);
  }
}
