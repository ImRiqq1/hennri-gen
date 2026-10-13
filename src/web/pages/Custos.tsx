import { motion } from "motion/react"
import { ExternalLink } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { AnimatedNumber } from "@/components/AnimatedNumber"
import { Eyebrow, GlassCard } from "@/components/Glass"
import { JOBS_CHANGED } from "@/lib/jobs"
import { cn } from "@/lib/utils"

type Row = { label: string; usd: number; n: number; color?: string | null; id?: string }
type CostData = {
  totals: { dayUsd: number; weekUsd: number; monthUsd: number; avgPerJobUsd: number | null; monthJobs: number }
  limits: { dayUsd: number | null; monthUsd: number | null; brlRate: number | null }
  series: { start: number; usd: number; n: number }[]
  byModel: Row[]
  byProject: Row[]
}

const usd = (n: number) => "US$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const dayLabel = (t: number) => new Date(t).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "")
const ease = [0.16, 1, 0.3, 1] as const

function useCosts(days: number) {
  const [data, setData] = useState<CostData | null>(null)
  useEffect(() => {
    let alive = true
    const load = () =>
      fetch(`/api/costs?days=${days}`)
        .then((r) => r.json() as Promise<CostData>)
        .then((d) => alive && setData(d))
        .catch(() => {})
    void load()
    window.addEventListener(JOBS_CHANGED, load)
    return () => {
      alive = false
      window.removeEventListener(JOBS_CHANGED, load)
    }
  }, [days])
  return data
}

function Tile({ label, value, sub, limit }: { label: string; value: number | null; sub?: string; limit?: number | null }) {
  const pct = limit && value !== null ? Math.min(100, (value / limit) * 100) : null
  return (
    <GlassCard className="flex flex-col p-5">
      <span className="label">{label}</span>
      {value === null ? (
        <span className="display-num mt-3 text-metric text-text-3">—</span>
      ) : (
        <AnimatedNumber value={value} format={usd} className={cn("display-num mt-3 text-metric", pct !== null && pct >= 100 ? "text-danger" : "text-text")} />
      )}
      {pct !== null && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-2" role="meter" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={`${label}: ${Math.round(pct)}% do limite`}>
          <motion.div className={cn("h-full rounded-full", pct >= 100 ? "bg-danger" : "bg-accent")} initial={{ width: 0 }} animate={{ width: `${Math.max(pct, 1)}%` }} transition={{ duration: 0.8, ease }} />
        </div>
      )}
      {sub && <span className="mt-2 text-xs text-text-3">{sub}</span>}
    </GlassCard>
  )
}

