// Mixer catalog: three channels, three free generative tracks each.
// Pure data (no Web Audio) so storage and UI can import it anywhere.

export type ChannelId = "lofi" | "alpha" | "atmos";
export const CHANNEL_IDS: ChannelId[] = ["lofi", "alpha", "atmos"];

export type TrackId =
  | "tokyo-cafe"
  | "neon-horizon"
  | "terminal-echo"
  | "alpha-core"
  | "data-static"
  | "grid-metronome"
  | "hover-car"
  | "arcade-198x"
  | "cyber-garden";

export interface TrackInfo {
  id: TrackId;
  channel: ChannelId;
  name: string;
  /** Short mono descriptor: tempo / texture. */
  meta: string;
}

export interface ChannelInfo {
  id: ChannelId;
  name: string;
  tagline: string;
  tracks: TrackId[];
}

export const TRACKS: Record<TrackId, TrackInfo> = {
  "tokyo-cafe": { id: "tokyo-cafe", channel: "lofi", name: "Tokyo Rain-Slicked Cafe", meta: "72 bpm · rhodes · rain · vinyl" },
  "neon-horizon": { id: "neon-horizon", channel: "lofi", name: "Neon Horizon Shift", meta: "84 bpm · synth pads · arp" },
  "terminal-echo": { id: "terminal-echo", channel: "lofi", name: "Chilled Terminal Echo", meta: "66 bpm · echo plucks · keys" },
  "alpha-core": { id: "alpha-core", channel: "alpha", name: "Deep Space Alpha Core", meta: "10 hz binaural · headphones" },
  "data-static": { id: "data-static", channel: "alpha", name: "Data-Stream Static", meta: "band noise · telemetry" },
  "grid-metronome": { id: "grid-metronome", channel: "alpha", name: "Cyber-Grid Metronome", meta: "60 bpm tick · 10 hz pulse" },
  "hover-car": { id: "hover-car", channel: "atmos", name: "Hover-Car Windshield", meta: "rain · engine hum · wipers" },
  "arcade-198x": { id: "arcade-198x", channel: "atmos", name: "Retro Arcade 198X Ambient", meta: "distant chiptune · room tone" },
  "cyber-garden": { id: "cyber-garden", channel: "atmos", name: "Cybernetic Garden", meta: "wind · synth birds · water" },
};

export const CHANNELS: Record<ChannelId, ChannelInfo> = {
  lofi: {
    id: "lofi",
    name: "Cyber-LoFi Beats",
    tagline: "Soft rhythm to hold the pace",
    tracks: ["tokyo-cafe", "neon-horizon", "terminal-echo"],
  },
  alpha: {
    id: "alpha",
    name: "Cognitive Alpha Waves",
    tagline: "Steady tones for deep attention",
    tracks: ["alpha-core", "data-static", "grid-metronome"],
  },
  atmos: {
    id: "atmos",
    name: "Atmospheric Immersion",
    tagline: "Places to sit inside while you work",
    tracks: ["hover-car", "arcade-198x", "cyber-garden"],
  },
};

export const TRACK_IDS = Object.keys(TRACKS) as TrackId[];
export type ChannelLevels = Record<ChannelId, number>;
export type ChannelTracks = Record<ChannelId, TrackId>;

export const DEFAULT_LEVELS: ChannelLevels = { lofi: 0.7, alpha: 0, atmos: 0 };
export const DEFAULT_TRACKS: ChannelTracks = { lofi: "tokyo-cafe", alpha: "alpha-core", atmos: "hover-car" };

/** The Deck Officer's "favorite synth track". */
export const SYNTH_TRACK: TrackId = "neon-horizon";

export const isTrackId = (v: unknown): v is TrackId => typeof v === "string" && v in TRACKS;
