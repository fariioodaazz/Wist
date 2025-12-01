import { loadLevel1 } from "./Levels/Level1.js";
import { loadLevel2 } from "./Levels/Level2.js";

export function loadAllLevels(scene) {
  let zOffset = 0;
  const allPlatforms = [];

  // ---- Level 1 ----
  const level1 = loadLevel1();

  // ensure group exists
  if (!level1 || !level1.group) {
    console.error("❌ Level1 did not return { group, platforms }");
    return [];
  }

  level1.group.position.z = zOffset;
  scene.add(level1.group);
  allPlatforms.push(...level1.platforms);

  zOffset -= 50;

  // ---- Level 2 ----
  const level2 = loadLevel2();

  if (!level2 || !level2.group) {
    console.error("❌ Level2 did not return { group, platforms }");
    return allPlatforms;
  }

  level2.group.position.z = zOffset;
  scene.add(level2.group);
  allPlatforms.push(...level2.platforms);

  return allPlatforms;
}
