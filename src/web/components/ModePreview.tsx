import { motion } from "motion/react"

// Mini-ilustrações dos modos, em traço fino. Paradas e discretas; no hover do card ganham vida.
// Só transform/opacity — nada que custe layout.

const ease = [0.16, 1, 0.3, 1] as const
const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.5, vectorEffect: "non-scaling-stroke" as const }

function Frame({ x, y, w, h, className }: { x: number; y: number; w: number; h: number; className?: string }) {
  return <rect x={x} y={y} width={w} height={h} rx={5} {...stroke} className={className} />
}

export function ModePreview({ modeId, active }: { modeId: string; active: boolean }) {
  const t = { duration: 0.55, ease }
  return (
    <svg viewBox="0 0 120 64" aria-hidden className="h-12 w-[92px] text-text-3 transition-colors duration-200 group-hover:text-text">
      {modeId === "i2v" && (
        <>
          <Frame x={4} y={14} w={34} h={36} />
          <motion.path d="M46 32 H70" {...stroke} strokeDasharray="3 4" animate={{ pathLength: active ? 1 : 0.35, opacity: active ? 1 : 0.5 }} transition={t} />
          <motion.path d="M66 27 L72 32 L66 37" {...stroke} animate={{ x: active ? 0 : -6, opacity: active ? 1 : 0 }} transition={t} />
          <motion.g animate={{ x: active ? 0 : -10, opacity: active ? 1 : 0.4 }} transition={t}>
            <Frame x={80} y={14} w={34} h={36} />
            <path d="M93 25 L104 32 L93 39 Z" fill="currentColor" />
          </motion.g>
        </>
      )}
      {modeId === "ref" &&
        [0, 1, 2].map((i) => (
          <motion.g
            key={i}
            animate={{ x: active ? (i - 1) * 30 : (i - 1) * 6, rotate: active ? (i - 1) * 4 : (i - 1) * 8, opacity: active ? 1 : 0.5 + i * 0.2 }}
            transition={{ ...t, delay: i * 0.04 }}
            style={{ originX: "60px", originY: "32px" }}
          >
            <Frame x={45} y={12} w={30} h={40} />
            {i === 1 && <circle cx={60} cy={28} r={5} {...stroke} />}
          </motion.g>
        ))}
      {modeId === "genjutsu" && (
        <>
          <Frame x={20} y={8} w={80} h={48} />
          {/* silhueta original */}
          <path d="M52 50 C52 40 56 34 60 34 C64 34 68 40 68 50 M60 31 a6 6 0 1 0 0.01 0" {...stroke} />
          {/* varredura que troca o personagem */}
          <motion.rect x={20} y={8} width={6} height={48} fill="currentColor" opacity={0.18} animate={{ x: active ? 74 : 0, opacity: active ? [0.25, 0.25, 0] : 0.12 }} transition={{ duration: 0.8, ease }} />
          <motion.path
            d="M48 50 L50 38 L60 33 L70 38 L72 50"
            {...stroke}
            animate={{ pathLength: active ? 1 : 0, opacity: active ? 1 : 0 }}
            transition={{ duration: 0.6, ease, delay: active ? 0.25 : 0 }}
          />
        </>
      )}
      {modeId === "cinema" && (
        <>
          {/* cantos de enquadramento (eco do símbolo MISE.IA) */}
          <motion.g animate={{ scale: active ? 0.82 : 1 }} transition={t} style={{ originX: "60px", originY: "32px" }}>
            <path d="M18 18 V8 H30 M90 8 H102 V18 M102 46 V56 H90 M30 56 H18 V46" {...stroke} />
          </motion.g>
          <motion.circle cx={60} cy={32} r={3} fill="currentColor" animate={{ x: active ? [0, 14, -10, 0] : 0, y: active ? [0, -6, 5, 0] : 0 }} transition={{ duration: 1.4, ease: "easeInOut" }} />
          <motion.path d="M40 32 H50 M70 32 H80" {...stroke} animate={{ opacity: active ? 1 : 0.3 }} transition={t} />
        </>
      )}
    </svg>
  )
}