/** Barras diárias: uma série (cor de destaque), grade recessiva, tooltip por barra. */
function DailyBars({ series }: { series: CostData["series"] }) {
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(...series.map((s) => s.usd), 0)
  // teto "redondo" pro eixo
  const top = max <= 0 ? 1 : (() => {
    const p = 10 ** Math.floor(Math.log10(max))
    return Math.ceil(max / p) * p
  })()
  const ticks = [0, top / 2, top]
  const W = 100 / series.length
  const every = series.length > 40 ? 14 : series.length > 14 ? 5 : 1
  const h = hover !== null ? series[hover] : null

  return (
    <div>
      <div className="relative mt-3 h-[200px]">
        {/* grade + eixo y (texto em cor de texto, nunca da série) */}
        {ticks.map((t) => (
          <div key={t} className="absolute inset-x-0 flex items-center gap-2" style={{ bottom: `${(t / top) * 100}%` }}>
            <span className="w-14 -translate-y-1/2 text-right font-mono text-[11px] text-text-3 tabular">{t === 0 ? "0" : usd(t).replace("US$ ", "$")}</span>
            <span className="h-px flex-1 -translate-y-1/2 bg-line" />
          </div>
        ))}
        <div className="absolute inset-y-0 right-0 left-16 flex items-end" onPointerLeave={() => setHover(null)}>
          {series.map((s, i) => {
            const pct = (s.usd / top) * 100
            return (
              // alvo de hover maior que a barra (coluna inteira)
              <div
                key={s.start}
                className="relative flex h-full items-end justify-center"
                style={{ width: `${W}%` }}
                onPointerEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                tabIndex={0}
                aria-label={`${dayLabel(s.start)}: ${usd(s.usd)}, ${s.n} job(s)`}
              >
                {hover === i && <span className="absolute inset-y-0 w-full rounded-md bg-surface" />}
                <motion.span
                  className={cn("relative block rounded-t-[4px]", s.usd > 0 ? "bg-accent" : "bg-line-2")}
                  style={{ width: "calc(100% - 2px)", maxWidth: 22 }}
                  initial={{ height: 0 }}
                  animate={{ height: s.usd > 0 ? `${Math.max(pct, 1.5)}%` : 2 }}
                  transition={{ duration: 0.6, ease, delay: Math.min(i, 30) * 0.01 }}
                />
              </div>
            )
          })}
          {h && hover !== null && (
            <div
              role="tooltip"
              className="float pointer-events-none absolute top-0 z-10 rounded-[12px] px-3 py-2 text-xs"
              style={{ left: `${(hover + 0.5) * W}%`, transform: `translateX(${hover > series.length * 0.8 ? "-100%" : hover < series.length * 0.2 ? "0" : "-50%"})` }}
            >
              <p className="font-mono text-text-3">{dayLabel(h.start)}</p>
              <p className="mt-0.5 text-sm font-medium text-text tabular">{usd(h.usd)}</p>
              <p className="text-text-3">{h.n} {h.n === 1 ? "job" : "jobs"}</p>
            </div>
          )}
        </div>
      </div>
      <div className="relative mt-2 ml-16 h-4">
        {series.map((s, i) =>
          i % every === 0 || i === series.length - 1 ? (
            <span key={s.start} className="absolute -translate-x-1/2 font-mono text-[11px] whitespace-nowrap text-text-3" style={{ left: `${(i + 0.5) * W}%` }}>
              {dayLabel(s.start)}
            </span>
          ) : null,
        )}
      </div>
    </div>
  )
}

