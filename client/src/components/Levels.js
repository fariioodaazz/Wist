import { loadLevel1 } from "./levels/Level1.js";
import { loadLevel2 } from "./levels/Level2.js";
import { loadLevel3 } from "./levels/Level3.js";

export function loadAllLevels(scene, role) {
  let zOffset = 0;
  const allPlatforms = [];

  // ---- Level 1 ----
  const level1 = loadLevel1(role);

  // ensure group exists
  if (!level1 || !level1.group) {
    console.error("❌ Level1 did not return { group, platforms }");
    return [];
  }

  level1.group.position.z = zOffset;
  scene.add(level1.group);
  allPlatforms.push(...level1.platforms);

  zOffset -= 100;

  // ---- Level 2 ----
  const level2 = loadLevel2(role);

  if (!level2 || !level2.group) {
    console.error("❌ Level2 did not return { group, platforms }");
    return allPlatforms;
  }

  level2.group.position.z = zOffset;
  scene.add(level2.group);
  allPlatforms.push(...level2.platforms);

  zOffset -= 50;

  // ---- Level 3 ----
  const level3 = loadLevel3(role);

  if (!level3 || !level3.group) {
    console.error("❌ Level2 did not return { group, platforms }");
    return allPlatforms;
  }

  level3.group.position.z = zOffset;
  scene.add(level3.group);
  allPlatforms.push(...level3.platforms);

  return allPlatforms;
}
