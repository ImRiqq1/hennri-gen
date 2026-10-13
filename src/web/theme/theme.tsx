import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react"
import { flushSync } from "react-dom"

export type Mode = "dark" | "light"
export type Accent = "laranja" | "lima" | "azul" | "mono"

export const ACCENTS: { id: Accent; label: string; swatch: string }[] = [
  { id: "laranja", label: "Laranja", swatch: "#ff5b1f" },
  { id: "lima", label: "Lima", swatch: "#d6f54a" },
  { id: "azul", label: "Azul", swatch: "#2f6bff" },
  { id: "mono", label: "Mono", swatch: "linear-gradient(135deg,#f4f1ec 50%,#0b0b0c 50%)" },
]

const STORAGE_KEY = "hennri-gen:tema"

type ThemeState = { mode: Mode; accent: Accent }
type ThemeCtx = ThemeState & {
  /** origin = ponto da tela de onde o novo tema "se espalha" (clique no botão). */
  toggleMode: (origin?: { x: number; y: number }) => void
  setAccent: (accent: Accent) => void
}

const Ctx = createContext<ThemeCtx | null>(null)

// O index.html já aplica data-theme/data-accent antes do primeiro paint (sem flash);
// aqui só lemos o que está no <html>.
function readInitial(): ThemeState {
  const el = document.documentElement
  return {
    mode: el.dataset.theme === "light" ? "light" : "dark",
    accent: (ACCENTS.some((a) => a.id === el.dataset.accent) ? el.dataset.accent : "laranja") as Accent,
  }
}

function persist(state: ThemeState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // modo privado / storage bloqueado: o tema só não fica lembrado.
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ThemeState>(readInitial)

  useEffect(() => {
    const el = document.documentElement
    el.dataset.theme = state.mode
    el.dataset.accent = state.accent
    el.style.colorScheme = state.mode
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", state.mode === "dark" ? "#060607" : "#e7e8ea")
    persist(state)
  }, [state])

  const toggleMode = useCallback((origin?: { x: number; y: number }) => {
    const next = (s: ThemeState): ThemeState => ({ ...s, mode: s.mode === "dark" ? "light" : "dark" })
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (!document.startViewTransition || reduce) {
      setState(next)
      return
    }
    // Revelação circular a partir do botão (View Transitions API).
    const x = origin?.x ?? window.innerWidth - 40
    const y = origin?.y ?? 40
    const r = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))
    const t = document.startViewTransition(() => flushSync(() => setState(next)))
    void t.ready.then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
        { duration: 620, easing: "cubic-bezier(0.16, 1, 0.3, 1)", pseudoElement: "::view-transition-new(root)" },
      )
    })
  }, [])

  const setAccent = useCallback((accent: Accent) => setState((s) => ({ ...s, accent })), [])

  return <Ctx.Provider value={{ ...state, toggleMode, setAccent }}>{children}</Ctx.Provider>
}

export function useTheme() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error("useTheme fora do ThemeProvider")
  return ctx
}
