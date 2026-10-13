import { motion } from "motion/react"
import { ArrowUpRight, RotateCw } from "lucide-react"
import { Dot, Eyebrow, GlassCard, NotchButton } from "@/components/Glass"
import { getHealth, usd, type Health, type Stats } from "@/lib/api"
import { usePoll, type PollState } from "@/lib/usePoll"
import { cn } from "@/lib/utils"

const ease = [0.16, 1, 0.3, 1] as const

function BigNumber({ value, className }: { value: string | number; className?: string }) {
  return (
    <motion.span
      key={String(value)}
      initial={{ y: 14, opacity: 0, filter: "blur(4px)" }}
      animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
      transition={{ duration: 0.5, ease }}
      className={cn("display-num block text-text", className)}
    >
      {value}
    </motion.span>
  )
}

/** Mostrador de concorrência: um arco por vaga; ocupadas acendem no destaque. */
function ConcurrencyDial({ used, total }: { used: number; total: number }) {
  const r = 30
  const c = 2 * Math.PI * r
  const gap = 6
  const seg = c / total - gap
  return (
    <svg viewBox="0 0 80 80" className="size-[84px] -rotate-90" aria-label={`${used} de ${total} vagas em uso`}>
      {Array.from({ length: total }, (_, i) => (
        <motion.circle
          key={i}
          cx="40"
          cy="40"
          r={r}
          fill="none"
          strokeWidth="7"
          strokeLinecap="round"
          stroke={i < used ? "var(--accent)" : "var(--line-2)"}
          strokeDasharray={`${seg} ${c - seg}`}
          initial={{ strokeDashoffset: -(i * (c / total)) + seg }}
          animate={{ strokeDashoffset: -(i * (c / total)) }}
          transition={{ duration: 0.8, ease, delay: 0.3 + i * 0.06 }}
        />
      ))}
    </svg>
  )
}

export function QueueCard({ stats }: { stats: PollState<Stats> }) {
  const q = stats.kind === "ok" ? stats.data.queue : null
  return (
    <GlassCard
      delay={0.14}
      className="p-5 sm:p-6"
      corner={
        <NotchButton disabled title="Fila completa chega na fase 3" aria-label="Abrir fila">
          <ArrowUpRight className="size-5" strokeWidth={1.8} />
        </NotchButton>
      }
    >
      <Eyebrow>
        <Dot tone={q && q.active > 0 ? "accent" : "idle"} pulse={!!q && q.active > 0} /> Fila
      </Eyebrow>
      <div className="mt-5 flex items-end justify-between gap-4">
        <div>
          <BigNumber value={q ? q.active : "–"} className="text-[96px]" />
          <p className="mt-2 text-sm text-text-2">{q && q.active > 0 ? "gerando agora" : "nada gerando"}</p>
        </div>
        <div className="relative grid place-items-center">
          <ConcurrencyDial used={q?.active ?? 0} total={q?.concurrency ?? 4} />
          <span className="absolute text-xs text-text-2 tabular">
            {q?.active ?? 0}/{q?.concurrency ?? 4}
          </span>
        </div>
      </div>
      <div className="mt-5 flex items-center justify-between rounded-full bg-surface px-4 py-2.5 text-sm">
        <span className="text-text-2">Aguardando vaga</span>
        <span className="font-semibold text-text tabular">{q?.waiting ?? 0}</span>
      </div>
    </GlassCard>
  )
}

export function SpendCard({ stats }: { stats: PollState<Stats> }) {
  const s = stats.kind === "ok" ? stats.data.spend : null
  const pct = s?.dayLimitUsd ? Math.min(100, (s.dayUsd / s.dayLimitUsd) * 100) : 0
  const over = pct >= 100
  return (
    <GlassCard delay={0.2} className="p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <Eyebrow>Gasto hoje</Eyebrow>
        {s?.brlRate ? <span className="text-xs text-text-3 tabular">≈ R$ {(s.dayUsd * s.brlRate).toFixed(2).replace(".", ",")}</span> : null}
      </div>
      <BigNumber value={s ? usd(s.dayUsd) : "–"} className={cn("mt-4 text-[52px] sm:text-[60px]", over && "text-danger")} />
      <div className="mt-5">
        <div className="h-2 overflow-hidden rounded-full bg-surface-2">
          <motion.div
            className={cn("h-full rounded-full", over ? "bg-danger" : "bg-accent")}
            initial={{ width: 0 }}
            animate={{ width: `${Math.max(pct, 1.5)}%` }}
            transition={{ duration: 1, ease, delay: 0.4 }}
          />
        </div>
        <div className="mt-2 flex justify-between text-xs text-text-3 tabular">
          <span>{pct.toFixed(0)}% do limite</span>
          <span>limite {s?.dayLimitUsd != null ? usd(s.dayLimitUsd) : "–"}</span>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-2">
        <div className="rounded-[18px] bg-surface p-3">
          <p className="text-[11px] uppercase tracking-[0.14em] text-text-3">Mês</p>
          <p className="mt-1 text-lg font-semibold text-text tabular">{s ? usd(s.monthUsd) : "–"}</p>
        </div>
        <div className="rounded-[18px] bg-surface p-3">
          <p className="text-[11px] uppercase tracking-[0.14em] text-text-3">Limite mês</p>
          <p className="mt-1 text-lg font-semibold text-text tabular">{s?.monthLimitUsd != null ? usd(s.monthLimitUsd) : "–"}</p>
        </div>
      </div>
    </GlassCard>
  )
}

const CHECK_LABELS: Record<keyof Health["checks"], string> = {
  higgsfield: "Higgsfield API",
  db: "Banco D1",
  files: "Arquivos R2",
}

export function SystemCard() {
  const [state, refresh] = usePoll(getHealth, 60_000)
  const allOk = state.kind === "ok" && state.data.ok
  return (
    <GlassCard delay={0.26} className="p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <Eyebrow>Sistema</Eyebrow>
        <button
          type="button"
          onClick={refresh}
          aria-label="Checar de novo"
          className="grid size-9 place-items-center rounded-full text-text-2 transition-colors hover:bg-surface-2 hover:text-text"
        >
          <RotateCw className={cn("size-4", state.kind === "loading" && "animate-spin")} strokeWidth={1.8} />
        </button>
      </div>
      <p className="display-title mt-3 text-[28px] text-text">
        {state.kind === "loading" ? "Checando…" : allOk ? "Tudo no ar" : "Pendências"}
      </p>
      {state.kind === "error" ? (
        <p className="mt-4 rounded-2xl bg-danger/10 p-3 text-sm text-danger">Worker fora do ar: {state.message}</p>
      ) : (
        <ul className="mt-4 space-y-1">
          {(Object.keys(CHECK_LABELS) as (keyof Health["checks"])[]).map((key) => {
            const check = state.kind === "ok" ? state.data.checks[key] : null
            return (
              <li key={key} className="flex items-center gap-3 rounded-2xl px-1 py-2">
                <Dot tone={!check ? "idle" : check.ok ? "ok" : "bad"} />
                <span className="text-sm text-text">{CHECK_LABELS[key]}</span>
                <span className={cn("ml-auto max-w-[55%] truncate text-right text-xs", check && !check.ok ? "text-danger" : "text-text-3")} title={check?.detail}>
                  {check?.detail ?? "…"}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </GlassCard>
  )
}
