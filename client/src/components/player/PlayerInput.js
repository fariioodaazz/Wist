export class PlayerInput {
  constructor() {
    this.keys = {};

    this.handleKeyDown = (e) => {
      this.keys[e.code] = true;
    };

    this.handleKeyUp = (e) => {
      this.keys[e.code] = false;
    };

    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
  }

  /**
   * Returns basic input states for the current frame.
   * Player will use this to compute movement & jumping.
   */
  getInputState() {
    let moveX = 0;
    let moveZ = 0;

    if (this.keys["KeyW"] || this.keys["ArrowUp"]) moveZ -= 1;
    if (this.keys["KeyS"] || this.keys["ArrowDown"]) moveZ += 1;
    if (this.keys["KeyA"] || this.keys["ArrowLeft"]) moveX -= 1;
    if (this.keys["KeyD"] || this.keys["ArrowRight"]) moveX += 1;

    const jumpPressed = !!(this.keys["Space"] || this.keys["KeyJ"]);

    return { moveX, moveZ, jumpPressed };
  }

  /**
   * Optional: call if you ever destroy the player to avoid leaking listeners.
   */
  dispose() {
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
  }
}
