// player/PlayerCheckpoints.js
import { PLAYER_LIMITS } from "./PlayerConfig.js";

/**
 * Handles:
 *  - Level checkpoints (update puzzle level when crossing Z threshold)
 *  - Falling below FALL_LIMIT (trigger respawn for both players)
 *
 * Returns true if Player.update() should early-return and NOT apply newPos.
 */
export function handleCheckpointsAndRespawn(player, newPos) {
  const { network } = player;
  if (!network) {
    // If no network, nothing to sync; just allow movement
    return false;
  }

  const currentZ = newPos.z;

  // ───── Checkpoint: Level 2  ─────
  if (currentZ < PLAYER_LIMITS.LEVEL2_Z_THRESHOLD && !player._reachedLevel2) {
    player._reachedLevel2 = true;

    network.sendPuzzleUpdate({
      levelReached: 2,
    });
  }

  // ───── Checkpoint: Level 3  ─────
  if (currentZ < PLAYER_LIMITS.LEVEL3_Z_THRESHOLD && !player._reachedLevel3) {
    player._reachedLevel3 = true;

    network.sendPuzzleUpdate({
      levelReached: 3,
    });
  }

  // ───── Fall detection ─────
  if (newPos.y < PLAYER_LIMITS.FALL_LIMIT) {
    network.sendPuzzleUpdate({
      respawnToken: Date.now(),
    });

    return true;
  }

  return false;
}
