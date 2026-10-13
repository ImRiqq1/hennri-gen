import { motion } from "motion/react"
import { ArrowUpRight, Clapperboard, Film, Gauge, ImageIcon, Layers3, Wand2, type LucideIcon } from "lucide-react"
import { useEffect, useState, type ReactNode } from "react"
import { Link, useNavigate } from "react-router-dom"
import { AnimatedNumber } from "@/components/AnimatedNumber"
import { useCommandCenter } from "@/components/CommandCenter"
import { ModePreview } from "@/components/ModePreview"
import { Eyebrow, GlassCard, NotchButton } from "@/components/Glass"
import { Roadmap } from "@/components/studio/Roadmap"
import { SystemCard } from "@/components/studio/SideCards"
import { getStats, usd, type Stats } from "@/lib/api"
import { MODES } from "@/lib/modes"
import { MOD, SHORTCUTS } from "@/lib/shortcuts"
import { usePoll, type PollState } from "@/lib/usePoll"
import { cn } from "@/lib/utils"

const ease = [0.16, 1, 0.3, 1] as const

function greeting(d = new Date()) {
  const h = d.getHours()
  return h < 5 ? "Boa madrugada" : h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite"
}

function Rise({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease, delay }} className={className}>
      {children}
    </motion.div>
  )
}

function Stat({ value, label, delay, money }: { value: number | null; label: string; delay: number; money?: boolean }) {
  return (
    <Rise delay={delay} className="min-w-0">
      {value === null ? (
        <span className="skeleton block h-9 w-14 rounded-xl sm:h-[38px]" />
      ) : (
        <AnimatedNumber
          value={value}
          format={money ? (n) => "$" + n.toFixed(2).replace(".", ",") : undefined}
          className="display-num block text-metric-sm text-text sm:text-metric"
        />
      )}
      <p className="mt-1.5 text-[13px] text-text-3">{label}</p>
    </Rise>
  )
}

function Header({ stats }: { stats: PollState<Stats> }) {
  const s = stats.kind === "ok" ? stats.data : null
  const active = s?.queue.active ?? 0
  const sub = !s
    ? "Carregando o estúdio…"
    : active > 0
      ? `${active} ${active === 1 ? "job gerando" : "jobs gerando"} agora.`
      : "Nada gerando agora. O limite de hoje está livre."
  return (
    <div className="flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
      <div className="min-w-0">
        <Rise>
          <Eyebrow>Visão geral</Eyebrow>
        </Rise>
        <div className="mt-3 overflow-hidden pb-1">
          <motion.h1
            initial={{ y: "105%" }}
            animate={{ y: 0 }}
            transition={{ duration: 0.85, ease }}
            className="display-title text-page text-text"
          >
            {greeting()}, Henrique<span className="text-accent">.</span>
          </motion.h1>
        </div>
        <Rise delay={0.12}>
          <p className="mt-2 text-[15px] text-text-2">{sub}</p>
        </Rise>
      </div>
      <div className="grid grid-cols-3 gap-6 sm:gap-10">
        <Stat value={s ? s.today.jobs.length : null} label="jobs hoje" delay={0.15} />
        <Stat value={s ? s.queue.active + s.queue.waiting : null} label="na fila" delay={0.2} />
        <Stat value={s ? s.spend.dayUsd : null} money label="gasto hoje" delay={0.25} />
      </div>
    </div>
  )
}

