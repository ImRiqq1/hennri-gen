import { motion } from "motion/react"
import { ArrowUpRight, Clapperboard, Sparkles } from "lucide-react"
import { Link, useNavigate } from "react-router-dom"
import { Eyebrow, GlassCard, NotchButton } from "@/components/Glass"
import type { Stats } from "@/lib/api"
import { useSavedJobs } from "@/lib/jobs"
import type { PollState } from "@/lib/usePoll"
import { VideoTile } from "@/components/VideoTile"

// Estado vazio de verdade: três molduras de linha fina (9:16, 16:9, 1:1) empilhadas,
// uma frase e o atalho pra começar — nada que pareça conteúdo carregando.
function EmptyFrames() {
  const frames = [
    { w: 34, h: 60, x: 0, r: -6 },
    { w: 96, h: 54, x: 22, r: 0 },
    { w: 50, h: 50, x: 96, r: 6 },
  ]
  return (
    <div aria-hidden className="relative h-[64px] w-[150px] shrink-0">
      {frames.map((f, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0, y: 8, rotate: 0 }}
          animate={{ opacity: 1, y: 0, rotate: f.r }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.3 + i * 0.06 }}
          className="absolute bottom-0 rounded-[8px] border border-dashed border-line-2 bg-surface"
          style={{ width: f.w, height: f.h, left: f.x }}
        />
      ))}
      <span className="absolute bottom-[18px] left-[62px] grid size-6 place-items-center rounded-full bg-invert text-invert-ink">
        <Clapperboard className="size-3" strokeWidth={2} />
      </span>
    </div>
  )
}

export function GalleryPeek({ stats }: { stats: PollState<Stats> }) {
  const saved = stats.kind === "ok" ? stats.data.gallery.saved : null
  const recent = useSavedJobs(6)
  const navigate = useNavigate()
  return (
    <GlassCard
      delay={0.32}
      className="p-5"
      corner={
        <NotchButton aria-label="Abrir a Galeria" title="Abrir a Galeria" onClick={() => navigate("/galeria")}>
          <ArrowUpRight className="size-[18px]" strokeWidth={1.8} />
        </NotchButton>
      }
    >
      <Eyebrow>Galeria</Eyebrow>
      {saved && recent?.length ? (
        <>
          <p className="display-title mt-2 text-card text-text">
            {saved} {saved === 1 ? "resultado salvo" : "resultados salvos"}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 pr-0 sm:grid-cols-3">
            {recent.map((j) =>
              j.output_mime?.startsWith("video") ? (
                <VideoTile key={j.id} src={j.output_url!} className="aspect-video" label={j.prompt ?? j.model_id} />
              ) : (
                <img key={j.id} src={j.output_url!} alt={j.prompt ?? j.model_id} className="aspect-video w-full rounded-[18px] border border-line object-cover" />
              ),
            )}
          </div>
        </>
      ) : (
        <div className="mt-3 flex flex-col gap-4 pr-12 sm:flex-row sm:items-center">
          <EmptyFrames />
          <div className="min-w-0 flex-1">
            <p className="text-card font-medium tracking-[-0.02em] text-text">Nenhum vídeo ainda</p>
            <p className="mt-1 text-[13px] text-text-2">
              Cada resultado fica salvo no R2 com prompt, modelo e parâmetros — além dos 7 dias da Higgsfield.
            </p>
          </div>
          <Link
            to="/criar"
            className="flex h-9 shrink-0 items-center gap-2 self-start rounded-full border border-line-2 px-3.5 text-sm text-text transition-colors hover:bg-surface-2 sm:self-center"
          >
            <Sparkles className="size-3.5" /> Criar o primeiro <span className="kbd ml-0.5">N</span>
          </Link>
        </div>
      )}
    </GlassCard>
  )
}
