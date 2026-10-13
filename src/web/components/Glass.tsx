import { motion, type HTMLMotionProps } from "motion/react"
import type { ComponentProps, PointerEvent, ReactNode } from "react"
import { cn } from "@/lib/utils"

const spring = { type: "spring", stiffness: 380, damping: 32 } as const

/** Card de vidro com luz que segue o cursor e entrada suave. */
export function GlassCard({
  className,
  children,
  corner,
  delay = 0,
  interactive,
  ...rest
}: HTMLMotionProps<"section"> & {
  /** Botão que mora no recorte do canto. Fica fora da máscara (senão ela o cortaria). */
  corner?: ReactNode
  delay?: number
  /** Card clicável: levanta no hover, borda clareia, luz na cor de destaque, ↗ gira. */
  interactive?: boolean
  children?: ReactNode
}) {
  function onMove(e: PointerEvent<HTMLElement>) {
    const r = e.currentTarget.getBoundingClientRect()
    e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`)
    e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`)
    e.currentTarget.style.setProperty("--spot", "1")
  }
  const motionProps = {
    initial: { opacity: 0, y: 18, filter: "blur(6px)" },
    // filter precisa terminar em "none": qualquer filter num ancestral isola o
    // backdrop-filter dos filhos e o vidro deixa de enxergar o fundo.
    animate: { opacity: 1, y: 0, filter: "blur(0px)", transitionEnd: { filter: "none" } },
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const, delay },
    ...(interactive ? { whileHover: { y: -3, transition: spring } } : {}),
  }
  const leave = (e: PointerEvent<HTMLElement>) => e.currentTarget.style.setProperty("--spot", "0")
  if (!corner) {
    return (
      <motion.section
        {...motionProps}
        onPointerMove={onMove}
        onPointerLeave={leave}
        className={cn("glass spotlight relative rounded-[24px]", interactive && "card-hover spotlight-accent", className)}
        {...rest}
      >
        {children}
      </motion.section>
    )
  }
  return (
    <motion.section {...motionProps} className={cn("relative", interactive && "card-hover")} {...rest}>
      <div
        onPointerMove={onMove}
        onPointerLeave={leave}
        className={cn("glass spotlight notch relative h-full rounded-[24px]", interactive && "spotlight-accent", className)}
      >
        {children}
      </div>
      {corner}
    </motion.section>
  )
}

/** Botão redondo que mora no recorte do card. */
export function NotchButton({ className, ...props }: ComponentProps<"button">) {
  return (
    <motion.button
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.92 }}
      transition={spring}
      type="button"
      className={cn(
        "notch-arrow glass-2 absolute top-0 right-0 grid size-[44px] place-items-center rounded-full text-text transition-colors hover:bg-invert hover:text-invert-ink",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...(props as HTMLMotionProps<"button">)}
    />
  )
}

export function IconButton({
  className,
  active,
  ...props
}: HTMLMotionProps<"button"> & { active?: boolean }) {
  return (
    <motion.button
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.92 }}
      transition={spring}
      type="button"
      className={cn(
        "grid size-11 place-items-center rounded-full transition-colors",
        active ? "bg-invert text-invert-ink" : "glass-2 text-text-2 hover:text-text",
        className,
      )}
      {...props}
    />
  )
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("label flex items-center gap-2", className)}>
      {children}
    </p>
  )
}

export function Dot({ tone = "ok", pulse }: { tone?: "ok" | "bad" | "idle" | "accent"; pulse?: boolean }) {
  return (
    <span className="relative inline-flex size-2">
      {pulse && (
        <span
          className={cn(
            "absolute inset-0 animate-ping rounded-full opacity-60",
            tone === "bad" ? "bg-danger" : tone === "accent" ? "bg-accent" : "bg-text-2",
          )}
        />
      )}
      <span
        className={cn(
          "relative size-2 rounded-full",
          tone === "ok" && "bg-text",
          tone === "bad" && "bg-danger",
          tone === "idle" && "animate-pulse-soft bg-text-3",
          tone === "accent" && "bg-accent",
        )}
      />
    </span>
  )
}