/** Card de destaque (cheio na cor de destaque): começar um texto→vídeo. */
function HeroAction() {
  const navigate = useNavigate()
  const t2v = MODES[0]
  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease, delay: 0.1 }}
      whileHover={{ y: -3 }}
      className="card-hover relative h-full min-h-[220px]"
    >
      <button
        type="button"
        onClick={() => navigate("/criar")}
        className="notch group flex h-full w-full flex-col overflow-hidden rounded-[24px] bg-accent p-5 text-left text-accent-ink shadow-[0_30px_60px_-30px_rgb(var(--accent-glow)/0.7)]"
      >
        <span className="font-mono text-[11px] tracking-[0.06em] uppercase opacity-70">Novo job</span>
        {/* enquadramentos 9:16 / 16:9 / 1:1 desenhados em linha fina */}
        <span aria-hidden className="mt-4 flex items-end gap-2.5 opacity-80">
          {[
            [27, 48],
            [72, 40],
            [40, 40],
          ].map(([w, h], i) => (
            <motion.span
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease, delay: 0.35 + i * 0.08 }}
              className="relative rounded-[10px] border-[1.5px] border-current/40"
              style={{ width: w, height: h }}
            >
              <span className="absolute inset-[30%] grid place-items-center">
                <span className="size-0 border-y-[5px] border-l-[8px] border-y-transparent border-l-current/60" />
              </span>
            </motion.span>
          ))}
        </span>
        <span className="display-title mt-auto block pt-5 text-[clamp(28px,1.4vw+14px,38px)]">{t2v.label}</span>
        <span className="mt-2 block text-[13px] opacity-80">Seedance 2.5 · 720p · 5 s · sem áudio</span>
        <span className="mt-4 flex items-center gap-2 text-sm">
          <span className="grid h-7 min-w-7 place-items-center rounded-lg bg-black/15 px-2 font-mono text-xs">N</span>
          <span className="opacity-75">ou</span>
          <span className="grid h-7 place-items-center rounded-lg bg-black/15 px-2 font-mono text-xs">{MOD} K</span>
        </span>
        <span className="pointer-events-none absolute inset-0 rounded-[28px] bg-[linear-gradient(120deg,transparent_35%,rgb(255_255_255/0.18)_50%,transparent_65%)] bg-[length:250%_100%] bg-[position:120%_0] transition-[background-position] duration-1000 ease-out group-hover:bg-[position:-20%_0]" />
      </button>
      <NotchButton tabIndex={-1} aria-hidden className="pointer-events-none" onClick={() => navigate("/criar")}>
        <ArrowUpRight className="size-[18px]" strokeWidth={1.8} />
      </NotchButton>
    </motion.section>
  )
}

const QUICK: { modeId: string; icon: LucideIcon; desc: string }[] = [
  { modeId: "i2v", icon: ImageIcon, desc: "Primeiro e último frame" },
  { modeId: "ref", icon: Layers3, desc: "Até 30 imagens, 10 vídeos, 10 áudios" },
  { modeId: "genjutsu", icon: Wand2, desc: "Troca personagem, objeto ou estilo" },
  { modeId: "cinema", icon: Film, desc: "Câmera, ritmo, lente e paleta" },
]

function QuickAction({ modeId, icon: Icon, desc, delay }: { modeId: string; icon: LucideIcon; desc: string; delay: number }) {
  const idx = MODES.findIndex((m) => m.id === modeId)
  const mode = MODES[idx]
  const [hover, setHover] = useState(false)
  return (
    <GlassCard
      delay={delay}
      interactive
      onHoverStart={() => setHover(true)}
      onHoverEnd={() => setHover(false)}
      className="group flex h-full flex-col p-4"
      corner={
        <NotchButton tabIndex={-1} aria-hidden className="pointer-events-none">
          <ArrowUpRight className="size-[18px]" strokeWidth={1.8} />
        </NotchButton>
      }
    >
      {/* link esticado: o card inteiro é um alvo focável só */}
      <Link
        to={`/criar?modo=${modeId}`}
        onFocus={() => setHover(true)}
        onBlur={() => setHover(false)}
        className="absolute inset-0 z-10 rounded-[24px]"
        aria-label={`Novo job: ${mode.label}`}
      />
      <div className="flex items-start justify-between gap-3 pr-10">
        <span className="grid size-9 place-items-center rounded-full bg-surface-2 text-text transition-colors duration-200 group-hover:bg-invert group-hover:text-invert-ink">
          <Icon className="size-[17px]" strokeWidth={1.7} />
        </span>
        <ModePreview modeId={modeId} active={hover} />
      </div>
      <p className="mt-3 text-card font-medium tracking-[-0.02em] text-text">{mode.label}</p>
      <p className="mt-0.5 text-[13px] text-text-3">{desc}</p>
      <div className="mt-auto flex items-center justify-between pt-3">
        <span className="truncate font-mono text-[11px] text-text-3">{mode.models.map((m) => m.name).join(" · ")}</span>
        <span className="kbd">{idx + 1}</span>
      </div>
    </GlassCard>
  )
}

