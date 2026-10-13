import { AnimatePresence, motion } from "motion/react"
import { Moon, Palette, Sun } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { ACCENTS, useTheme } from "@/theme/theme"
import { cn } from "@/lib/utils"

const spring = { type: "spring", stiffness: 520, damping: 34 } as const

/** Interruptor sol/lua: a bolinha desliza e o ícone gira enquanto troca. */
export function ThemeToggle({ className }: { className?: string }) {
  const { mode, toggleMode } = useTheme()
  const dark = mode === "dark"
  return (
    <button
      type="button"
      role="switch"
      data-theme-toggle
      aria-checked={!dark}
      aria-label={dark ? "Mudar para o modo claro" : "Mudar para o modo escuro"}
      onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect()
        toggleMode({ x: r.left + r.width / 2, y: r.top + r.height / 2 })
      }}
      className={cn("glass-2 relative flex h-11 w-[84px] items-center rounded-full p-1", className)}
    >
      <Sun className="absolute left-3.5 size-4 text-text-3" strokeWidth={1.8} />
      <Moon className="absolute right-3.5 size-4 text-text-3" strokeWidth={1.8} />
      <motion.span
        layout
        transition={spring}
        className={cn(
          "relative z-10 grid size-9 place-items-center rounded-full bg-invert text-invert-ink shadow-[var(--shadow-sm)]",
          dark ? "ml-auto" : "mr-auto",
        )}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={mode}
            initial={{ rotate: -90, scale: 0.4, opacity: 0 }}
            animate={{ rotate: 0, scale: 1, opacity: 1 }}
            exit={{ rotate: 90, scale: 0.4, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          >
            {dark ? <Moon className="size-4" strokeWidth={2} /> : <Sun className="size-4" strokeWidth={2} />}
          </motion.span>
        </AnimatePresence>
      </motion.span>
    </button>
  )
}

/** Seletor da cor de destaque: abre uma pílula com as amostras. */
export function AccentPicker({ align = "right" }: { align?: "right" | "up" }) {
  const { accent, setAccent } = useTheme()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    document.addEventListener("pointerdown", close)
    document.addEventListener("keydown", esc)
    return () => {
      document.removeEventListener("pointerdown", close)
      document.removeEventListener("keydown", esc)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <motion.button
        type="button"
        aria-label="Cor de destaque"
        aria-expanded={open}
        whileTap={{ scale: 0.92 }}
        onClick={() => setOpen((v) => !v)}
        className="glass-2 grid size-11 place-items-center rounded-full text-text-2 hover:text-text"
      >
        <span className="relative grid place-items-center">
          <Palette className="size-[18px]" strokeWidth={1.8} />
          <span className="absolute -right-1 -bottom-1 size-2.5 rounded-full bg-accent ring-2 ring-[var(--bg)]" />
        </span>
      </motion.button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: align === "up" ? 8 : -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: align === "up" ? 4 : -4, transition: { duration: 0.14 } }}
            transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              "float absolute z-50 flex items-center gap-1.5 rounded-full p-1.5",
              align === "up" ? "bottom-[calc(100%+10px)] left-1/2 -translate-x-1/2" : "top-[calc(100%+10px)] right-0",
            )}
          >
            {ACCENTS.map((a) => (
              <button
                key={a.id}
                type="button"
                title={a.label}
                aria-label={`Destaque ${a.label}`}
                aria-pressed={accent === a.id}
                onClick={() => setAccent(a.id)}
                className="relative grid size-9 place-items-center rounded-full"
              >
                {accent === a.id && (
                  <motion.span layoutId="accent-ring" transition={spring} className="absolute inset-0 rounded-full ring-2 ring-text" />
                )}
                <span className="size-6 rounded-full shadow-inner" style={{ background: a.swatch }} />
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
