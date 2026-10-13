import { motion } from "motion/react"
import { Home, Images, Keyboard, Layers, Search, Settings2, Sparkles, Wallet, type LucideIcon } from "lucide-react"
import { useEffect, useState, type ReactNode } from "react"
import { NavLink, useLocation } from "react-router-dom"
import { Ambient } from "@/components/Ambient"
import { LogoAssinatura, LogoSimbolo } from "@/brand/Logo"
import { CommandCenter, useCommandCenter } from "@/components/CommandCenter"
import { AccentPicker, ThemeToggle } from "@/components/ThemeControls"
import { MOD } from "@/lib/shortcuts"
import { cn } from "@/lib/utils"

type NavItem = { to: string; label: string; icon: LucideIcon; fase: number | null; keys?: string }

const NAV: NavItem[] = [
  { to: "/", label: "Início", icon: Home, fase: null, keys: "G H" },
  { to: "/criar", label: "Criar", icon: Sparkles, fase: null, keys: "G C" },
  { to: "/galeria", label: "Galeria", icon: Images, fase: 3 },
  { to: "/presets", label: "Presets", icon: Layers, fase: 4 },
  { to: "/custos", label: "Custos", icon: Wallet, fase: 4 },
  { to: "/config", label: "Config", icon: Settings2, fase: 4 },
]

const PAGE_TITLES: Record<string, string> = { "/": "Início", "/criar": "Criar" }

const spring = { type: "spring", stiffness: 420, damping: 36 } as const
const ease = [0.16, 1, 0.3, 1] as const


