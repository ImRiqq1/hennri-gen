// Atmosfera atrás do vidro: duas massas de luz que derivam devagar (tingidas pelo
// destaque), um véu neutro e grão de filme. Fica fixo e fora do fluxo de eventos.

const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")"

export function Ambient() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div
        className="absolute -top-[18%] -left-[8%] size-[46vmax] animate-drift-a rounded-full blur-[90px]"
        style={{
          opacity: "var(--orb-opacity)",
          background: "radial-gradient(circle, rgb(var(--accent-glow) / 0.5), transparent 65%)",
        }}
      />
      <div
        className="absolute -right-[10%] -bottom-[22%] size-[44vmax] animate-drift-b rounded-full blur-[100px]"
        style={{
          opacity: "var(--orb-opacity)",
          background: "radial-gradient(circle, rgb(var(--accent-glow) / 0.32), transparent 65%)",
        }}
      />
      <div
        className="absolute top-[30%] left-[40%] size-[45vmax] animate-drift-b rounded-full blur-[120px]"
        style={{ opacity: 0.5, background: "radial-gradient(circle, var(--surface-2), transparent 65%)" }}
      />
      {/* trama fina de pontos, como a grade das referências */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: "radial-gradient(var(--line-2) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          maskImage: "radial-gradient(ellipse at 50% 30%, #000 10%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse at 50% 30%, #000 10%, transparent 75%)",
          opacity: 0.5,
        }}
      />
      <div className="absolute inset-0 mix-blend-overlay" style={{ backgroundImage: GRAIN, opacity: "var(--grain-opacity)" }} />
    </div>
  )
}
