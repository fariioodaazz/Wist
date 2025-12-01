import { useEffect, useRef } from "react";
import hostTrack from "../assets/audio/Hollow Knight Theme.mp3";
import clientTrack from "../assets/audio/City of Tears.mp3";

export function useRoleAudio({ role, world }) {
  const audioRef = useRef(null);

  useEffect(() => {
    if (!role) return;

    const src = role === "host" ? hostTrack : clientTrack;

    // Clean up previous audio if any
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }

    // Create audio element
    const audio = new Audio(src);
    audio.loop = true;
    audio.volume = 0.5;
    audioRef.current = audio;

    // Autoplay fix: wait for first user interaction
    const startOnInteraction = () => {
      if (!audioRef.current) return;

      audioRef.current.play().catch((err) => {
        console.warn("Could not start game audio:", err);
      });

      // Remove listeners after first successful attempt
      window.removeEventListener("keydown", startOnInteraction);
      window.removeEventListener("pointerdown", startOnInteraction);
    };

    window.addEventListener("keydown", startOnInteraction);
    window.addEventListener("pointerdown", startOnInteraction);

    // Cleanup on unmount or when role/world changes
    return () => {
      window.removeEventListener("keydown", startOnInteraction);
      window.removeEventListener("pointerdown", startOnInteraction);

      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
        audioRef.current = null;
      }
    };
  }, [role, world]);

  return audioRef;
}