function SideItem({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon
  const content = (
    <>
      {active && <motion.span layoutId="side-active" transition={spring} className="absolute inset-0 rounded-full bg-invert" />}
      <span className="relative grid size-11 shrink-0 place-items-center">
        <Icon className={cn("size-[19px]", active && "text-invert-ink")} strokeWidth={1.7} />
      </span>
      <span className={cn("relative hidden flex-1 text-sm xl:block", active ? "font-medium text-invert-ink" : "")}>{item.label}</span>
      {item.fase ? (
        <span className="relative mr-3 hidden rounded-full border border-line-2 px-2 py-0.5 font-mono text-[10px] text-text-3 xl:block">fase {item.fase}</span>
      ) : item.keys ? (
        <span className={cn("relative mr-3 hidden font-mono text-[10px] tracking-wider opacity-0 transition-opacity group-hover:opacity-100 xl:block", active ? "text-invert-ink/60" : "text-text-3")}>
          {item.keys}
        </span>
      ) : null}
    </>
  )
  const base = cn("group relative flex h-11 items-center rounded-full transition-colors", active ? "" : "text-text-2 hover:bg-surface hover:text-text")
  if (item.fase) {
    return (
      <span title={`${item.label} chega na fase ${item.fase}`} className={cn(base, "cursor-default text-text-3 hover:text-text-2")}>
        {content}
      </span>
    )
  }
  return (
    <NavLink to={item.to} aria-label={item.label} className={base}>
      {content}
    </NavLink>
  )
}

function Sidebar() {
  const { pathname } = useLocation()
  const { openHelp } = useCommandCenter()
  return (
    <motion.aside
      initial={{ opacity: 0, x: -14 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.6, ease }}
      className="glass sticky top-4 hidden h-[calc(100dvh-2rem)] w-[76px] shrink-0 flex-col rounded-[32px] p-4 lg:flex xl:w-[244px]"
    >
      <NavLink to="/" className="flex h-11 items-center px-1.5" aria-label="MISE.IA — início">
        <LogoSimbolo className="size-8 xl:hidden" />
        <LogoAssinatura className="hidden h-7 xl:block" />
      </NavLink>

      <p className="label mt-9 mb-3 hidden px-3 xl:block">Estúdio</p>
      <div className="mt-8 mb-3 h-px bg-line xl:hidden" />
      <nav className="flex flex-col gap-1">
        {NAV.map((item) => (
          <SideItem key={item.to} item={item} active={item.to === pathname} />
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-3">
        <button
          type="button"
          onClick={openHelp}
          className="group flex h-11 items-center rounded-full text-text-2 transition-colors hover:bg-surface hover:text-text"
        >
          <span className="grid size-11 shrink-0 place-items-center">
            <Keyboard className="size-[19px]" strokeWidth={1.7} />
          </span>
          <span className="hidden flex-1 text-left text-sm xl:block">Atalhos</span>
          <span className="kbd mr-2 hidden xl:inline-flex">?</span>
        </button>
        <div className="flex items-center gap-3 rounded-[22px] border border-line bg-surface p-1.5 xl:p-2">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-invert text-sm font-semibold text-invert-ink">H</span>
          <span className="hidden min-w-0 xl:block">
            <span className="block truncate text-sm font-medium text-text">Henrique</span>
            <span className="block truncate font-mono text-[11px] text-text-3">fase 1 · local</span>
          </span>
        </div>
      </div>
    </motion.aside>
  )
}

function Clock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 15_000)
    return () => window.clearInterval(id)
  }, [])
  return (
    <span className="tabular">
      {now.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" }).replace(".", "")} ·{" "}
      {now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
    </span>
  )
}

function TopBar() {
  const { pathname } = useLocation()
  const { openPalette } = useCommandCenter()
  return (
    <motion.header
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease, delay: 0.05 }}
      className="flex items-center gap-3"
    >
      <NavLink to="/" className="lg:hidden" aria-label="MISE.IA — início">
        <LogoSimbolo className="size-9" />
      </NavLink>
      <div className="hidden min-w-0 items-center gap-2 font-mono text-xs text-text-3 sm:flex">
        <span>Estúdio</span>
        <span>/</span>
        <span className="text-text-2">{PAGE_TITLES[pathname] ?? "—"}</span>
        <span className="mx-2 h-3 w-px bg-line-2" />
        <Clock />
      </div>

      <button
        type="button"
        onClick={openPalette}
        className="glass-2 ml-auto flex h-11 items-center gap-3 rounded-full pr-1.5 pl-4 text-sm text-text-3 transition-colors hover:text-text-2 md:w-[min(360px,30vw)]"
      >
        <Search className="size-4" strokeWidth={1.8} />
        <span className="hidden md:inline">Buscar ou executar…</span>
        <span className="ml-auto hidden gap-1 md:flex">
          <span className="kbd">{MOD}</span>
          <span className="kbd">K</span>
        </span>
      </button>

      <div className="flex items-center gap-2">
        <AccentPicker />
        <ThemeToggle />
      </div>
    </motion.header>
  )
}

function Dock() {
  const { pathname } = useLocation()
  return (
    <nav className="float fixed bottom-[max(16px,env(safe-area-inset-bottom))] left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-full p-1.5 lg:hidden">
      {NAV.slice(0, 5).map((item) => {
        const Icon = item.icon
        const active = item.to === pathname
        const cls = cn("relative grid size-11 place-items-center rounded-full", active ? "text-invert-ink" : item.fase ? "text-text-3 opacity-50" : "text-text-2")
        const inner = (
          <>
            {active && <motion.span layoutId="dock-active" transition={spring} className="absolute inset-0 rounded-full bg-invert" />}
            <Icon className="relative size-[19px]" strokeWidth={1.7} />
          </>
        )
        return item.fase ? (
          <span key={item.to} className={cls} aria-disabled title={`${item.label} · fase ${item.fase}`}>
            {inner}
          </span>
        ) : (
          <NavLink key={item.to} to={item.to} aria-label={item.label} className={cls}>
            {inner}
          </NavLink>
        )
      })}
    </nav>
  )
}

export function Shell({ children }: { children: ReactNode }) {
  return (
    <CommandCenter>
      <div className="flex min-h-dvh gap-4 p-3 sm:p-4">
        <Ambient />
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col gap-5 pb-28 lg:pb-4">
          <TopBar />
          <main className="min-w-0 flex-1">{children}</main>
        </div>
        <Dock />
      </div>
    </CommandCenter>
  )
}
