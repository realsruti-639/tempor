import { cn } from "@/lib/utils";

/** Cassette glyph; reels spin only while audio is actually playing. */
export function Cassette({ playing, className }: { playing: boolean; className?: string }) {
  const reel = cn(
    "origin-center [transform-box:fill-box]",
    playing ? "animate-reel" : "",
  );
  return (
    <svg
      viewBox="0 0 32 22"
      aria-hidden
      className={cn("h-5 w-7 transition-colors", playing ? "text-orchid" : "text-muted-foreground", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinejoin="round"
    >
      <rect x="1.5" y="1.5" width="29" height="19" rx="3" />
      <path d="M8 20.5l2-4h12l2 4" />
      <g className={reel}>
        <circle cx="10" cy="9" r="3.2" />
        <path d="M10 5.8v6.4M6.8 9h6.4" strokeWidth={1} />
      </g>
      <g className={reel}>
        <circle cx="22" cy="9" r="3.2" />
        <path d="M22 5.8v6.4M18.8 9h6.4" strokeWidth={1} />
      </g>
    </svg>
  );
}
