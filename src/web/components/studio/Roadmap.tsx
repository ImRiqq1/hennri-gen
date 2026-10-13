import { motion } from "motion/react"
import { Check } from "lucide-react"
import { Eyebrow, GlassCard } from "@/components/Glass"
import { cn } from "@/lib/utils"

const FASES = [
  { n: 1, nome: "Base no ar", desc: "Worker, D1, R2, chave e login", done: true },
  { n: 2, nome: "Primeiro vídeo", desc: "Seedance 2.5, upload, estimativa, player", done: false },
  { n: 3, nome: "Fila de verdade", desc: "Webhook, cron, variações, galeria", done: false },
  { n: 4, nome: "Controle", desc: "Limites, custos, projetos, presets", done: false },
  { n: 5, nome: "Expansão", desc: "Kling, Wan, imagem, comparar", done: false },
]

const ease = [0.16, 1, 0.3, 1] as const

/** Roteiro como fluxo de nós ligados por curvas (estilo timeline das referências). */
export function Roadmap() {
  const current = FASES.find((f) => !f.done)?.n
  return (
    <GlassCard delay={0.38} className="p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <Eyebrow>Roteiro</Eyebrow>
        <span className="rounded-full bg-surface-2 px-3 py-1 text-xs text-text-2">fase {current} em seguida</span>
      </div>

      <div className="relative mt-6">
        {/* Curvas entre os nós (desktop) */}
        <svg className="pointer-events-none absolute inset-x-0 top-[22px] hidden h-10 w-full md:block" viewBox="0 0 1000 40" preserveAspectRatio="none" aria-hidden>
          {FASES.slice(0, -1).map((f, i) => {
            // Sai da borda de um nó e chega na borda do próximo, com uma barriga suave.
            const x1 = 100 + i * 200 + 30
            const x2 = 100 + (i + 1) * 200 - 30
            const d = `M ${x1} 0 C ${x1 + 50} 30, ${x2 - 50} 30, ${x2} 0`
            return f.done ? (
              <motion.path
                key={f.n}
                d={d}
                fill="none"
                stroke="var(--accent)"
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.9, ease, delay: 0.6 + i * 0.12 }}
              />
            ) : (
              <motion.path
                key={f.n}
                d={d}
                fill="none"
                stroke="var(--line-2)"
                strokeWidth={1.5}
                strokeDasharray="3 6"
                vectorEffect="non-scaling-stroke"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.7 + i * 0.12 }}
              />
            )
          })}
        </svg>

        <ol className="relative grid gap-3 md:grid-cols-5 md:gap-0">
          {FASES.map((f, i) => (
            <motion.li
              key={f.n}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease, delay: 0.5 + i * 0.08 }}
              className="flex items-start gap-4 md:flex-col md:items-center md:px-2 md:text-center"
            >
              <span
                className={cn(
                  "relative grid size-11 shrink-0 place-items-center rounded-full border font-condensed text-lg",
                  f.done && "border-transparent bg-accent text-accent-ink shadow-[0_10px_30px_-8px_rgb(var(--accent-glow)/0.8)]",
                  f.n === current && "glass-2 border-line-2 text-text",
                  !f.done && f.n !== current && "border-line bg-bg-2 text-text-3",
                )}
              >
                {f.n === current && <span className="absolute -inset-1.5 animate-pulse-soft rounded-full border border-accent/50" />}
                {f.done ? <Check className="size-5" strokeWidth={2.5} /> : f.n}
              </span>
              <div className="md:mt-3">
                <p className={cn("text-sm font-semibold uppercase tracking-wide", f.done || f.n === current ? "text-text" : "text-text-3")}>{f.nome}</p>
                <p className="mt-1 text-xs leading-relaxed text-text-3">{f.desc}</p>
              </div>
            </motion.li>
          ))}
        </ol>
      </div>
    </GlassCard>
  )
}
