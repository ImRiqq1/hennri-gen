import { motion } from "motion/react"
import { ArrowUpRight, Play } from "lucide-react"
import { Eyebrow, GlassCard, NotchButton } from "@/components/Glass"
import type { Stats } from "@/lib/api"
import type { PollState } from "@/lib/usePoll"

// Molduras vazias nas proporções que o site gera: mostram onde os vídeos vão morar,
// sem inventar conteúdo.
const FRAMES = [
  { r: "9 / 16", w: 150 },
  { r: "16 / 9", w: 300 },
  { r: "1 / 1", w: 200 },
  { r: "9 / 16", w: 150 },
  { r: "4 / 3", w: 240 },
  { r: "21 / 9", w: 340 },
  { r: "3 / 4", w: 170 },
]

export function GalleryPeek({ stats }: { stats: PollState<Stats> }) {
  const saved = stats.kind === "ok" ? stats.data.gallery.saved : null
  return (
    <GlassCard
      delay={0.32}
      className="overflow-hidden p-5 sm:p-6"
      corner={
        <NotchButton disabled title="Galeria chega na fase 3" aria-label="Abrir galeria">
          <ArrowUpRight className="size-5" strokeWidth={1.8} />
        </NotchButton>
      }
    >
      <div className="flex flex-wrap items-end gap-x-6 gap-y-2 pr-14">
        <div>
          <Eyebrow>Galeria</Eyebrow>
          <p className="mt-2 font-condensed text-3xl uppercase leading-none text-text">
            {saved ? `${saved} salvos` : "Ainda vazia"}
          </p>
        </div>
        <p className="pb-0.5 text-sm text-text-2">Cada vídeo fica no R2 com prompt, modelo e parâmetros — além dos 7 dias da Higgsfield.</p>
      </div>
      <div className="no-scrollbar -mx-5 mt-6 flex items-end gap-3 overflow-x-auto px-5 pb-1 sm:-mx-6 sm:px-6">
        {FRAMES.map((f, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.4 + i * 0.05 }}
            whileHover={{ y: -6 }}
            className="skeleton relative h-[150px] shrink-0 overflow-hidden rounded-[22px] border border-line sm:h-[190px]"
            style={{ aspectRatio: f.r }}
          >
            <span className="absolute inset-0 grid place-items-center">
              <span className="grid size-10 place-items-center rounded-full bg-surface-2 text-text-3">
                <Play className="size-4" fill="currentColor" />
              </span>
            </span>
            <span className="absolute bottom-2.5 left-2.5 rounded-full bg-surface-2 px-2 py-0.5 text-[10px] text-text-3 tabular">{f.r.replace(/ /g, "")}</span>
          </motion.div>
        ))}
      </div>
    </GlassCard>
  )
}
