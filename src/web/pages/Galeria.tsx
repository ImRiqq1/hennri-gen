import { AnimatePresence, motion } from "motion/react"
import {
  AlertTriangle,
  ArrowRight,
  Copy,
  Download,
  FastForward,
  Film,
  GitBranch,
  ImageIcon,
  Loader2,
  PenLine,
  Repeat,
  Search,
  Star,
  Wand2,
  X,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import type { JobView } from "@shared/generation"
import { Eyebrow, GlassCard } from "@/components/Glass"
import { ConfirmCost } from "@/components/studio/Estimate"
import { genjutsuVideoRules } from "@/components/studio/MediaInputs"
import { useToast } from "@/components/Toaster"
import { VideoTile } from "@/components/VideoTile"
import { addFiles } from "@/lib/media"
import { JOBS_CHANGED, STATUS_LABEL } from "@/lib/jobs"
import { MODES } from "@/lib/modes"
import { captureLastFrame, prefillFrom, reuseAsReference, setPrefill } from "@/lib/reuse"
import { useFocusTrap } from "@/lib/useFocusTrap"
import { cn } from "@/lib/utils"

const ease = [0.16, 1, 0.3, 1] as const
const usd = (n: number | null) => (n === null ? "—" : "US$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
const when = (t: number) => new Date(t).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).replace(".", "")
const MiB = 1024 * 1024

type Filters = { status: "saved" | "failed" | "all"; mode: string; favorite: boolean; q: string }

function useGallery(f: Filters) {
  const [items, setItems] = useState<JobView[] | null>(null)
  const [next, setNext] = useState<number | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)

  const query = useCallback(
    (before?: number) => {
      const p = new URLSearchParams({ limit: "24" })
      if (f.status !== "all") p.set("status", f.status)
      if (f.mode) p.set("mode", f.mode)
      if (f.favorite) p.set("favorite", "1")
      if (f.q.trim()) p.set("q", f.q.trim())
      if (before) p.set("before", String(before))
      return fetch(`/api/jobs?${p}`).then((r) => r.json() as Promise<{ jobs: JobView[]; next: number | null }>)
    },
    [f.status, f.mode, f.favorite, f.q],
  )

  useEffect(() => {
    let alive = true
    const t = window.setTimeout(() => {
      query()
        .then((b) => {
          if (!alive) return
          setItems(b.jobs)
          setNext(b.next)
        })
        .catch(() => alive && setItems([]))
    }, 200)
    const reload = () => void query().then((b) => alive && (setItems(b.jobs), setNext(b.next)))
    window.addEventListener(JOBS_CHANGED, reload)
    return () => {
      alive = false
      window.clearTimeout(t)
      window.removeEventListener(JOBS_CHANGED, reload)
    }
  }, [query])

  const more = async () => {
    if (!next) return
    setLoadingMore(true)
    const b = await query(next).catch(() => null)
    setLoadingMore(false)
    if (b) {
      setItems((cur) => [...(cur ?? []), ...b.jobs])
      setNext(b.next)
    }
  }
  const patchItem = (id: string, p: Partial<JobView>) => setItems((cur) => cur?.map((j) => (j.id === id ? { ...j, ...p } : j)) ?? cur)
  return { items, next, more, loadingMore, patchItem }
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "relative flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors",
        on ? "bg-invert text-invert-ink" : "text-text-2 hover:bg-surface-2 hover:text-text",
      )}
    >
      {children}
    </button>
  )
}

