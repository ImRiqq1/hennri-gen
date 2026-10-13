// Fundo: grade fina de linhas que some nas bordas + grão de filme quase invisível.
// Sem manchas de luz desfocadas — a profundidade vem das sombras dos painéis.

const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")"

const FADE = "radial-gradient(ellipse 80% 60% at 50% 0%, #000 20%, transparent 80%)"

export function Ambient() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(var(--grid-line) 1px, transparent 1px), linear-gradient(90deg, var(--grid-line) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
          backgroundPosition: "-1px -1px",
          maskImage: FADE,
          WebkitMaskImage: FADE,
        }}
      />
      <div className="absolute inset-0 mix-blend-overlay" style={{ backgroundImage: GRAIN, opacity: "var(--grain-opacity)" }} />
    </div>
  )
}
