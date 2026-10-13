import { motion } from "motion/react"
import { Check, RotateCw } from "lucide-react"
import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

export type Preset = { id: string; name: string; preview_url: string }

type State = { kind: "loading" } | { kind: "ok"; items: Preset[] } | { kind: "error"; message: string }

let cache: Preset[] | null = null

/** Grade de estilos do Restyle, vinda de GET /api/genjutsu/presets (catálogo atual da Higgsfield). */
export function RestylePresets({ value, onChange }: { value: string | null; onChange: (id: string, name: string) => void }) {
  const [state, setState] = useState<State>(() => (cache ? { kind: "ok", items: cache } : { kind: "loading" }))
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (cache && attempt === 0) return
    let alive = true
    fetch("/api/genjutsu/presets")
      .then(async (r) => {
        const body = (await r.json().catch(() => null)) as { items?: Preset[]; error?: string } | null
        if (!r.ok || !body?.items) throw new Error(body?.error ?? `HTTP ${r.status}`)
        return body.items
      })
      .then((items) => {
        cache = items
        if (alive) setState({ kind: "ok", items })
      })
      .catch((e: Error) => alive && setState({ kind: "error", message: e.message }))
    return () => {
      alive = false
    }
  }, [attempt])

  if (state.kind === "error") {
    return (
      <div className="flex items-center justify-between gap-3 rounded-[16px] border border-danger/40 bg-danger/8 px-4 py-3 text-sm">
        <span className="text-text">Não consegui carregar os estilos: {state.message}</span>
        <button
          type="button"
          onClick={() => {
            setState({ kind: "loading" })
            setAttempt((a) => a + 1)
          }}
          className="flex items-center gap-1.5 text-xs text-text-2 hover:text-text"
        >
          <RotateCw className="size-3.5" /> tentar de novo
        </button>
      </div>
    )
  }

  const items = state.kind === "ok" ? state.items : null
  return (
    <div className="no-scrollbar -mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1" role="radiogroup" aria-label="Estilo do Restyle">
      {items
        ? items.map((p, i) => {
            const on = p.id === value
            return (
              <motion.button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => onChange(p.id, p.name)}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: Math.min(i, 10) * 0.02 }}
                className={cn(
                  "group/p relative w-[104px] shrink-0 snap-start overflow-hidden rounded-[14px] border text-left transition-[border-color,translate] duration-150 hover:-translate-y-0.5",
                  on ? "border-accent" : "border-line hover:border-line-2",
                )}
              >
                <img src={p.preview_url} alt="" loading="lazy" className="aspect-[4/5] w-full object-cover transition-transform duration-300 group-hover/p:scale-105" />
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2 pt-5 pb-1.5 text-[11px] leading-tight text-white">{p.name}</span>
                {on && (
                  <span className="absolute top-1.5 right-1.5 grid size-5 place-items-center rounded-full bg-accent text-accent-ink">
                    <Check className="size-3" strokeWidth={3} />
                  </span>
                )}
              </motion.button>
            )
          })
        : Array.from({ length: 8 }, (_, i) => <span key={i} className="skeleton aspect-[4/5] w-[104px] shrink-0 rounded-[14px]" />)}
    </div>
  )
}
