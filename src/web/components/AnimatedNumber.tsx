import { animate, useReducedMotion } from "motion/react"
import { useEffect, useRef } from "react"

/** Número que conta até o valor novo (expo-out, ~0.7s). `format` decide o texto. */
export function AnimatedNumber({
  value,
  format = (n) => Math.round(n).toLocaleString("pt-BR"),
  className,
}: {
  value: number
  format?: (n: number) => string
  className?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const from = useRef(value)
  const reduce = useReducedMotion()

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (reduce || from.current === value) {
      el.textContent = format(value)
      from.current = value
      return
    }
    const controls = animate(from.current, value, {
      duration: 0.7,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => (el.textContent = format(v)),
    })
    from.current = value
    return () => controls.stop()
  }, [value, format, reduce])

  return (
    <span ref={ref} className={className}>
      {format(value)}
    </span>
  )
}
