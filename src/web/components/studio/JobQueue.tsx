import { AnimatePresence, motion } from "motion/react"
import { AlertTriangle, ArrowUpRight, Ban, Check, Copy, Download, Loader2, X } from "lucide-react"
import { useEffect, useState } from "react"
import type { JobView } from "@shared/generation"
import { Dot, Eyebrow, GlassCard, NotchButton } from "@/components/Glass"
import { useToast } from "@/components/Toaster"
import { VideoTile } from "@/components/VideoTile"
import { cancelJob, elapsed, isLive, STATUS_LABEL } from "@/lib/jobs"
import { MODES } from "@/lib/modes"
import { cn } from "@/lib/utils"

const usd = (n: number | null) => (n === null ? "—" : "US$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }))

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [active])
  return now
}

function firstRef(job: JobView) {
  for (const list of Object.values(job.refs)) {
    const img = list.find((r) => /\.(png|jpe?g|webp|gif)(\?|$)/i.test(r.url))
    if (img) return img.url
  }
  return null
}

export function JobCard({ job }: { job: JobView }) {
  const live = isLive(job.status)
  const now = useNow(live)
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const mode = MODES.find((m) => m.id === job.mode)
  const bad = job.status === "failed" || job.status === "nsfw"
  const thumb = firstRef(job)
  const canCancel = job.status === "waiting_slot" || job.status === "queued"
  const isVideo = job.output_mime?.startsWith("video")

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 20, transition: { duration: 0.15 } }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className={cn("overflow-hidden rounded-[18px] border bg-surface", bad ? "border-danger/50" : "border-line")}
    >
      {job.status === "saved" && job.output_url && (
        isVideo ? (
          <VideoTile src={job.output_url} className="aspect-video rounded-none border-0" label={job.prompt ?? "vídeo gerado"} />
        ) : (
          <img src={job.output_url} alt={job.prompt ?? "imagem gerada"} className="aspect-video w-full object-cover" />
        )
      )}
      <div className="p-3">
        <div className="flex items-start gap-2.5">
          {!(job.status === "saved" && job.output_url) && (
            <span className="relative grid size-9 shrink-0 place-items-center overflow-hidden rounded-xl bg-surface-2 text-text-3">
              {thumb ? <img src={thumb} alt="" className="size-full object-cover" /> : <span className="font-mono text-[11px]">{mode?.short ?? "—"}</span>}
              {live && <span className="absolute inset-0 animate-pulse-soft bg-accent/15" />}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-text" title={job.model_id}>
              {job.model_id} <span className="font-normal text-text-3">· {mode?.short}</span>
            </p>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs">
              {live ? (
                <Dot tone="accent" pulse />
              ) : job.status === "saved" ? (
                <Check className="size-3.5 text-accent" strokeWidth={2.5} />
              ) : bad ? (
                <AlertTriangle className="size-3.5 text-danger" />
              ) : (
                <Ban className="size-3.5 text-text-3" />
              )}
              <span className={cn(bad ? "text-danger" : live ? "text-text" : "text-text-2")}>{STATUS_LABEL[job.status]}</span>
              <span className="text-text-3 tabular">· {elapsed(job.created_at, job.completed_at ?? now)}</span>
              <span className="font-mono text-[11px] text-text-3 tabular">· {usd(job.estimated_cost_usd)}</span>
            </div>
          </div>
          <div className="-mt-1 -mr-1 flex shrink-0">
            {canCancel && (
              <button
                type="button"
                disabled={busy}
                aria-label="Cancelar job"
                title="Cancelar (só enquanto está na fila)"
                onClick={async () => {
                  setBusy(true)
                  const err = await cancelJob(job.id)
                  setBusy(false)
                  toast(err ? { title: "Não deu pra cancelar", detail: err, tone: "error" } : { title: "Job cancelado", detail: "Não foi cobrado." })
                }}
                className="grid size-8 place-items-center rounded-full text-text-3 transition-colors hover:bg-surface-2 hover:text-text"
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
              </button>
            )}
            {job.status === "saved" && job.output_url && (
              <>
                <button
                  type="button"
                  aria-label="Copiar prompt"
                  title="Copiar prompt"
                  onClick={() => {
                    void navigator.clipboard.writeText(job.prompt ?? "")
                    toast({ title: "Prompt copiado" })
                  }}
                  className="grid size-8 place-items-center rounded-full text-text-3 transition-colors hover:bg-surface-2 hover:text-text"
                >
                  <Copy className="size-4" />
                </button>
                <a
                  href={job.output_url}
                  download
                  aria-label="Baixar"
                  title="Baixar"
                  className="grid size-8 place-items-center rounded-full text-text-3 transition-colors hover:bg-surface-2 hover:text-text"
                >
                  <Download className="size-4" />
                </a>
              </>
            )}
          </div>
        </div>
        {job.error && <p className={cn("mt-1.5 text-xs", bad ? "text-danger" : "text-text-3")}>{job.error}</p>}
        {job.prompt && !bad && <p className="mt-1.5 line-clamp-2 text-xs text-text-3">{job.prompt}</p>}
      </div>
    </motion.li>
  )
}

/** Fila: em andamento + terminados nos últimos 30 min. */
export function JobQueue({ jobs }: { jobs: JobView[] | null }) {
  const live = (jobs ?? []).filter((j) => isLive(j.status))
  const waiting = live.filter((j) => j.status === "waiting_slot").length
  return (
    <GlassCard
      delay={0.14}
      className="p-4"
      corner={
        <NotchButton disabled title="Fila completa e galeria chegam na fase 3" aria-label="Abrir fila (fase 3)">
          <ArrowUpRight className="size-[18px]" strokeWidth={1.8} />
        </NotchButton>
      }
    >
      <Eyebrow>
        <Dot tone={live.length ? "accent" : "idle"} pulse={live.length > 0} /> Fila
      </Eyebrow>
      <div className="mt-2 flex items-baseline gap-2 pr-12">
        <span className="display-num text-metric-sm text-text">{live.length}</span>
        <span className="text-[13px] text-text-2">
          {live.length ? `${live.length === 1 ? "job" : "jobs"} em andamento` : "nada gerando"}
          {waiting ? ` · ${waiting} aguardando vaga` : ""}
        </span>
      </div>
      {jobs === null ? (
        <div className="mt-3 flex flex-col gap-2">
          <span className="skeleton h-16 rounded-[18px]" />
        </div>
      ) : jobs.length === 0 ? (
        <p className="mt-3 rounded-[16px] border border-dashed border-line-2 px-3 py-4 text-center text-[13px] text-text-3">
          Os jobs aparecem aqui com status, tempo e custo.
        </p>
      ) : (
        <ul className="mt-3 flex max-h-[60vh] flex-col gap-2 overflow-y-auto pr-0.5">
          <AnimatePresence initial={false}>
            {jobs.map((j) => (
              <JobCard key={j.id} job={j} />
            ))}
          </AnimatePresence>
        </ul>
      )}
    </GlassCard>
  )
}
