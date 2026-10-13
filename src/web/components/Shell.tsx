import type { ReactNode } from "react"
import { NavLink } from "react-router-dom"
import { cn } from "@/lib/utils"

const NAV = [
  { to: "/", label: "Criar", fase: null },
  { to: "/galeria", label: "Galeria", fase: 3 },
  { to: "/presets", label: "Presets", fase: 4 },
  { to: "/custos", label: "Custos", fase: 4 },
  { to: "/config", label: "Config", fase: 4 },
] as const

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-condensed uppercase leading-none tracking-wide text-paper", className)}>
      Hennri <span className="text-cream/50">/</span>Gen
    </span>
  )
}

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 border-b bg-ink/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <NavLink to="/" aria-label="HENNRI /GEN — início">
            <Wordmark className="text-2xl" />
          </NavLink>
          <nav className="-mr-2 flex items-center gap-1 overflow-x-auto">
            {NAV.map((item) =>
              item.fase ? (
                <span
                  key={item.to}
                  title={`Chega na fase ${item.fase}`}
                  className="hidden cursor-default rounded-full px-3 py-1.5 text-sm text-cream/30 sm:inline"
                >
                  {item.label}
                </span>
              ) : (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      "rounded-full px-3 py-1.5 text-sm transition-colors",
                      isActive ? "bg-paper text-ink" : "text-cream/70 hover:text-paper",
                    )
                  }
                >
                  {item.label}
                </NavLink>
              ),
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12">{children}</main>
    </div>
  )
}
