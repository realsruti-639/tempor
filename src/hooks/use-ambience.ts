import { useCallback, useEffect, useReducer, useState } from "react";

import { getEngine } from "@/lib/tempor/audio";
import { CHANNEL_IDS, DEFAULT_LEVELS, TRACKS, type ChannelId, type TrackId } from "@/lib/tempor/tracks";
import type { AudioPrefs } from "@/lib/tempor/storage";

/**
 * Bridges saved mixer prefs to the Web Audio engine.
 * Nothing plays until the user presses play, picks a track or moves a fader.
 */
export function useAmbience(prefs: AudioPrefs, update: (p: Partial<AudioPrefs>) => void) {
  const [, rerender] = useReducer((x: number) => x + 1, 0);
  const [blocked, setBlocked] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return getEngine().subscribe(rerender);
  }, []);

  useEffect(() => {
    if (mounted) getEngine().setVolume(prefs.volume);
  }, [prefs.volume, mounted]);

  const isPlaying = mounted && getEngine().isPlaying;

  const apply = useCallback(
    async (next: Pick<AudioPrefs, "levels" | "tracks">, autoplay = true) => {
      update(next);
      const e = getEngine();
      if (e.isPlaying) e.setMix(next);
      else if (autoplay && CHANNEL_IDS.some((c) => next.levels[c] > 0)) {
        const ok = await e.play(next);
        setBlocked(!ok);
      }
    },
    [update],
  );

  const setLevel = useCallback(
    (id: ChannelId, v: number) => void apply({ levels: { ...prefs.levels, [id]: v }, tracks: prefs.tracks }),
    [prefs.levels, prefs.tracks, apply],
  );

  /** Pick a track for its channel; raises a silent channel so the choice is audible. */
  const selectTrack = useCallback(
    (id: TrackId) => {
      const ch = TRACKS[id].channel;
      const levels = { ...prefs.levels, [ch]: prefs.levels[ch] > 0.05 ? prefs.levels[ch] : 0.7 };
      void apply({ levels, tracks: { ...prefs.tracks, [ch]: id } });
    },
    [prefs.levels, prefs.tracks, apply],
  );

  /** Cross-fade so only this channel remains. */
  const solo = useCallback(
    (id: ChannelId) => {
      const levels = { lofi: 0, alpha: 0, atmos: 0, [id]: Math.max(prefs.levels[id], 0.7) };
      void apply({ levels, tracks: prefs.tracks });
    },
    [prefs.levels, prefs.tracks, apply],
  );

  const togglePlay = useCallback(() => {
    const e = getEngine();
    if (e.isPlaying) {
      e.pause();
      return;
    }
    let levels = prefs.levels;
    if (!CHANNEL_IDS.some((c) => levels[c] > 0)) {
      levels = { ...DEFAULT_LEVELS };
      update({ levels });
    }
    void e.play({ levels, tracks: prefs.tracks }).then((ok) => setBlocked(!ok));
  }, [prefs.levels, prefs.tracks, update]);

  /** Call from a user gesture (e.g. Start) so the completion chime is allowed later. */
  const prepareChime = useCallback(() => {
    if (prefs.chime && prefs.volume > 0) void getEngine().unlock();
  }, [prefs.chime, prefs.volume]);

  const chime = useCallback(() => {
    if (prefs.chime) getEngine().chime();
  }, [prefs.chime]);

  const energy = useCallback(() => getEngine().energy(), []);

  return { isPlaying, blocked, setLevel, selectTrack, solo, togglePlay, prepareChime, chime, energy };
}