/** Estilo "Insight": número grande e leve + frase + barra segmentada. */
function LimitInsight({ stats }: { stats: PollState<Stats> }) {
  const s = stats.kind === "ok" ? stats.data.spend : null
  const pct = s?.dayLimitUsd ? Math.min(100, (s.dayUsd / s.dayLimitUsd) * 100) : 0
  const segments = 12
  const lit = Math.round((pct / 100) * segments)
  return (
    <GlassCard delay={0.3} className="flex h-full flex-col p-5">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2.5 text-sm text-text">
          <span className="grid size-8 place-items-center rounded-xl bg-invert text-invert-ink">
            <Gauge className="size-4" strokeWidth={2} />
          </span>
          Limite do dia
        </span>
        <span className="rounded-full border border-line-2 px-3 py-1 text-xs text-text-2">Hoje</span>
      </div>
      <div className="mt-5 flex items-start gap-1.5">
        <AnimatedNumber value={pct} format={(n) => `${Math.round(n)}%`} className={cn("display-num text-metric-xl", pct >= 100 ? "text-danger" : "text-text")} />
        <ArrowUpRight className="mt-1 size-4 text-accent" strokeWidth={2} />
      </div>
      <p className="mt-3 text-[16px] leading-snug tracking-[-0.015em] text-text">
        do limite diário usado <span className="text-text-3">até agora.</span>
      </p>
      <p className="mt-2 text-sm text-text-3">
        {s ? `${usd(s.dayUsd)} de ${s.dayLimitUsd != null ? usd(s.dayLimitUsd) : "—"} · mês ${usd(s.monthUsd)}` : "…"}
      </p>
      <div className="mt-auto flex gap-1 pt-5">
        {Array.from({ length: segments }, (_, i) => (
          <motion.span
            key={i}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.5, ease, delay: 0.5 + i * 0.03 }}
            className={cn("h-1.5 flex-1 origin-left rounded-full", i < lit ? (pct >= 100 ? "bg-danger" : "bg-accent") : "bg-line-2")}
          />
        ))}
      </div>
    </GlassCard>
  )
}

/** Linha do tempo do dia (estilo "Your Schedule"): horas, jobs e o marcador de agora. */
function TodayTimeline({ stats }: { stats: PollState<Stats> }) {
  const [now, setNow] = useState(() => Date.now())
  const [fallbackDayStart] = useState(() => new Date().setHours(0, 0, 0, 0))
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(id)
  }, [])
  const data = stats.kind === "ok" ? stats.data.today : null
  const dayStart = data?.dayStart ?? fallbackDayStart
  const DAY = 24 * 60 * 60 * 1000
  const pos = (t: number) => `${Math.min(100, Math.max(0, ((t - dayStart) / DAY) * 100))}%`
  const nowLabel = new Date(now).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  const jobs = data?.jobs ?? []
  const lanes = 3

  return (
    <GlassCard delay={0.36} className="flex h-full flex-col p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Eyebrow>Hoje</Eyebrow>
          <p className="display-title mt-1.5 text-card text-text">Linha do tempo</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-text-3">
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-accent" /> gerando</span>
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-text" /> pronto</span>
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-danger" /> falhou</span>
        </div>
      </div>

      <div className="relative mt-8 flex-1">
        {/* trilhas */}
        <div className="relative h-[156px]">
          {Array.from({ length: lanes }, (_, i) => (
            <div key={i} className="absolute inset-x-0 h-px bg-line" style={{ top: 26 + i * 48 }} />
          ))}
          {[0, 3, 6, 9, 12, 15, 18, 21].map((h) => (
            <div key={h} className="absolute top-0 bottom-0 w-px bg-line/60" style={{ left: `${(h / 24) * 100}%` }} />
          ))}

          {jobs.map((j, i) => {
            const end = j.completed_at ?? now
            const tone = ["failed", "nsfw", "canceled"].includes(j.status)
              ? "bg-danger text-white"
              : ["saved", "completed", "saving"].includes(j.status)
                ? "bg-invert text-invert-ink"
                : "bg-accent text-accent-ink"
            return (
              <motion.span
                key={j.id}
                initial={{ opacity: 0, scaleX: 0 }}
                animate={{ opacity: 1, scaleX: 1 }}
                transition={{ duration: 0.6, ease, delay: 0.4 + i * 0.03 }}
                title={`${j.model_id} · ${j.status}`}
                className={cn("absolute h-7 min-w-7 origin-left truncate rounded-full px-2.5 text-[11px] leading-7", tone)}
                style={{ left: pos(j.created_at), width: `calc(${pos(end)} - ${pos(j.created_at)})`, top: 12 + (i % lanes) * 48 }}
              >
                {j.mode}
              </motion.span>
            )
          })}

          {jobs.length === 0 && (
            <div className="absolute inset-0 z-10 grid place-items-center">
              <p className="rounded-full border border-dashed border-line-2 bg-panel px-4 py-2 text-sm text-text-3">
                Nenhum job hoje · aperte <span className="kbd mx-1">N</span> para começar
              </p>
            </div>
          )}

          {/* agora */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="absolute -top-3 bottom-0 flex -translate-x-1/2 flex-col items-center"
            style={{ left: pos(now) }}
          >
            <span className="rounded-full bg-invert px-2 py-0.5 font-mono text-[11px] text-invert-ink tabular">{nowLabel}</span>
            <span className="w-px flex-1 bg-invert" />
            <span className="size-2 -translate-y-0.5 rounded-full bg-invert" />
          </motion.div>
        </div>
        <div className="relative mt-3 h-4 font-mono text-[11px] text-text-3">
          {[0, 3, 6, 9, 12, 15, 18, 21].map((h) => (
            <span key={h} className="absolute -translate-x-1/2 first:translate-x-0" style={{ left: `${(h / 24) * 100}%` }}>
              {String(h).padStart(2, "0")}h
            </span>
          ))}
        </div>
      </div>
    </GlassCard>
  )
}

