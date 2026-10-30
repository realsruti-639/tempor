import { useEffect, useRef } from "react";

/**
 * Full-screen dust field. Fades in only while `active` (timer running + audio playing);
 * `getSpeed` is sampled every frame so drift follows audio energy and session progress.
 */
export function ParticleField({ active, getSpeed }: { active: boolean; getSpeed: () => number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeRef = useRef(active);
  const speedRef = useRef(getSpeed);
  const kickRef = useRef<() => void>(() => {});
  activeRef.current = active;
  speedRef.current = getSpeed;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const g = canvas.getContext("2d");
    if (!g) return;

    const STRIDE = 6; // x, y, vx, vy, size, alpha
    let data = new Float32Array(0);
    let count = 0;
    let w = 0;
    let h = 0;
    let raf = 0;
    let last = 0;
    let opacity = 0;
    let color = "#00F0FF";

    const readColor = () => {
      const v = getComputedStyle(document.documentElement).getPropertyValue("--mode").trim();
      if (v) color = v;
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      count = Math.round(Math.min(2400, Math.max(400, (w * h) / 650)));
      data = new Float32Array(count * STRIDE);
      for (let i = 0; i < count; i++) {
        const o = i * STRIDE;
        data[o] = Math.random() * w;
        data[o + 1] = Math.random() * h;
        const a = Math.random() * Math.PI * 2;
        const sp = 4 + Math.random() * 10; // px/s at speed 1
        data[o + 2] = Math.cos(a) * sp + 3;
        data[o + 3] = Math.sin(a) * sp - 4;
        data[o + 4] = Math.random() < 0.85 ? 1 : 1.8;
        data[o + 5] = 0.15 + Math.random() * 0.55;
      }
    };

    const frame = (t: number) => {
      const dt = last ? Math.min(0.05, (t - last) / 1000) : 0.016;
      last = t;
      const target = activeRef.current ? 1 : 0;
      opacity += (target - opacity) * Math.min(1, dt * 1.6);
      g.clearRect(0, 0, w, h);
      if (opacity < 0.005 && target === 0) {
        raf = 0;
        last = 0;
        return;
      }
      const speed = speedRef.current();
      const wob = t * 0.0004;
      g.fillStyle = color;
      for (let i = 0; i < count; i++) {
        const o = i * STRIDE;
        let x = data[o]! + data[o + 2]! * speed * dt + Math.sin(wob + i) * 0.08;
        let y = data[o + 1]! + data[o + 3]! * speed * dt;
        if (x < -2) x = w + 2;
        else if (x > w + 2) x = -2;
        if (y < -2) y = h + 2;
        else if (y > h + 2) y = -2;
        data[o] = x;
        data[o + 1] = y;
        const s = data[o + 4]!;
        g.globalAlpha = data[o + 5]! * opacity;
        g.fillRect(x, y, s, s);
      }
      g.globalAlpha = 1;
      raf = requestAnimationFrame(frame);
    };

    kickRef.current = () => {
      if (!raf) raf = requestAnimationFrame(frame);
    };

    resize();
    readColor();
    const colorTimer = window.setInterval(readColor, 400);
    window.addEventListener("resize", resize);
    if (activeRef.current) kickRef.current();

    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(colorTimer);
      window.removeEventListener("resize", resize);
      kickRef.current = () => {};
    };
  }, []);

  useEffect(() => {
    if (active) kickRef.current();
  }, [active]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  );
}
