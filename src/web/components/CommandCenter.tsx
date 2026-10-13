import { AnimatePresence, motion } from "motion/react"
import {
  ArrowRight,
  Clapperboard,
  CornerDownLeft,
  Home,
  Keyboard,
  Moon,
  Palette as PaletteIcon,
  Search,
  Sparkles,
  Sun,
  type LucideIcon,
} from "lucide-react"
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { useNavigate } from "react-router-dom"
import { MODES } from "@/lib/modes"
import { EVENTS, isTyping, SHORTCUTS } from "@/lib/shortcuts"
import { useFocusTrap } from "@/lib/useFocusTrap"
import { cn } from "@/lib/utils"
import { ACCENTS, useTheme } from "@/theme/theme"

type Ctx = { openPalette: () => void; openHelp: () => void }
const CommandCtx = createContext<Ctx | null>(null)

export function useCommandCenter() {
  const ctx = useContext(CommandCtx)
  if (!ctx) throw new Error("useCommandCenter fora do CommandCenter")
  return ctx
}

type Command = { id: string; label: string; hint?: string; group: string; icon: LucideIcon; keys?: string[]; run: () => void }

const ease = [0.16, 1, 0.3, 1] as const

/** Escuta os atalhos globais e renderiza a paleta (⌘K) e a ajuda (?). */
export function CommandCenter({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const { mode, toggleMode, accent, setAccent } = useTheme()
  const [palette, setPalette] = useState(false)
  const [help, setHelp] = useState(false)
  const pendingG = useRef<number | null>(null)

  const cycleAccent = useCallback(() => {
    const i = ACCENTS.findIndex((a) => a.id === accent)
    setAccent(ACCENTS[(i + 1) % ACCENTS.length].id)
  }, [accent, setAccent])

  const newJob = useCallback(
    (modo?: string) => {
      navigate(modo ? `/criar?modo=${modo}` : "/criar")
      // espera a página montar antes de focar
      window.setTimeout(() => window.dispatchEvent(new Event(EVENTS.focusPrompt)), 60)
    },
    [navigate],
  )

  useEffect(() => {
    document.documentElement.toggleAttribute("data-overlay", palette || help)
  }, [palette, help])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setHelp(false)
        setPalette((v) => !v)
        return
      }
      if (e.key === "Escape") {
        if (palette || help) {
          setPalette(false)
          setHelp(false)
        } else if (isTyping(e)) {
          ;(e.target as HTMLElement).blur()
        }
        return
      }
      if (palette || help || mod || e.altKey || isTyping(e)) return

      const k = e.key.toLowerCase()
      if (pendingG.current !== null) {
        window.clearTimeout(pendingG.current)
        pendingG.current = null
        if (k === "h") navigate("/")
        else if (k === "c") navigate("/criar")
        return
      }
      if (k === "g") {
        pendingG.current = window.setTimeout(() => (pendingG.current = null), 900)
        return
      }
      if (e.key === "?") {
        e.preventDefault()
        setHelp(true)
      } else if (k === "t") {
        const r = document.querySelector("[data-theme-toggle]")?.getBoundingClientRect()
        toggleMode(r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : undefined)
      } else if (k === "a") {
        cycleAccent()
      } else if (k === "n") {
        e.preventDefault()
        newJob()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [palette, help, navigate, toggleMode, cycleAccent, newJob])

  const commands = useMemo<Command[]>(
    () => [
      { id: "nav-home", group: "Ir para", label: "Início", icon: Home, keys: ["G", "H"], run: () => navigate("/") },
      { id: "nav-criar", group: "Ir para", label: "Criar", icon: Sparkles, keys: ["G", "C"], run: () => navigate("/criar") },
      ...MODES.map((m, i) => ({
        id: `mode-${m.id}`,
        group: "Novo job",
        label: m.label,
        hint: m.models.map((x) => x.name).join(" · "),
        icon: Clapperboard,
        keys: [String(i + 1)],
        run: () => newJob(m.id),
      })),
      {
        id: "theme",
        group: "Aparência",
        label: mode === "dark" ? "Mudar para o modo claro" : "Mudar para o modo escuro",
        icon: mode === "dark" ? Sun : Moon,
        keys: ["T"],
        run: () => toggleMode(),
      },
      ...ACCENTS.map((a) => ({
        id: `accent-${a.id}`,
        group: "Aparência",
        label: `Destaque ${a.label}`,
        hint: a.id === accent ? "atual" : undefined,
        icon: PaletteIcon,
        run: () => setAccent(a.id),
      })),
      { id: "help", group: "Ajuda", label: "Ver todos os atalhos", icon: Keyboard, keys: ["?"], run: () => setHelp(true) },
    ],
    [navigate, newJob, mode, toggleMode, accent, setAccent],
  )

  const ctx = useMemo(() => ({ openPalette: () => setPalette(true), openHelp: () => setHelp(true) }), [])

  return (
    <CommandCtx.Provider value={ctx}>
      {children}
      <AnimatePresence>{palette && <Palette commands={commands} onClose={() => setPalette(false)} />}</AnimatePresence>
      <AnimatePresence>{help && <Help onClose={() => setHelp(false)} />}</AnimatePresence>
    </CommandCtx.Provider>
  )
}

