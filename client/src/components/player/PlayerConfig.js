// player/PlayerConfig.js
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.164/build/three.module.js";

export const PLAYER_COLLISION = {
  HALF_HEIGHT: 1,
  HALF_SIZE: new THREE.Vector3(1, 1, 1),
  SKIN: 0.05,
  RAY_ORIGIN_OFFSET: 0.1,
  GROUND_EPSILON: 0.05,
};

export const PLAYER_LIMITS = {
  // Trigger respawn on
  FALL_LIMIT: -50,

  //LEVEL 2 STARTS PAST
  LEVEL2_Z_THRESHOLD: -50,
};
