import { useEffect, useRef } from "react"

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Prende o Tab dentro do diálogo enquanto ele está aberto e, ao fechar,
 * devolve o foco pra quem estava focado antes (o botão que abriu).
 */
export function useFocusTrap<T extends HTMLElement>(active: boolean) {
  const ref = useRef<T>(null)

  useEffect(() => {
    if (!active) return
    const previous = document.activeElement as HTMLElement | null
    const root = ref.current
    // foca o primeiro alvo se nada lá dentro pegou o foco (autoFocus tem prioridade)
    const raf = requestAnimationFrame(() => {
      if (root && !root.contains(document.activeElement)) {
        root.querySelector<HTMLElement>(FOCUSABLE)?.focus()
      }
    })
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !root) return
      const items = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null)
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener("keydown", onKey)
    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener("keydown", onKey)
      if (previous && document.contains(previous)) previous.focus()
    }
  }, [active])

  return ref
}
