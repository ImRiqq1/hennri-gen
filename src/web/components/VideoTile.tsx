import { useReducedMotion } from "motion/react"
import { useRef, useState, type PointerEvent } from "react"
import { cn } from "@/lib/utils"

/**
 * Vídeo da galeria: parado mostra o primeiro frame; no hover toca mudo; arrastar o mouse
 * na horizontal faz scrub (a posição do mouse vira o tempo do vídeo). Fase 3 usa isto na Galeria.
 */
export function VideoTile({ src, poster, className, label }: { src: string; poster?: string; className?: string; label?: string }) {
  const ref = useRef<HTMLVideoElement>(null)
  const [pos, setPos] = useState<number | null>(null)
  const reduce = useReducedMotion()

  function onMove(e: PointerEvent<HTMLDivElement>) {
    const v = ref.current
    if (!v || !v.duration) return
    const r = e.currentTarget.getBoundingClientRect()
    const p = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
    setPos(p)
    // scrub só quando o mouse realmente percorre a peça; parado, deixa tocar
    v.pause()
    v.currentTime = p * v.duration
  }

  return (
    <div
      className={cn("group/vt relative overflow-hidden rounded-[18px] border border-line bg-black", className)}
      onPointerEnter={() => !reduce && void ref.current?.play().catch(() => {})}
      onPointerMove={onMove}
      onPointerLeave={() => {
        setPos(null)
        const v = ref.current
        if (v) {
          v.pause()
          v.currentTime = 0
        }
      }}
    >
      <video ref={ref} src={src} poster={poster} muted loop playsInline preload="metadata" className="size-full object-cover" aria-label={label} />
      {pos !== null && (
        <span className="pointer-events-none absolute inset-x-0 bottom-0 h-1 bg-white/15">
          <span className="block h-full bg-accent" style={{ width: `${pos * 100}%` }} />
        </span>
      )}
    </div>
  )
}
