import { loadLevel1 } from "./Levels/Level1.js";
import { loadLevel2 } from "./Levels/Level2.js";
import { loadLevel3 } from "./Levels/Level3.js";

export async function loadAllLevels(scene, role) {
  let zOffset = 0;
  const allPlatforms = [];

  // ---- Level 1 ----
  const level1 = await loadLevel1(role);

  if (!level1 || !level1.group) {
    console.error("Level1 did not return { group, platforms }");
    return [];
  }

  level1.group.position.z = zOffset;
  scene.add(level1.group);
  allPlatforms.push(...level1.platforms);

  zOffset -= 100;

  // ---- Level 2 ----
  const level2 = await loadLevel2(role);

  if (!level2 || !level2.group) {
    console.error("Level2 did not return { group, platforms }");
    return allPlatforms;
  }

  level2.group.position.z = zOffset;
  scene.add(level2.group);
  allPlatforms.push(...level2.platforms);

  zOffset -= 50;

  // ---- Level 3 ----
  const level3 = await loadLevel3(role);

  if (!level3 || !level3.group) {
    console.error("Level3 did not return { group, platforms }");
    return allPlatforms;
  }

  level3.group.position.z = zOffset;
  scene.add(level3.group);
  allPlatforms.push(...level3.platforms);

  return allPlatforms;
}