function ShortcutsCard() {
  const { openHelp, openPalette } = useCommandCenter()
  const items = [...SHORTCUTS[1].items, SHORTCUTS[0].items[0], SHORTCUTS[0].items[2], SHORTCUTS[2].items[0]]
  return (
    <GlassCard delay={0.42} className="flex h-full flex-col p-5">
      <div className="flex items-center justify-between">
        <Eyebrow>Atalhos</Eyebrow>
        <button type="button" onClick={openHelp} className="flex items-center gap-2 text-xs text-text-2 hover:text-text">
          ver todos <span className="kbd">?</span>
        </button>
      </div>
      <ul className="mt-4 grid gap-x-8 sm:grid-cols-2">
        {items.map((it) => (
          <li key={it.label} className="flex items-center justify-between gap-3 border-b border-line py-2.5">
            <span className="truncate text-sm text-text-2">{it.label}</span>
            <span className="flex shrink-0 gap-1">
              {it.keys.map((k, i) => (
                <span key={i} className={k === "…" ? "px-0.5 text-text-3" : "kbd"}>
                  {k}
                </span>
              ))}
            </span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={openPalette}
        className="mt-auto flex items-center justify-between rounded-full bg-surface px-4 py-3 text-sm text-text-2 transition-colors hover:bg-surface-2 hover:text-text"
        style={{ marginTop: "1.5rem" }}
      >
        <span className="flex items-center gap-2">
          <Clapperboard className="size-4" strokeWidth={1.8} /> Abrir paleta de comandos
        </span>
        <span className="flex gap-1">
          <span className="kbd">{MOD}</span>
          <span className="kbd">K</span>
        </span>
      </button>
    </GlassCard>
  )
}

export function Inicio() {
  const [stats] = usePoll(getStats, 15_000)
  return (
    <div className="flex flex-col gap-4">
      <Header stats={stats} />

      <div className="mt-4 grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <HeroAction />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:col-span-7">
          {QUICK.map((q, i) => (
            <QuickAction key={q.modeId} {...q} delay={0.14 + i * 0.05} />
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <LimitInsight stats={stats} />
        </div>
        <div className="min-w-0 lg:col-span-7">
          <TodayTimeline stats={stats} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <ShortcutsCard />
        </div>
        <div className="lg:col-span-5">
          <SystemCard />
        </div>
      </div>

      <Roadmap />
    </div>
  )
}
