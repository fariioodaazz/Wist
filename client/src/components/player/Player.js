// player/Player.js
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.164/build/three.module.js";
import { PlayerInput } from "./PlayerInput.js";
import { PLAYER_COLLISION } from "./PlayerConfig.js";
import { handleCheckpointsAndRespawn } from "./PlayerCheckpoints.js";

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
      role = "client",
    } = options;

    this.network = network;
    this.otherPlayer = otherPlayer;
    this.role = role;

    if (mesh instanceof THREE.Mesh) {
      this.mesh = mesh;
      this.mesh.position.copy(position);
    } else {
      this.mesh = new THREE.Mesh(geometry, material);
      this.mesh.position.copy(position);
    }

    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;

    scene.add(this.mesh);

    // ====== PHYSICS CONFIG ======
    this.velocity = new THREE.Vector3();
    this.speed = speed;
    this.jumpSpeed = jumpSpeed;
    this.gravity = gravity;
    this.onGround = false;

    // Checkpoint flags
    this._reachedLevel2 = false;
    this._reachedLevel3 = false;

    // ====== INPUT ======
    this.input = new PlayerInput();

    // ====== COLLISION SETTINGS ======
    this.playerHalfHeight = PLAYER_COLLISION.HALF_HEIGHT;
    this.playerHalfSize = PLAYER_COLLISION.HALF_SIZE.clone();
    this.skin = PLAYER_COLLISION.SKIN;
    this.rayOriginOffset = PLAYER_COLLISION.RAY_ORIGIN_OFFSET;
    this.groundEpsilon = PLAYER_COLLISION.GROUND_EPSILON;

    this.raycaster = new THREE.Raycaster();
  }

  castRay(origin, direction, maxDistance) {
    this.raycaster.set(origin, direction.normalize());
    const hits = this.raycaster.intersectObjects(this.platforms, false);
    if (hits.length === 0) return null;
    const hit = hits[0];
    return hit.distance <= maxDistance ? hit : null;
  }

  update(delta) {
    // ─────────── INPUT ───────────
    const { moveX, moveZ, jumpPressed } = this.input.getInputState();

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
    if (jumpPressed && this.onGround) {
      this.velocity.y = this.jumpSpeed;
      this.onGround = false;
    }

    // Gravity
    this.velocity.y += this.gravity * delta;

    let deltaPos = this.velocity.clone().multiplyScalar(delta);
    let newPos = this.mesh.position.clone();

    // ─────────── X movement (with pushable blocks) ───────────
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
          const onlyHost = !!hitObj.userData.onlyHostCanPush;
          const canPush = !onlyHost || this.role === "host";

          if (canPush) {
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
        } else {
          deltaPos.x = 0;
          this.velocity.x = 0;
        }
      }
    }
    newPos.x += deltaPos.x;

    // ─────────── Z movement (with pushable blocks) ───────────
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
          const onlyHost = !!hitObj.userData.onlyHostCanPush;
          const canPush = !onlyHost || this.role === "host";

          if (canPush) {
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
        } else {
          deltaPos.z = 0;
          this.velocity.z = 0;
        }
      }
    }
    newPos.z += deltaPos.z;

    // ─────────── Vertical movement & ground/ceiling ───────────
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

    // ─────────── Player–player collision (horizontal only) ───────────
    if (this.otherPlayer) {
      const otherPos = this.otherPlayer.position;

      const dx = newPos.x - otherPos.x;
      const dz = newPos.z - otherPos.z;
      const distSq = dx * dx + dz * dz;

      const radius = 1.0;
      const minDist = radius * 2;
      const minDistSq = minDist * minDist;

      if (distSq < minDistSq) {
        const dist = Math.sqrt(distSq) || 0.0001;
        const overlap = minDist - dist;

        const nx = dx / dist;
        const nz = dz / dist;

        newPos.x += nx * overlap;
        newPos.z += nz * overlap;
      }
    }

    // ─────────── Checkpoints & Respawn (level logic) ───────────
    const shouldStop = handleCheckpointsAndRespawn(this, newPos);
    if (shouldStop) {
      // We triggered a respawn via network; don't apply this falling position
      return;
    }

    // ─────────── Finally apply position ───────────
    this.mesh.position.copy(newPos);
  }

  /**
   * Optional, if you ever need to clean up the player completely.
   */
  dispose() {
    if (this.input) {
      this.input.dispose();
    }
  }
}
