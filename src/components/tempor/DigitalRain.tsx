import { useEffect, useRef } from "react";

const GLYPHS = "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉ0123456789ABCDEF:<>/=+";
const CELL = 20;
const FPS = 30;
const BPM = 60; // the visual metronome

/**
 * Slow vertical digital rain for Overclock mode. Redrawn from state each frame
 * (no smear buffer), capped at 30 fps, with a brightness pulse on every beat.
 */
export function DigitalRain() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const g = canvas?.getContext("2d");
    if (!canvas || !g) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    type Col = { y: number; speed: number; len: number; glyphs: string[] };
    let cols: Col[] = [];
    let rows = 0;
    let w = 0;
    let h = 0;
    let raf = 0;
    let last = 0;
    let acc = 0;
    let mode = "#00F0FF";
    let head = "#EAF6FF";

    const glyph = () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)]!;
    const readColors = () => {
      const cs = getComputedStyle(document.documentElement);
      mode = cs.getPropertyValue("--mode").trim() || mode;
      head = cs.getPropertyValue("--foreground").trim() || head;
    };
    const spawn = (c: Col, initial: boolean) => {
      c.speed = 1.1 + Math.random() * 2.2; // rows per second — slow and steady
      c.len = 8 + Math.floor(Math.random() * 14);
      c.y = initial ? Math.random() * (rows + c.len) : -Math.random() * rows * 0.6;
    };
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.font = `${CELL * 0.72}px "JetBrains Mono", ui-monospace, monospace`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      rows = Math.ceil(h / CELL) + 1;
      const n = Math.ceil(w / CELL);
      cols = Array.from({ length: n }, () => {
        const c: Col = { y: 0, speed: 0, len: 0, glyphs: Array.from({ length: rows + 30 }, glyph) };
        spawn(c, true);
        return c;
      });
    };

    const draw = (t: number) => {
      g.clearRect(0, 0, w, h);
      const phase = ((t / 1000) * (BPM / 60)) % 1;
      const beat = Math.exp(-phase / 0.16); // 1 on the beat, decays fast
      g.fillStyle = mode;
      for (let i = 0; i < cols.length; i++) {
        const c = cols[i]!;
        const x = i * CELL + CELL / 2;
        const hy = Math.floor(c.y);
        for (let k = 1; k < c.len; k++) {
          const r = hy - k;
          if (r < 0 || r >= rows) continue;
          g.globalAlpha = Math.pow(1 - k / c.len, 1.6) * 0.55;
          g.fillText(c.glyphs[r]!, x, r * CELL + CELL / 2);
        }
        if (hy >= 0 && hy < rows) {
          g.globalAlpha = 0.55 + beat * 0.45;
          g.fillStyle = head;
          g.fillText(c.glyphs[hy]!, x, hy * CELL + CELL / 2);
          g.fillStyle = mode;
        }
      }
      g.globalAlpha = 1;
    };

    const frame = (t: number) => {
      raf = requestAnimationFrame(frame);
      const dt = last ? Math.min(0.1, (t - last) / 1000) : 0;
      last = t;
      acc += dt;
      if (acc < 1 / FPS) return;
      const step = acc;
      acc = 0;
      for (const c of cols) {
        const before = Math.floor(c.y);
        c.y += c.speed * step;
        if (Math.floor(c.y) !== before && Math.random() < 0.3) {
          c.glyphs[Math.floor(Math.random() * c.glyphs.length)] = glyph();
        }
        if (c.y - c.len > rows) spawn(c, false);
      }
      draw(t);
    };

    resize();
    readColors();
    const colorTimer = window.setInterval(readColors, 800);
    window.addEventListener("resize", resize);
    if (still) draw(0);
    else raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(colorTimer);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={ref} aria-hidden className="pointer-events-none absolute inset-0 h-full w-full opacity-70" />;
}