async function toggleFavorite(job: JobView) {
  await fetch(`/api/jobs/${job.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ favorite: !job.favorite }) })
}

function Tile({ job, onOpen, onFav }: { job: JobView; onOpen: () => void; onFav: () => void }) {
  const mode = MODES.find((m) => m.id === job.mode)
  const ready = job.status === "saved" && job.output_url
  const isVideo = job.output_mime?.startsWith("video")
  return (
    <motion.li layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease }} className="group/tile relative">
      <button type="button" onClick={onOpen} className="block w-full text-left" aria-label={`Abrir ${job.model_id} de ${when(job.created_at)}`}>
        {ready ? (
          isVideo ? (
            <VideoTile src={job.output_url!} className="aspect-video" label={job.prompt ?? job.model_id} />
          ) : (
            <img src={job.output_url!} alt={job.prompt ?? job.model_id} loading="lazy" className="aspect-video w-full rounded-[18px] border border-line object-cover" />
          )
        ) : (
          <span className="grid aspect-video w-full place-items-center rounded-[18px] border border-dashed border-line-2 bg-surface text-center text-xs text-text-3">
            <span className="flex flex-col items-center gap-1.5 px-4">
              <AlertTriangle className={cn("size-5", job.status === "failed" || job.status === "nsfw" ? "text-danger" : "text-text-3")} />
              {STATUS_LABEL[job.status]}
              {job.error && <span className="line-clamp-2">{job.error}</span>}
            </span>
          </span>
        )}
      </button>
      <div className="mt-2 flex items-start gap-2 px-0.5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-text">
            {job.model_id} <span className="text-text-3">· {mode?.short}</span>
          </p>
          <p className="truncate font-mono text-[11px] text-text-3">
            {when(job.created_at)} · {usd(job.status === "saved" ? job.estimated_cost_usd : 0)}
          </p>
        </div>
        <button
          type="button"
          onClick={onFav}
          aria-pressed={job.favorite}
          aria-label={job.favorite ? "Tirar dos favoritos" : "Favoritar"}
          className={cn("grid size-8 place-items-center rounded-full transition-colors hover:bg-surface-2", job.favorite ? "text-accent" : "text-text-3 hover:text-text")}
        >
          <Star className="size-4" fill={job.favorite ? "currentColor" : "none"} />
        </button>
      </div>
    </motion.li>
  )
}

function Detail({ job, onClose, onFav, onOpenJob }: { job: JobView; onClose: () => void; onFav: () => void; onOpenJob: (id: string) => void }) {
  const trap = useFocusTrap<HTMLDivElement>(true)
  const navigate = useNavigate()
  const toast = useToast()
  const [busy, setBusy] = useState<string | null>(null)
  const [confirm, setConfirm] = useState(false)
  const mode = MODES.find((m) => m.id === job.mode)
  const isVideo = job.output_mime?.startsWith("video")
  const params = job.params as Record<string, unknown>
  const genSecs = job.completed_at && job.created_at ? Math.round((job.completed_at - job.created_at) / 1000) : null
  const refs = Object.entries(job.refs).flatMap(([slot, list]) => list.map((r, i) => ({ slot, i, ...r })))

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", k)
    return () => window.removeEventListener("keydown", k)
  }, [onClose])

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label)
    try {
      await fn()
    } catch (e) {
      toast({ title: "Não deu certo", detail: (e as Error).message, tone: "error" })
    } finally {
      setBusy(null)
    }
  }

  const redo = (confirmed: boolean) =>
    run("redo", async () => {
      setConfirm(false)
      const r = await fetch(`/api/jobs/${job.id}/redo`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmed }) })
      const b = (await r.json().catch(() => null)) as { error?: string; needsConfirm?: boolean } | null
      if (r.status === 409 && b?.needsConfirm) return setConfirm(true)
      if (!r.ok) throw new Error(b?.error ?? `HTTP ${r.status}`)
      window.dispatchEvent(new Event(JOBS_CHANGED))
      toast({ title: "Refazendo", detail: "Mesmo pedido, geração nova — acompanhe na fila do Criar.", tone: "success" })
    })

  const reuse = (target: "genjutsu" | "edit" | "extend" | "i2v") =>
    run(target, async () => {
      const rules =
        target === "genjutsu"
          ? genjutsuVideoRules("Motion transfer")
          : target === "i2v"
            ? { kinds: ["image" as const], max: 1 }
            : { kinds: ["video" as const], max: 1, trimAt: 30, maxBytes: { video: 200 * MiB } }
      const slot = target === "i2v" ? "i2v:first" : `${target}:video`
      navigate(`/criar?modo=${target}`)
      const refused = await reuseAsReference(job, slot, rules)
      refused.forEach((r) => toast({ title: "Arquivo recusado", detail: r, tone: "error" }))
    })

  const continueScene = () =>
    run("continue", async () => {
      const frame = await captureLastFrame(job.output_url!)
      setPrefill({ ...prefillFrom(job), modeId: "i2v", model: "Seedance 2.5", prompt: "" })
      navigate("/criar?modo=i2v")
      await addFiles("i2v:first", [frame], { kinds: ["image"], max: 1 })
      toast({ title: "Último frame virou o primeiro", detail: "Descreva o que acontece a seguir." })
    })

  const actionBtn = "flex h-9 items-center gap-2 rounded-full border border-line-2 px-3 text-sm text-text transition-colors hover:bg-surface-2 disabled:opacity-50"

  return (
    <motion.div className="fixed inset-0 z-[95] flex justify-end" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.15 } }}>
      <button type="button" aria-label="Fechar detalhe" onClick={onClose} className="absolute inset-0 bg-black/50" />
      <motion.div
        ref={trap}
        role="dialog"
        aria-modal="true"
        aria-label="Detalhe do resultado"
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%", transition: { duration: 0.18, ease: [0.7, 0, 0.84, 0] } }}
        transition={{ duration: 0.32, ease }}
        className="glass relative m-3 flex w-full max-w-[560px] flex-col overflow-y-auto rounded-[28px] p-5"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Eyebrow>{mode?.label ?? job.mode}</Eyebrow>
            <h2 className="display-title mt-1.5 text-card text-text">{job.model_id}</h2>
            <p className="mt-1 font-mono text-[11px] text-text-3">
              {when(job.created_at)} · {STATUS_LABEL[job.status]}
              {genSecs ? ` · gerou em ${genSecs}s` : ""}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="grid size-9 place-items-center rounded-full text-text-2 hover:bg-surface-2 hover:text-text">
            <X className="size-5" />
          </button>
        </div>

        <div className="mt-4 overflow-hidden rounded-[18px] border border-line bg-black">
          {job.output_url ? (
            isVideo ? (
              <video src={job.output_url} controls autoPlay muted loop playsInline className="aspect-video w-full" />
            ) : (
              <img src={job.output_url} alt={job.prompt ?? ""} className="w-full" />
            )
          ) : (
            <div className="grid aspect-video place-items-center p-6 text-center text-sm text-text-2">{job.error ?? STATUS_LABEL[job.status]}</div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {job.output_url && (
            <a href={job.output_url} download className={actionBtn}>
              <Download className="size-4" /> Baixar
            </a>
          )}
          <button
            type="button"
            className={actionBtn}
            onClick={() => {
              void navigator.clipboard.writeText(job.prompt ?? "")
              toast({ title: "Prompt copiado" })
            }}
          >
            <Copy className="size-4" /> Copiar prompt
          </button>
          <button type="button" className={cn(actionBtn, job.favorite && "border-accent text-accent")} onClick={onFav} aria-pressed={job.favorite}>
            <Star className="size-4" fill={job.favorite ? "currentColor" : "none"} /> {job.favorite ? "Favorito" : "Favoritar"}
          </button>
          <button type="button" className={actionBtn} disabled={!!busy} onClick={() => redo(false)}>
            {busy === "redo" ? <Loader2 className="size-4 animate-spin" /> : <Repeat className="size-4" />} Refazer igual
          </button>
          <button
            type="button"
            className={actionBtn}
            onClick={() => {
              setPrefill(prefillFrom(job))
              navigate(`/criar?modo=${job.mode}`)
            }}
          >
            <PenLine className="size-4" /> Refazer editando
          </button>
        </div>

        {job.output_url && (
          <div className="mt-4">
            <p className="label mb-2">Usar este resultado</p>
            <div className="flex flex-wrap gap-2">
              {isVideo ? (
                <>
                  <button type="button" className={actionBtn} disabled={!!busy} onClick={continueScene}>
                    {busy === "continue" ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />} Continuar cena
                  </button>
                  <button type="button" className={actionBtn} disabled={!!busy} onClick={() => reuse("extend")}>
                    <FastForward className="size-4" /> Estender com Seedance
                  </button>
                  <button type="button" className={actionBtn} disabled={!!busy} onClick={() => reuse("genjutsu")}>
                    <Wand2 className="size-4" /> Abrir no Genjutsu
                  </button>
                  <button type="button" className={actionBtn} disabled={!!busy} onClick={() => reuse("edit")}>
                    <Film className="size-4" /> Editar vídeo
                  </button>
                </>
              ) : (
                <button type="button" className={actionBtn} disabled={!!busy} onClick={() => reuse("i2v")}>
                  <ImageIcon className="size-4" /> Usar como primeiro frame
                </button>
              )}
            </div>
          </div>
        )}

        {job.prompt && (
          <div className="mt-5">
            <p className="label mb-1.5">Prompt</p>
            <p className="rounded-[14px] bg-surface p-3 text-sm leading-relaxed whitespace-pre-wrap text-text">{job.prompt}</p>
          </div>
        )}

        <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
          {[
            ["Custo", job.status === "saved" ? usd(job.estimated_cost_usd) : `${usd(0)} (não cobrado)`],
            ["Cálculo", job.estimate_basis ?? "—"],
            ["Resolução", String(params.resolution ?? "—")],
            ["Duração", params.duration ? `${params.duration} s` : "—"],
            ["Proporção", String(params.aspect ?? "—")],
            ["Áudio", params.audio ? "com áudio" : "sem áudio"],
          ].map(([k, v]) => (
            <div key={k} className="min-w-0">
              <dt className="label">{k}</dt>
              <dd className="mt-0.5 truncate text-text" title={v}>
                {v}
              </dd>
            </div>
          ))}
        </dl>

        {refs.length > 0 && (
          <div className="mt-5">
            <p className="label mb-2">Referências usadas</p>
            <div className="grid grid-cols-5 gap-2">
              {refs.map((r) =>
                /\.(png|jpe?g|webp|gif)(\?|$)/i.test(r.url) ? (
                  <img key={r.slot + r.i} src={r.url} alt="" className="aspect-square rounded-[10px] border border-line object-cover" />
                ) : (
                  <span key={r.slot + r.i} className="grid aspect-square place-items-center rounded-[10px] border border-line bg-surface font-mono text-[11px] text-text-3">
                    {r.slot.split(":")[1]}
                  </span>
                ),
              )}
            </div>
          </div>
        )}

        {job.parent_job_id && (
          <button type="button" onClick={() => onOpenJob(job.parent_job_id!)} className="mt-5 flex items-center gap-2 text-sm text-text-2 hover:text-text">
            <GitBranch className="size-4" /> Veio de outro job (refeito) — abrir o original
          </button>
        )}
        <ConfirmCost
          open={confirm}
          total={job.estimated_cost_usd}
          guard={{ overDay: false, needsConfirm: true, remainingDay: null, confirmAbove: null }}
          onCancel={() => setConfirm(false)}
          onConfirm={() => redo(true)}
        />
      </motion.div>
    </motion.div>
  )
}

export function Galeria() {
  const [f, setF] = useState<Filters>({ status: "saved", mode: "", favorite: false, q: "" })
  const { items, next, more, loadingMore, patchItem } = useGallery(f)
  const [openId, setOpenId] = useState<string | null>(null)
  const [extra, setExtra] = useState<JobView | null>(null)
  const open = useMemo(() => items?.find((j) => j.id === openId) ?? (extra?.id === openId ? extra : null), [items, openId, extra])

  const fav = async (job: JobView) => {
    patchItem(job.id, { favorite: !job.favorite })
    if (extra?.id === job.id) setExtra({ ...job, favorite: !job.favorite })
    await toggleFavorite(job)
  }
  const openJob = async (id: string) => {
    if (!items?.some((j) => j.id === id)) {
      const r = await fetch(`/api/jobs/${id}`).then((x) => x.json() as Promise<{ job?: JobView }>)
      if (r.job) setExtra(r.job)
    }
    setOpenId(id)
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Eyebrow>Resultados</Eyebrow>
        <h1 className="display-title mt-3 text-page text-text">
          Galeria<span className="text-accent">.</span>
        </h1>
      </div>

      <GlassCard className="flex flex-wrap items-center gap-2 p-2">
        <div className="flex gap-1 rounded-full bg-surface p-1">
          {(["saved", "failed", "all"] as const).map((s) => (
            <Chip key={s} on={f.status === s} onClick={() => setF((x) => ({ ...x, status: s }))}>
              {s === "saved" ? "Prontos" : s === "failed" ? "Falhas" : "Todos"}
            </Chip>
          ))}
        </div>
        <div className="no-scrollbar flex max-w-full gap-1 overflow-x-auto">
          <Chip on={!f.mode} onClick={() => setF((x) => ({ ...x, mode: "" }))}>
            Todos os modos
          </Chip>
          {MODES.map((m) => (
            <Chip key={m.id} on={f.mode === m.id} onClick={() => setF((x) => ({ ...x, mode: m.id }))}>
              {m.short}
            </Chip>
          ))}
        </div>
        <Chip on={f.favorite} onClick={() => setF((x) => ({ ...x, favorite: !x.favorite }))}>
          <Star className="size-3.5" fill={f.favorite ? "currentColor" : "none"} /> Favoritos
        </Chip>
        <label className="ml-auto flex h-9 min-w-[200px] items-center gap-2 rounded-full border border-line-2 px-3 text-sm text-text-3 focus-within:border-text-3">
          <Search className="size-4" />
          <input
            value={f.q}
            onChange={(e) => setF((x) => ({ ...x, q: e.target.value }))}
            placeholder="Buscar no prompt…"
            aria-label="Buscar no prompt"
            className="w-full bg-transparent text-text outline-none placeholder:text-text-3"
          />
        </label>
      </GlassCard>

      {items === null ? (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
          {Array.from({ length: 6 }, (_, i) => (
            <li key={i} className="skeleton aspect-video rounded-[18px]" />
          ))}
        </ul>
      ) : items.length === 0 ? (
        <GlassCard className="grid place-items-center p-10 text-center">
          <p className="text-card font-medium text-text">Nada por aqui</p>
          <p className="mt-1 text-sm text-text-2">
            {f.favorite || f.mode || f.q || f.status !== "saved" ? "Nenhum resultado com esses filtros." : "Os vídeos gerados aparecem aqui, salvos no R2."}
          </p>
        </GlassCard>
      ) : (
        <>
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-x-4 gap-y-5">
            <AnimatePresence initial={false}>
              {items.map((j) => (
                <Tile key={j.id} job={j} onOpen={() => setOpenId(j.id)} onFav={() => void fav(j)} />
              ))}
            </AnimatePresence>
          </ul>
          {next && (
            <button type="button" onClick={() => void more()} className="glass-2 mx-auto flex h-10 items-center gap-2 rounded-full px-5 text-sm text-text">
              {loadingMore && <Loader2 className="size-4 animate-spin" />} Carregar mais
            </button>
          )}
        </>
      )}

      <AnimatePresence>
        {open && <Detail key={open.id} job={open} onClose={() => setOpenId(null)} onFav={() => void fav(open)} onOpenJob={(id) => void openJob(id)} />}
      </AnimatePresence>
    </div>
  )
}
