import { useEffect, useRef } from "react";

export interface BurstEvent {
  id: number;
  x: number;
  y: number;
  credits: number;
}

const COLORS = ["--cyan", "--orchid", "--amber", "--lavender", "--terminal"];

/** One-shot neon particle burst + floating "+N GRID CREDITS" label. */
export function CelebrationBurst({ event }: { event: BurstEvent | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!event) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const g = canvas.getContext("2d");
    if (!g) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);

    const css = getComputedStyle(document.documentElement);
    const palette = COLORS.map((c) => css.getPropertyValue(c).trim() || "#00F0FF");
    const N = 180;
    const ps = Array.from({ length: N }, () => {
      const a = Math.random() * Math.PI * 2;
      const sp = 120 + Math.random() * 520;
      return {
        x: event.x,
        y: event.y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        size: 1.5 + Math.random() * 2.5,
        color: palette[Math.floor(Math.random() * palette.length)]!,
        life: 0.9 + Math.random() * 0.9,
      };
    });

    let raf = 0;
    let last = 0;
    let elapsed = 0;
    const frame = (t: number) => {
      const dt = last ? Math.min(0.05, (t - last) / 1000) : 0.016;
      last = t;
      elapsed += dt;
      g.clearRect(0, 0, w, h);
      let alive = 0;
      for (const p of ps) {
        const k = 1 - elapsed / p.life;
        if (k <= 0) continue;
        alive++;
        p.vx *= 0.94;
        p.vy = p.vy * 0.94 + 30 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        g.globalAlpha = k;
        g.fillStyle = p.color;
        g.shadowColor = p.color;
        g.shadowBlur = 8;
        g.fillRect(p.x, p.y, p.size, p.size);
      }
      g.globalAlpha = 1;
      g.shadowBlur = 0;
      if (alive > 0) raf = requestAnimationFrame(frame);
      else g.clearRect(0, 0, w, h);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [event]);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-40">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      {event && event.credits > 0 && (
        <div
          key={event.id}
          className="animate-credit-float absolute whitespace-nowrap rounded-full border border-cyan/40 bg-background/70 px-4 py-1.5 font-mono text-sm tracking-widest text-cyan shadow-[0_0_30px_-4px_var(--cyan)] backdrop-blur-md"
          style={{ left: event.x, top: event.y - 24 }}
        >
          +{event.credits} GRID CREDITS
        </div>
      )}
      {event && (
        <div
          key={`wash-${event.id}`}
          className="animate-wash wash-gradient absolute left-1/2 top-1/2 -ml-[60vmax] -mt-[60vmax] h-[120vmax] w-[120vmax] rounded-full"
        />
      )}
    </div>
  );
}
