import { AnimatePresence, motion } from "motion/react"
import { AlertTriangle, Loader2 } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import type { EstimateInput, EstimateResult } from "@shared/pricing"
import { AnimatedNumber } from "@/components/AnimatedNumber"
import type { Stats } from "@/lib/api"
import { cn } from "@/lib/utils"

const usd = (n: number) => "US$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const brl = (n: number) => "R$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Pede a estimativa ao Worker com debounce; mantém o valor anterior enquanto recalcula. */
export function useEstimate(input: EstimateInput) {
  const [result, setResult] = useState<EstimateResult | null>(null)
  const [doneKey, setDoneKey] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const key = JSON.stringify(input)
  const ctrl = useRef<AbortController | null>(null)
  // carregando = ainda não chegou resposta para os parâmetros atuais
  const loading = doneKey !== key

  useEffect(() => {
    const t = window.setTimeout(async () => {
      ctrl.current?.abort()
      const c = new AbortController()
      ctrl.current = c
      try {
        const r = await fetch("/api/estimate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: key,
          signal: c.signal,
        })
        const body = (await r.json()) as EstimateResult
        if (!r.ok) throw new Error()
        setResult(body)
        setFailed(false)
      } catch (e) {
        if ((e as Error).name === "AbortError") return
        setFailed(true)
      } finally {
        if (!c.signal.aborted) setDoneKey(key)
      }
    }, 300)
    return () => window.clearTimeout(t)
  }, [key])

  return { result, loading, failed }
}

export type Guard = { overDay: boolean; needsConfirm: boolean; remainingDay: number | null; confirmAbove: number | null }

export function guardFor(total: number | null, spend: Stats["spend"] | null): Guard {
  const remainingDay = spend?.dayLimitUsd != null ? Math.max(0, spend.dayLimitUsd - spend.dayUsd) : null
  const confirmAbove = spend?.confirmAboveUsd ?? null
  const overDay = total !== null && remainingDay !== null && total > remainingDay
  const needsConfirm = total !== null && confirmAbove !== null && total > confirmAbove
  return { overDay, needsConfirm, remainingDay, confirmAbove }
}

const SOURCE_LABEL: Record<EstimateResult["source"], string> = {
  api: "valor da API",
  "api-taxa": "taxa da API",
  tabela: "estimado",
  indisponivel: "sem valor",
}

export function EstimatePanel({
  input,
  result,
  loading,
  failed,
  guard,
  brlRate,
  summary,
}: {
  input: EstimateInput
  result: EstimateResult | null
  loading: boolean
  failed: boolean
  guard: Guard
  brlRate: number | null
  summary: string
}) {
  const per = result?.perTake ?? null
  const total = result?.total ?? null
  const alert = guard.overDay || guard.needsConfirm
  return (
    <div className="min-w-0 flex-1" aria-live="polite">
      <div className="flex items-center gap-2">
        <span className="label">Estimativa</span>
        {result && (
          <span
            title={result.basis}
            className={cn(
              "rounded-full border px-2 py-0.5 font-mono text-[11px]",
              result.source === "tabela" ? "border-accent/50 text-accent" : "border-line-2 text-text-3",
            )}
          >
            {SOURCE_LABEL[result.source]}
          </span>
        )}
        {loading && <Loader2 className="size-3.5 animate-spin text-text-3" aria-label="recalculando" />}
      </div>

      <div className={cn("mt-1 flex flex-wrap items-baseline gap-x-2.5 transition-opacity duration-200", loading && result && "opacity-50")}>
        {total !== null ? (
          <AnimatedNumber value={total} format={usd} className={cn("display-num text-metric-sm tabular", alert ? "text-danger" : "text-text")} />
        ) : (
          <span className="display-num text-metric-sm text-text-3">{result || !loading ? "—" : ""}</span>
        )}
        {per !== null && input.takes > 1 && (
          <span className="font-mono text-xs text-text-3 tabular">
            {usd(per)} × {input.takes}
          </span>
        )}
      </div>

      <p className="mt-1 truncate text-xs text-text-3" title={result?.basis}>
        {failed && !result
          ? "Não consegui estimar agora — tente de novo em instantes."
          : total !== null
            ? [brlRate ? `≈ ${brl(total * brlRate)}` : null, summary, `${input.takes} ${input.takes === 1 ? "take" : "takes"}`].filter(Boolean).join(" · ")
            : (result?.basis ?? summary)}
      </p>

      <AnimatePresence initial={false}>
        {alert && total !== null && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-1.5 flex items-center gap-1.5 overflow-hidden text-xs text-danger"
          >
            <AlertTriangle className="size-3.5 shrink-0" />
            {guard.overDay
              ? `Passa do limite diário — restam ${usd(guard.remainingDay ?? 0)} hoje.`
              : `Acima de ${usd(guard.confirmAbove ?? 0)} por envio — vai pedir confirmação.`}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}

/** Confirmação antes de gerar algo caro ou acima do limite. */
export function ConfirmCost({
  open,
  total,
  guard,
  onCancel,
  onConfirm,
}: {
  open: boolean
  total: number | null
  guard: Guard
  onCancel: () => void
  onConfirm: () => void
}) {
  useEffect(() => {
    if (!open) return
    const k = (e: KeyboardEvent) => e.key === "Escape" && onCancel()
    window.addEventListener("keydown", k)
    return () => window.removeEventListener("keydown", k)
  }, [open, onCancel])
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[110] grid place-items-center bg-black/45 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.12 } }}
          onPointerDown={(e) => e.target === e.currentTarget && onCancel()}
        >
          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.12 } }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="float w-full max-w-[420px] rounded-[24px] p-6"
          >
            <p className="label">Confirmar gasto</p>
            <h2 id="confirm-title" className="display-title mt-2 text-[26px] text-danger">
              {total !== null ? usd(total) : "—"}
            </h2>
            <p className="mt-3 text-sm text-text-2">
              {guard.overDay
                ? `Isso passa do limite diário: restam ${usd(guard.remainingDay ?? 0)} hoje.`
                : `Está acima do valor de confirmação (${usd(guard.confirmAbove ?? 0)} por envio).`}
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={onCancel} className="glass-2 h-10 rounded-full px-4 text-sm text-text hover:border-line-2">
                Cancelar
              </button>
              <button type="button" autoFocus onClick={onConfirm} className="h-10 rounded-full bg-danger px-4 text-sm font-medium text-white">
                Gerar mesmo assim
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
