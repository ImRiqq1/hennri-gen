import { AnimatePresence, motion } from "motion/react"
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react"
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react"
import { cn } from "@/lib/utils"

type Tone = "info" | "success" | "error"
type Toast = { id: number; title: string; detail?: string; tone: Tone }
type Ctx = { toast: (t: { title: string; detail?: string; tone?: Tone; ms?: number }) => void }

const ToastCtx = createContext<Ctx | null>(null)

export function useToast() {
  const ctx = useContext(ToastCtx)
  if (!ctx) throw new Error("useToast fora do Toaster")
  return ctx.toast
}

const ICONS = { info: Info, success: CheckCircle2, error: AlertTriangle }

/** Avisos curtos no canto (vidro flutuante). Vários empilham; cada um some sozinho. */
export function Toaster({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([])
  const seq = useRef(0)

  const dismiss = useCallback((id: number) => setItems((all) => all.filter((t) => t.id !== id)), [])

  const toast = useCallback<Ctx["toast"]>(
    ({ title, detail, tone = "info", ms = 3200 }) => {
      const id = ++seq.current
      setItems((all) => [...all.slice(-3), { id, title, detail, tone }])
      window.setTimeout(() => dismiss(id), ms)
    },
    [dismiss],
  )

  const value = useMemo(() => ({ toast }), [toast])

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed right-4 bottom-24 z-[120] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2 lg:bottom-4">
        <AnimatePresence initial={false}>
          {items.map((t) => {
            const Icon = ICONS[t.tone]
            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: 14, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 24, transition: { duration: 0.16 } }}
                transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
                className="float pointer-events-auto flex items-start gap-3 rounded-[18px] p-3.5"
              >
                <Icon className={cn("mt-0.5 size-[18px] shrink-0", t.tone === "error" ? "text-danger" : t.tone === "success" ? "text-accent" : "text-text-2")} strokeWidth={1.8} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text">{t.title}</p>
                  {t.detail && <p className="mt-0.5 text-[13px] text-text-2">{t.detail}</p>}
                </div>
                <button type="button" aria-label="Fechar aviso" onClick={() => dismiss(t.id)} className="grid size-6 place-items-center rounded-full text-text-3 hover:bg-surface hover:text-text">
                  <X className="size-3.5" />
                </button>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  )
}