function Overlay({ children, onClose, label }: { children: ReactNode; onClose: () => void; label: string }) {
  // montado só enquanto aberto: o foco fica preso aqui e volta pro botão de origem ao fechar
  const trap = useFocusTrap<HTMLDivElement>(true)
  return (
    <motion.div
      role="dialog"
      aria-modal
      aria-label={label}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.12 } }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/35 px-3 pt-[12vh] backdrop-blur-[2px]"
      onPointerDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        ref={trap}
        initial={{ opacity: 0, y: -12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -6, scale: 0.99, transition: { duration: 0.12 } }}
        transition={{ duration: 0.28, ease }}
        className="float w-full max-w-[640px] overflow-hidden rounded-[26px]"
      >
        {children}
      </motion.div>
    </motion.div>
  )
}

function normalize(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
}

function Palette({ commands, onClose }: { commands: Command[]; onClose: () => void }) {
  const [q, setQ] = useState("")
  const [active, setActive] = useState(0)
  const listRef = useRef<HTMLUListElement>(null)

  const results = useMemo(() => {
    const words = normalize(q).split(/\s+/).filter(Boolean)
    if (!words.length) return commands
    return commands.filter((c) => {
      const hay = normalize(`${c.group} ${c.label} ${c.hint ?? ""}`)
      return words.every((w) => hay.includes(w))
    })
  }, [q, commands])

  const current = Math.min(active, Math.max(0, results.length - 1))

  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${current}"]`)?.scrollIntoView({ block: "nearest" })
  }, [current])

  function run(c: Command | undefined) {
    if (!c) return
    onClose()
    c.run()
  }

  return (
    <Overlay onClose={onClose} label="Paleta de comandos">
      <div className="flex items-center gap-3 border-b border-line px-5">
        <Search className="size-[18px] text-text-3" strokeWidth={1.8} />
        <input
          autoFocus
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setActive(0)
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault()
              setActive((i) => Math.min(i + 1, results.length - 1))
            } else if (e.key === "ArrowUp") {
              e.preventDefault()
              setActive((i) => Math.max(i - 1, 0))
            } else if (e.key === "Enter") {
              e.preventDefault()
              run(results[current])
            }
          }}
          placeholder="O que você quer fazer?"
          className="h-16 flex-1 bg-transparent text-[17px] text-text outline-none placeholder:text-text-3"
        />
        <span className="kbd">Esc</span>
      </div>
      <ul ref={listRef} className="max-h-[52vh] overflow-y-auto p-2">
        {results.length === 0 && <li className="px-4 py-10 text-center text-sm text-text-3">Nada encontrado para “{q}”.</li>}
        {results.map((c, i) => {
          const header = i === 0 || results[i - 1].group !== c.group ? c.group : null
          const Icon = c.icon
          return (
            <li key={c.id}>
              {header && <p className="label px-3 pt-3 pb-1.5">{header}</p>}
              <button
                type="button"
                data-idx={i}
                onMouseMove={() => setActive(i)}
                onClick={() => run(c)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors",
                  i === current ? "bg-surface-2 text-text" : "text-text-2",
                )}
              >
                <span className={cn("grid size-8 place-items-center rounded-xl", i === current ? "bg-invert text-invert-ink" : "bg-surface")}>
                  <Icon className="size-4" strokeWidth={1.8} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-text">{c.label}</span>
                  {c.hint && <span className="block truncate text-xs text-text-3">{c.hint}</span>}
                </span>
                {c.keys && (
                  <span className="flex gap-1">
                    {c.keys.map((k) => (
                      <span key={k} className="kbd">
                        {k}
                      </span>
                    ))}
                  </span>
                )}
                {i === current && <CornerDownLeft className="size-4 text-text-3" />}
              </button>
            </li>
          )
        })}
      </ul>
      <div className="flex items-center gap-4 border-t border-line px-5 py-3 text-xs text-text-3">
        <span className="flex items-center gap-1.5"><span className="kbd">↑</span><span className="kbd">↓</span> navegar</span>
        <span className="flex items-center gap-1.5"><span className="kbd">↵</span> executar</span>
        <span className="ml-auto flex items-center gap-1.5"><ArrowRight className="size-3.5" /> {results.length} comandos</span>
      </div>
    </Overlay>
  )
}

function Help({ onClose }: { onClose: () => void }) {
  return (
    <Overlay onClose={onClose} label="Atalhos de teclado">
      <div className="flex items-center justify-between border-b border-line px-6 py-5">
        <div>
          <p className="label">Atalhos</p>
          <p className="display-title mt-1.5 text-2xl text-text">Teclado</p>
        </div>
        <span className="kbd">Esc</span>
      </div>
      <div className="grid gap-6 p-6 sm:grid-cols-2">
        {SHORTCUTS.map((g) => (
          <section key={g.title} className={g.title === "Criar" ? "sm:col-span-2" : ""}>
            <p className="label mb-2">{g.title}</p>
            <ul className={cn("divide-y divide-line", g.title === "Criar" && "sm:grid sm:grid-cols-2 sm:gap-x-6 sm:divide-y-0")}>
              {g.items.map((it) => (
                <li key={it.label} className="flex items-center justify-between gap-4 py-2.5 sm:border-b sm:border-line">
                  <span className="text-sm text-text-2">{it.label}</span>
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
          </section>
        ))}
      </div>
    </Overlay>
  )
}
