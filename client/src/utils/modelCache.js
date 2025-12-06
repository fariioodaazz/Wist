import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as THREE from "three";

const loader = new GLTFLoader();
const cache = new Map();

/**
 * Load a GLB once, then clone for reuse.
 * Path should be relative to /public, e.g. "/assets/Models/GLB%20format/template-floor.glb"
 */
export function loadModel(path) {
  return new Promise((resolve, reject) => {
    if (cache.has(path)) {
      const original = cache.get(path);
      const clone = original.clone(true);
      clone.traverse((c) => {
        if (c.isMesh) {
          c.castShadow = true;
          c.receiveShadow = true;
          if (c.material && c.material.isMaterial) {
            c.material = c.material.clone();
          }
        }
      });
      return resolve(clone);
    }

    loader.load(
      path,
      (gltf) => {
        const scene = gltf.scene || gltf.scenes?.[0];
        cache.set(path, scene);
        const clone = scene.clone(true);
        clone.traverse((c) => {
          if (c.isMesh) {
            c.castShadow = true;
            c.receiveShadow = true;
            if (c.material && c.material.isMaterial) {
              c.material = c.material.clone();
            }
          }
        });
        resolve(clone);
      },
      undefined,
      (err) => {
        console.error("Error loading model:", path, err);
        reject(err);
      }
    );
  });
}
