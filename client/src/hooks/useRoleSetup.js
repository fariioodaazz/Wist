// hooks/useRoleColors.js
import { useEffect } from "react";

export function useRoleSetup({ role, threeRef }) {
  useEffect(() => {
    const { player, remotePlayer } = threeRef.current || {};
    if (!player || !remotePlayer) return;

    let localHex = 0x777777;
    let remoteHex = 0x777777;

    let speed = 10;
    let jumpSpeed = 24;
    let gravity = -50;

    if (role === "host") {
      localHex = 0xff5555;
      remoteHex = 0x55ffff;

      speed = 8;
      jumpSpeed = 24;
      gravity = -40;
    } else if (role === "client") {
      localHex = 0x55ffff;
      remoteHex = 0xff5555;

      speed = 14;
      jumpSpeed = 26;
      gravity = -40;
    }

    player.mesh.material.color.setHex(localHex);
    remotePlayer.material.color.setHex(remoteHex);

    player.speed = speed;
    player.jumpSpeed = jumpSpeed;
    player.gravity = gravity;
  }, [role, threeRef]);
}
