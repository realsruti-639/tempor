import { useCallback, useEffect, useReducer, useState } from "react";

import { getEngine } from "@/lib/tempor/audio";
import {
  CHANNEL_IDS,
  DEFAULT_LEVELS,
  type AudioPrefs,
  type ChannelId,
  type ChannelLevels,
} from "@/lib/tempor/storage";

/**
 * Bridges saved mixer prefs to the Web Audio engine.
 * Nothing plays until the user presses play or moves a fader.
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

  const startWith = useCallback(async (levels: ChannelLevels) => {
    const ok = await getEngine().play(levels);
    setBlocked(!ok);
  }, []);

  const applyLevels = useCallback(
    (levels: ChannelLevels) => {
      update({ levels });
      const e = getEngine();
      if (e.isPlaying) e.setLevels(levels);
      else if (CHANNEL_IDS.some((c) => levels[c] > 0)) void startWith(levels);
    },
    [update, startWith],
  );

  const setLevel = useCallback(
    (id: ChannelId, v: number) => applyLevels({ ...prefs.levels, [id]: v }),
    [prefs.levels, applyLevels],
  );

  /** Cross-fade so only this channel remains. */
  const solo = useCallback(
    (id: ChannelId) => {
      const lv = { rain: 0, alpha: 0, stream: 0 } as ChannelLevels;
      lv[id] = Math.max(prefs.levels[id], 0.7);
      applyLevels(lv);
    },
    [prefs.levels, applyLevels],
  );

  const togglePlay = useCallback(() => {
    const e = getEngine();
    if (e.isPlaying) {
      e.pause();
      return;
    }
    let lv = prefs.levels;
    if (!CHANNEL_IDS.some((c) => lv[c] > 0)) {
      lv = { ...DEFAULT_LEVELS };
      update({ levels: lv });
    }
    void startWith(lv);
  }, [prefs.levels, update, startWith]);

  /** Call from a user gesture (e.g. Start) so the completion chime is allowed later. */
  const prepareChime = useCallback(() => {
    if (prefs.chime && prefs.volume > 0) void getEngine().unlock();
  }, [prefs.chime, prefs.volume]);

  const chime = useCallback(() => {
    if (prefs.chime) getEngine().chime();
  }, [prefs.chime]);

  const energy = useCallback(() => getEngine().energy(), []);

  return { isPlaying, blocked, setLevel, solo, togglePlay, prepareChime, chime, energy };
}
