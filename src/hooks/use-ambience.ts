import { useCallback, useEffect, useReducer, useState } from "react";

import { getEngine } from "@/lib/tempor/audio";
import type { AudioPrefs, TrackId } from "@/lib/tempor/storage";

/**
 * Bridges saved audio prefs to the Web Audio engine.
 * Nothing plays until the user explicitly picks a track or presses play.
 */
export function useAmbience(prefs: AudioPrefs, update: (p: Partial<AudioPrefs>) => void) {
  const [, rerender] = useReducer((x: number) => x + 1, 0);
  const [blocked, setBlocked] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const unsub = getEngine().subscribe(rerender);
    return () => {
      unsub();
    };
  }, []);

  useEffect(() => {
    if (mounted) getEngine().setVolume(prefs.volume);
  }, [prefs.volume, mounted]);

  const playTrack = useCallback(async (id: TrackId) => {
    const ok = await getEngine().play(id);
    setBlocked(!ok);
  }, []);

  const selectTrack = useCallback(
    (id: TrackId) => {
      update({ track: id });
      void playTrack(id);
    },
    [update, playTrack],
  );

  const isPlaying = mounted && getEngine().isPlaying;

  const togglePlay = useCallback(() => {
    const e = getEngine();
    if (e.isPlaying) e.stop();
    else if (prefs.track !== "off") void playTrack(prefs.track);
  }, [prefs.track, playTrack]);

  /** Call from a user gesture (e.g. Start) so the completion chime is allowed later. */
  const prepareChime = useCallback(() => {
    if (prefs.chime && prefs.volume > 0) void getEngine().unlock();
  }, [prefs.chime, prefs.volume]);

  const chime = useCallback(() => {
    if (prefs.chime) getEngine().chime();
  }, [prefs.chime]);

  return { isPlaying, blocked, selectTrack, togglePlay, prepareChime, chime };
}