/** Ranking horizontal: magnitude numa cor só; rótulo e valor em cor de texto. */
function Ranking({ rows, empty }: { rows: Row[]; empty: string }) {
  const max = Math.max(...rows.map((r) => r.usd), 0)
  if (!rows.length || max <= 0) return <p className="py-6 text-center text-sm text-text-3">{empty}</p>
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((r, i) => (
        <li key={r.id ?? r.label}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2 text-text">
              {r.color !== undefined && <span className="size-2 shrink-0 rounded-full" style={{ background: r.color ?? "var(--text-3)" }} />}
              <span className="truncate">{r.label}</span>
            </span>
            <span className="shrink-0 tabular text-text">
              {usd(r.usd)} <span className="text-text-3">· {r.n}</span>
            </span>
          </div>
          <div className="h-2 rounded-full bg-surface">
            <motion.div className="h-full rounded-full bg-accent" initial={{ width: 0 }} animate={{ width: `${(r.usd / max) * 100}%` }} transition={{ duration: 0.7, ease, delay: i * 0.04 }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

export function Custos() {
  const [days, setDays] = useState(30)
  const data = useCosts(days)
  const [asTable, setAsTable] = useState(false)
  const periodTotal = useMemo(() => data?.series.reduce((a, s) => a + s.usd, 0) ?? 0, [data])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Eyebrow>Estúdio</Eyebrow>
          <h1 className="display-title mt-3 text-page text-text">
            Custos<span className="text-accent">.</span>
          </h1>
        </div>
        <a href="https://console.higgsfield.ai" target="_blank" rel="noreferrer" className="glass-2 flex h-10 items-center gap-2 rounded-full px-4 text-sm text-text-2 hover:text-text">
          <ExternalLink className="size-4" /> Saldo e cobrança na Higgsfield
        </a>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label="Hoje" value={data?.totals.dayUsd ?? null} limit={data?.limits.dayUsd} sub={data?.limits.dayUsd != null ? `limite ${usd(data.limits.dayUsd)}` : undefined} />
        <Tile label="Semana" value={data?.totals.weekUsd ?? null} sub="desde segunda" />
        <Tile label="Mês" value={data?.totals.monthUsd ?? null} limit={data?.limits.monthUsd} sub={data?.limits.monthUsd != null ? `limite ${usd(data.limits.monthUsd)}` : undefined} />
        <Tile
          label="Custo médio por job"
          value={data ? data.totals.avgPerJobUsd : null}
          sub={data ? `${data.totals.monthJobs} ${data.totals.monthJobs === 1 ? "job aceito" : "jobs aceitos"} no mês` : undefined}
        />
      </div>

      <GlassCard className="p-5">
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <div>
            <p className="label">Gasto por dia</p>
            <p className="mt-1 text-sm text-text-2">
              {data ? `${usd(periodTotal)} nos últimos ${days} dias` : "…"}
              {data?.limits.brlRate && periodTotal > 0 ? ` · ≈ R$ ${(periodTotal * data.limits.brlRate).toFixed(2).replace(".", ",")}` : ""}
            </p>
          </div>
          <div className="ml-auto flex gap-1 rounded-full bg-surface p-1" role="radiogroup" aria-label="Período">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                type="button"
                role="radio"
                aria-checked={d === days}
                onClick={() => setDays(d)}
                className={cn("rounded-full px-3 py-1.5 text-sm transition-colors", d === days ? "bg-invert text-invert-ink" : "text-text-2 hover:text-text")}
              >
                {d} dias
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setAsTable((v) => !v)} aria-pressed={asTable} className="text-xs text-text-3 underline-offset-2 hover:text-text hover:underline">
            {asTable ? "ver gráfico" : "ver como tabela"}
          </button>
        </div>
        {!data ? (
          <span className="skeleton block h-[220px] rounded-[16px]" />
        ) : asTable ? (
          <div className="max-h-[260px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-panel">
                <tr className="text-left">
                  <th className="label py-2 font-normal">Dia</th>
                  <th className="label py-2 text-right font-normal">Jobs</th>
                  <th className="label py-2 text-right font-normal">Gasto</th>
                </tr>
              </thead>
              <tbody>
                {[...data.series].reverse().map((s) => (
                  <tr key={s.start} className="border-t border-line">
                    <td className="py-1.5 text-text-2">{dayLabel(s.start)}</td>
                    <td className="py-1.5 text-right text-text-2 tabular">{s.n}</td>
                    <td className="py-1.5 text-right text-text tabular">{usd(s.usd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <DailyBars series={data.series} />
        )}
      </GlassCard>

      <div className="grid gap-3 lg:grid-cols-2">
        <GlassCard className="p-5">
          <p className="label mb-4">Por modelo · {days} dias</p>
          {data ? <Ranking rows={data.byModel} empty="Nenhum gasto no período." /> : <span className="skeleton block h-32 rounded-xl" />}
        </GlassCard>
        <GlassCard className="p-5">
          <p className="label mb-4">Por projeto · {days} dias</p>
          {data ? <Ranking rows={data.byProject.map((r) => ({ ...r, color: r.color ?? null }))} empty="Nenhum gasto no período." /> : <span className="skeleton block h-32 rounded-xl" />}
        </GlassCard>
      </div>
      <p className="text-xs text-text-3">
        Valores são as estimativas guardadas em cada job aceito (completo/salvo). Falhas, bloqueios e cancelamentos não são cobrados e ficam de fora. O
        valor exato cobrado está no console da Higgsfield.
      </p>
    </div>
  )
}
