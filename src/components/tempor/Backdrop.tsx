export function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-background" />
      <div className="aura absolute inset-0" />
      <div className="starfield animate-twinkle absolute inset-0 opacity-70" />
      <div
        className="starfield absolute inset-0 opacity-40"
        style={{ backgroundPosition: "320px 210px" }}
      />
      <div className="scanlines absolute inset-0" />
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-background to-transparent" />
    </div>
  );
}
