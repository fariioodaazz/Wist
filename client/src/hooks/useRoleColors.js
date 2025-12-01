// hooks/useRoleColors.js
import { useEffect } from "react";

export function useRoleColors({ role, threeRef }) {
  useEffect(() => {
    const { player, remotePlayer } = threeRef.current || {};
    if (!player || !remotePlayer) return;

    let localHex = 0x777777;
    let remoteHex = 0x777777;

    if (role === "host") {
      localHex = 0xff5555; // host = red
      remoteHex = 0x55ffff; // client = cyan
    } else if (role === "client") {
      localHex = 0x55ffff; // client = cyan
      remoteHex = 0xff5555; // host = red
    }

    player.mesh.material.color.setHex(localHex);
    remotePlayer.material.color.setHex(remoteHex);
  }, [role, threeRef]);
}
