import { AnimatePresence, motion } from "motion/react"
import {
  Home,
  Images,
  Keyboard,
  Layers,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings2,
  Sparkles,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react"
import { useCallback, useEffect, useState, type ReactNode } from "react"
import { NavLink, useLocation } from "react-router-dom"
import { LogoAssinatura, LogoSimbolo } from "@/brand/Logo"
import { Ambient } from "@/components/Ambient"
import { CommandCenter, useCommandCenter } from "@/components/CommandCenter"
import { AccentPicker, ThemeToggle } from "@/components/ThemeControls"
import { isTyping, MOD, overlayOpen } from "@/lib/shortcuts"
import { useFocusTrap } from "@/lib/useFocusTrap"
import { cn } from "@/lib/utils"

type NavItem = { to: string; label: string; icon: LucideIcon; fase: number | null; keys?: string }

const NAV: NavItem[] = [
  { to: "/", label: "Início", icon: Home, fase: null, keys: "G H" },
  { to: "/criar", label: "Criar", icon: Sparkles, fase: null, keys: "G C" },
  { to: "/galeria", label: "Galeria", icon: Images, fase: null, keys: "G G" },
  { to: "/presets", label: "Presets", icon: Layers, fase: null, keys: "G P" },
  { to: "/custos", label: "Custos", icon: Wallet, fase: null, keys: "G U" },
  { to: "/config", label: "Config", icon: Settings2, fase: null, keys: "G ," },
]

const PAGE_TITLES: Record<string, string> = { "/": "Início", "/criar": "Criar", "/galeria": "Galeria", "/presets": "Presets", "/custos": "Custos", "/config": "Configurações" }

const spring = { type: "spring", stiffness: 420, damping: 36 } as const
const widthSpring = { type: "spring", stiffness: 380, damping: 38 } as const
const ease = [0.16, 1, 0.3, 1] as const

const SIDEBAR_KEY = "mise:sidebar"
const W_OPEN = 236
const W_CLOSED = 76

function readCollapsed() {
  try {
    const v = localStorage.getItem(SIDEBAR_KEY)
    if (v === "1" || v === "0") return v === "1"
  } catch {
    // storage bloqueado: cai no padrão
  }
  return window.innerWidth < 1280
}

/** Rótulo flutuante à direita do item (sidebar recolhida ou item indisponível). */
function Tip({ children, show }: { children: ReactNode; show: boolean }) {
  if (!show) return null
  return (
    <span
      role="tooltip"
      className="float pointer-events-none absolute top-1/2 left-[calc(100%+12px)] z-50 -translate-x-1 -translate-y-1/2 rounded-full px-3 py-1.5 text-xs whitespace-nowrap text-text opacity-0 transition-all duration-150 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100"
    >
      {children}
    </span>
  )
}

function SideItem({ item, active, collapsed, onNavigate }: { item: NavItem; active: boolean; collapsed: boolean; onNavigate?: () => void }) {
  const Icon = item.icon
  const disabled = item.fase !== null
  const inner = (
    <>
      {active && <motion.span layoutId="side-active" transition={spring} className="absolute inset-0 rounded-full bg-invert" />}
      <span className="relative grid size-11 shrink-0 place-items-center">
        <Icon className={cn("size-[18px] transition-transform duration-200 group-hover:scale-110", active && "text-invert-ink")} strokeWidth={1.7} />
        {disabled && collapsed && <span className="absolute top-2.5 right-2.5 size-1.5 rounded-full bg-text-3" />}
      </span>
      {!collapsed && (
        <motion.span
          initial={{ opacity: 0, x: -4 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2, delay: 0.06 }}
          className={cn("relative flex min-w-0 flex-1 items-center justify-between gap-2 pr-3 text-sm whitespace-nowrap", active && "font-medium text-invert-ink")}
        >
          <span className="truncate">{item.label}</span>
          {disabled ? (
            <span className="size-1.5 shrink-0 rounded-full bg-text-3" aria-hidden />
          ) : (
            item.keys && (
              <span className={cn("font-mono text-[11px] opacity-0 transition-opacity group-hover:opacity-100", active ? "text-invert-ink/60" : "text-text-3")}>
                {item.keys}
              </span>
            )
          )}
        </motion.span>
      )}
      <Tip show={collapsed || disabled}>
        {item.label}
        {disabled ? <span className="ml-1.5 text-text-3">· chega na fase {item.fase}</span> : item.keys && <span className="ml-1.5 font-mono text-text-3">{item.keys}</span>}
      </Tip>
    </>
  )
  const base = cn(
    "group relative flex h-11 items-center rounded-full outline-offset-2 transition-colors duration-150",
    !active && !disabled && "text-text-2 hover:bg-surface hover:text-text",
  )
  if (disabled) {
    return (
      <button type="button" aria-disabled="true" aria-label={`${item.label} (chega na fase ${item.fase})`} onClick={(e) => e.preventDefault()} className={cn(base, "cursor-not-allowed text-text-3")}>
        {inner}
      </button>
    )
  }
  return (
    <NavLink to={item.to} aria-label={item.label} onClick={onNavigate} className={base}>
      {inner}
    </NavLink>
  )
}

function SidebarContent({
  collapsed,
  onToggle,
  onNavigate,
  variant,
}: {
  collapsed: boolean
  onToggle?: () => void
  onNavigate?: () => void
  variant: "rail" | "drawer"
}) {
  const { pathname } = useLocation()
  const { openHelp } = useCommandCenter()
  return (
    <>
      <div className={cn("flex items-center", collapsed ? "flex-col gap-3" : "justify-between gap-2")}>
        <NavLink to="/" onClick={onNavigate} className="flex h-11 items-center px-1.5" aria-label="MISE.IA — início">
          {collapsed ? <LogoSimbolo className="size-8" /> : <LogoAssinatura className="h-[26px]" />}
        </NavLink>
        {onToggle && (
          <button
            type="button"
            onClick={onToggle}
            aria-label={variant === "drawer" ? "Fechar menu" : collapsed ? "Expandir menu" : "Recolher menu"}
            title={variant === "drawer" ? "Fechar" : `${collapsed ? "Expandir" : "Recolher"} menu  [`}
            className="group grid size-9 shrink-0 place-items-center rounded-full text-text-3 transition-colors hover:bg-surface hover:text-text"
          >
            {variant === "drawer" ? (
              <X className="size-[18px]" strokeWidth={1.7} />
            ) : collapsed ? (
              <PanelLeftOpen className="size-[18px] transition-transform group-hover:translate-x-0.5" strokeWidth={1.7} />
            ) : (
              <PanelLeftClose className="size-[18px] transition-transform group-hover:-translate-x-0.5" strokeWidth={1.7} />
            )}
          </button>
        )}
      </div>

      {collapsed ? <div className="mt-5 mb-3 h-px bg-line" /> : <p className="label mt-7 mb-2.5 px-3">Estúdio</p>}
      <nav aria-label="Navegação principal" className="flex flex-col gap-1">
        {NAV.map((item) => (
          <SideItem key={item.to} item={item} active={item.to === pathname} collapsed={collapsed} onNavigate={onNavigate} />
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-2.5">
        <button
          type="button"
          onClick={openHelp}
          aria-label="Atalhos de teclado"
          className="group relative flex h-11 items-center rounded-full text-text-2 transition-colors hover:bg-surface hover:text-text"
        >
          <span className="grid size-11 shrink-0 place-items-center">
            <Keyboard className="size-[18px]" strokeWidth={1.7} />
          </span>
          {!collapsed && (
            <>
              <span className="flex-1 text-left text-sm">Atalhos</span>
              <span className="kbd mr-2">?</span>
            </>
          )}
          <Tip show={collapsed}>
            Atalhos <span className="ml-1 font-mono text-text-3">?</span>
          </Tip>
        </button>
        <div className={cn("flex items-center gap-3 rounded-[20px] border border-line bg-surface", collapsed ? "justify-center p-1.5" : "p-2")}>
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-invert text-sm font-semibold text-invert-ink">H</span>
          {!collapsed && (
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-text">Henrique</span>
              <span className="block truncate font-mono text-[11px] text-text-3">estúdio pessoal</span>
            </span>
          )}
        </div>
      </div>
    </>
  )
}

function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? W_CLOSED : W_OPEN }}
      transition={widthSpring}
      className="glass sticky top-4 hidden h-[calc(100dvh-2rem)] shrink-0 flex-col rounded-[28px] p-4 lg:flex"
    >
      <SidebarContent collapsed={collapsed} onToggle={onToggle} variant="rail" />
    </motion.aside>
  )
}

function Drawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const trap = useFocusTrap<HTMLElement>(open)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="drawer"
          className="fixed inset-0 z-[90] lg:hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.15 } }}
        >
          <button type="button" aria-label="Fechar menu" onClick={onClose} className="absolute inset-0 bg-black/45" />
          <motion.aside
            ref={trap}
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            initial={{ x: "-104%" }}
            animate={{ x: 0 }}
            exit={{ x: "-104%", transition: { duration: 0.18, ease: [0.7, 0, 0.84, 0] } }}
            transition={{ duration: 0.32, ease }}
            className="glass absolute top-3 bottom-3 left-3 flex w-[min(300px,82vw)] flex-col rounded-[28px] p-4"
          >
            <SidebarContent collapsed={false} onToggle={onClose} onNavigate={onClose} variant="drawer" />
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
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

function TopBar({ onMenu }: { onMenu: () => void }) {
  const { pathname } = useLocation()
  const { openPalette } = useCommandCenter()
  return (
    <motion.header
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease, delay: 0.05 }}
      className="flex items-center gap-2.5"
    >
      <button
        type="button"
        onClick={onMenu}
        aria-label="Abrir menu"
        className="glass-2 grid size-10 place-items-center rounded-full text-text-2 transition-colors hover:text-text lg:hidden"
      >
        <Menu className="size-[18px]" strokeWidth={1.7} />
      </button>
      <NavLink to="/" className="lg:hidden" aria-label="MISE.IA — início">
        <LogoSimbolo className="size-8" />
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
        aria-label="Buscar ou executar (paleta de comandos)"
        className="glass-2 ml-auto flex h-10 items-center gap-3 rounded-full pr-1.5 pl-3.5 text-sm text-text-3 transition-colors hover:border-line-2 hover:text-text-2 md:w-[min(340px,28vw)]"
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
    <nav aria-label="Navegação rápida" className="float fixed bottom-[max(14px,env(safe-area-inset-bottom))] left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-full p-1.5 lg:hidden">
      {NAV.slice(0, 5).map((item) => {
        const Icon = item.icon
        const active = item.to === pathname
        const disabled = item.fase !== null
        const cls = cn("relative grid size-11 place-items-center rounded-full", active ? "text-invert-ink" : disabled ? "text-text-3" : "text-text-2")
        const inner = (
          <>
            {active && <motion.span layoutId="dock-active" transition={spring} className="absolute inset-0 rounded-full bg-invert" />}
            <Icon className="relative size-[19px]" strokeWidth={1.7} />
            {disabled && <span className="absolute top-2 right-2 size-1.5 rounded-full bg-text-3" />}
          </>
        )
        return disabled ? (
          <button key={item.to} type="button" className={cls} aria-disabled="true" aria-label={`${item.label} (chega na fase ${item.fase})`}>
            {inner}
          </button>
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
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const [drawer, setDrawer] = useState(false)

  const toggle = useCallback(() => {
    setCollapsed((c) => {
      try {
        localStorage.setItem(SIDEBAR_KEY, c ? "0" : "1")
      } catch {
        // sem storage: só não lembra
      }
      return !c
    })
  }, [])

  // [ alterna a sidebar (no celular, abre/fecha o drawer)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "[" || e.ctrlKey || e.metaKey || e.altKey || isTyping(e) || overlayOpen()) return
      e.preventDefault()
      if (window.matchMedia("(min-width: 1024px)").matches) toggle()
      else setDrawer((v) => !v)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [toggle])

  return (
    <CommandCenter>
      <div className="flex min-h-dvh gap-3 p-3 sm:gap-4 sm:p-4">
        <Ambient />
        <Sidebar collapsed={collapsed} onToggle={toggle} />
        <div className="flex min-w-0 flex-1 flex-col gap-4 pb-24 lg:pb-2">
          <TopBar onMenu={() => setDrawer(true)} />
          <main className="min-w-0 flex-1">{children}</main>
        </div>
        <Dock />
        <Drawer open={drawer} onClose={() => setDrawer(false)} />
      </div>
    </CommandCenter>
  )
}
