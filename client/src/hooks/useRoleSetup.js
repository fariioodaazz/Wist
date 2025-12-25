// hooks/useRoleColors.js
import { useEffect } from "react";

export function useRoleSetup({ role, threeRef }) {
  useEffect(() => {
    const { player, remotePlayer } = threeRef.current || {};
    if (!player || !remotePlayer) return;

    let speed = 10;
    let jumpSpeed = 24;
    let gravity = -50;

    if (role === "host") {
      speed = 8;
      jumpSpeed = 24;
      gravity = -40;
    } else if (role === "client") {
      speed = 14;
      jumpSpeed = 26;
      gravity = -40;
    }

    player.speed = speed;
    player.jumpSpeed = jumpSpeed;
    player.gravity = gravity;
  }, [role, threeRef]);
}
