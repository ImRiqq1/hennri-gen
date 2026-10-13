import { motion } from "motion/react"
import { Command, Images, Layers, Settings2, Sparkles, Wallet, type LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import { NavLink, useLocation } from "react-router-dom"
import { Ambient } from "@/components/Ambient"
import { AccentPicker, ThemeToggle } from "@/components/ThemeControls"
import { cn } from "@/lib/utils"

type NavItem = { to: string; label: string; icon: LucideIcon; fase: number | null }

const NAV: NavItem[] = [
  { to: "/", label: "Criar", icon: Sparkles, fase: null },
  { to: "/galeria", label: "Galeria", icon: Images, fase: 3 },
  { to: "/presets", label: "Presets", icon: Layers, fase: 4 },
  { to: "/custos", label: "Custos", icon: Wallet, fase: 4 },
  { to: "/config", label: "Config", icon: Settings2, fase: 4 },
]

const spring = { type: "spring", stiffness: 420, damping: 34 } as const

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-condensed uppercase leading-none tracking-wide text-text", className)}>
      Hennri<span className="px-[0.12em] text-accent">/</span>Gen
    </span>
  )
}

/** Isotipo: a barra do /GEN dentro de um círculo. */
function Isotype({ className }: { className?: string }) {
  return (
    <span className={cn("grid size-11 place-items-center rounded-full bg-invert text-invert-ink", className)}>
      <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
        <path d="M8.5 19.5 15.5 4.5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
        <circle cx="17.2" cy="17.2" r="2.2" fill="var(--accent)" />
      </svg>
    </span>
  )
}

function NavButton({ item, active, layoutId, compact }: { item: NavItem; active: boolean; layoutId: string; compact?: boolean }) {
  const Icon = item.icon
  const inner = (
    <>
      {active && (
        <motion.span layoutId={layoutId} transition={spring} className="absolute inset-0 rounded-full bg-invert shadow-[var(--shadow-sm)]" />
      )}
      <Icon className={cn("relative size-[19px]", active ? "text-invert-ink" : "")} strokeWidth={1.8} />
      {!compact && (
        <span
          role="tooltip"
          className="glass pointer-events-none absolute left-[calc(100%+14px)] z-50 whitespace-nowrap rounded-full px-3 py-1.5 text-xs text-text opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100 -translate-x-1"
        >
          {item.label}
          {item.fase && <span className="ml-1.5 text-text-3">· fase {item.fase}</span>}
        </span>
      )}
    </>
  )
  const base = cn(
    "group relative grid size-11 place-items-center rounded-full transition-colors",
    active ? "" : "text-text-2 hover:text-text",
  )
  if (item.fase) {
    return (
      <button type="button" aria-disabled title={`${item.label} chega na fase ${item.fase}`} className={cn(base, "cursor-default opacity-45 hover:opacity-80")}>
        {inner}
      </button>
    )
  }
  return (
    <NavLink to={item.to} aria-label={item.label} className={base}>
      {inner}
    </NavLink>
  )
}

function Rail() {
  const { pathname } = useLocation()
  return (
    <motion.aside
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="glass sticky top-4 hidden h-[calc(100dvh-2rem)] w-[76px] shrink-0 flex-col items-center rounded-[34px] py-4 lg:flex"
    >
      <NavLink to="/" aria-label="HENNRI /GEN — início">
        <Isotype />
      </NavLink>
      <div className="my-6 h-px w-8 bg-line-2" />
      <nav className="flex flex-col items-center gap-2">
        {NAV.map((item) => (
          <NavButton key={item.to} item={item} active={item.to === pathname} layoutId="rail-active" />
        ))}
      </nav>
      <div className="mt-auto flex flex-col items-center gap-3">
        <span className="text-[10px] uppercase tracking-[0.2em] text-text-3 [writing-mode:vertical-rl] rotate-180">v0.1 · fase 1</span>
        <span className="grid size-11 place-items-center rounded-full border border-line-2 text-sm font-semibold text-text">H</span>
      </div>
    </motion.aside>
  )
}

function TopBar() {
  return (
    <motion.header
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}
      className="flex items-center gap-3"
    >
      <NavLink to="/" className="flex items-center gap-3 lg:hidden" aria-label="HENNRI /GEN — início">
        <Isotype className="size-10" />
      </NavLink>
      <Wordmark className="hidden text-[26px] lg:block" />

      <button
        type="button"
        disabled
        title="Busca de jobs e prompts — chega com a galeria (fase 3)"
        className="glass-2 ml-auto hidden h-11 w-[min(380px,32vw)] items-center gap-3 rounded-full pr-2 pl-4 text-sm text-text-3 md:flex"
      >
        <Command className="size-4" strokeWidth={1.8} />
        Buscar jobs, prompts, presets…
        <kbd className="ml-auto rounded-full font-sans border border-line-2 px-2 py-0.5 text-[10px] tracking-wider">⌘K</kbd>
      </button>

      <div className="ml-auto flex items-center gap-2 md:ml-0">
        <AccentPicker />
        <ThemeToggle />
      </div>
    </motion.header>
  )
}

function Dock() {
  const { pathname } = useLocation()
  return (
    <nav className="glass fixed bottom-[max(16px,env(safe-area-inset-bottom))] left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-full p-1.5 lg:hidden">
      {NAV.map((item) => (
        <NavButton key={item.to} item={item} active={item.to === pathname} layoutId="dock-active" compact />
      ))}
    </nav>
  )
}

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh gap-4 p-3 sm:p-4">
      <Ambient />
      <Rail />
      <div className="flex min-w-0 flex-1 flex-col gap-5 pb-28 lg:pb-4">
        <TopBar />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
      <Dock />
    </div>
  )
}
