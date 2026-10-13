import { AnimatePresence, motion } from "motion/react"
import {
  AlertTriangle,
  ArrowLeftRight,
  AudioLines,
  Box,
  GripVertical,
  ImagePlus,
  Images,
  RefreshCw,
  Shirt,
  Smile,
  Upload,
  Video,
  X,
  type LucideIcon,
} from "lucide-react"
import { useRef, useState, type DragEvent, type ReactNode } from "react"
import { useToast } from "@/components/Toaster"
import {
  ACCEPT,
  addFiles,
  fmtBytes,
  fmtDuration,
  moveItem,
  removeItem,
  retryItem,
  swapSlots,
  useMediaState,
  useSlot,
  type MediaItem,
  type SlotRules,
} from "@/lib/media"
import { cn } from "@/lib/utils"

const ease = [0.16, 1, 0.3, 1] as const

// ---------------------------------------------------------------- zona ativa (pra Ctrl+V)

let lastZone: { key: string; rules: SlotRules } | null = null
/** Último slot que o usuário apontou/focou — é pra lá que o Ctrl+V manda o arquivo. */
export function lastActiveZone() {
  return lastZone
}

function acceptAttr(rules: SlotRules) {
  return rules.kinds.flatMap((k) => ACCEPT[k]).join(",")
}

// ---------------------------------------------------------------- DropZone

export function DropZone({
  slot,
  rules,
  children,
  className,
  disabled,
}: {
  slot: string
  rules: SlotRules
  children: ReactNode
  className?: string
  disabled?: boolean
}) {
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const toast = useToast()

  async function take(files: File[]) {
    if (!files.length || disabled) return
    const refused = await addFiles(slot, files, rules)
    refused.forEach((r) => toast({ title: "Arquivo recusado", detail: r, tone: "error" }))
  }

  const mark = () => (lastZone = { key: slot, rules })

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      onPointerEnter={mark}
      onFocus={mark}
      onClick={() => {
        mark()
        if (!disabled) input.current?.click()
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          input.current?.click()
        }
      }}
      onDragOver={(e: DragEvent) => {
        e.preventDefault()
        if (!over) setOver(true)
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(false)
      }}
      onDrop={(e: DragEvent) => {
        e.preventDefault()
        setOver(false)
        mark()
        void take(Array.from(e.dataTransfer.files))
      }}
      className={cn(
        "group/drop relative cursor-pointer rounded-[18px] border border-dashed outline-offset-2 transition-[border-color,background-color] duration-150",
        over ? "border-accent bg-accent/8" : "border-line-2 bg-surface hover:border-text-3 hover:bg-surface-2",
        disabled && "cursor-not-allowed opacity-50",
        className,
      )}
    >
      {children}
      <input
        ref={input}
        type="file"
        multiple={rules.max > 1}
        accept={acceptAttr(rules)}
        className="sr-only"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => {
          void take(Array.from(e.target.files ?? []))
          e.target.value = ""
        }}
      />
    </div>
  )
}

/** Texto e ícones do estado vazio de uma zona. */
export function EmptyHint({
  icons,
  title,
  hint,
  compact,
}: {
  icons: LucideIcon[]
  title: string
  hint: string
  compact?: boolean
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center", compact ? "gap-1.5 px-3 py-4" : "gap-2 px-4 py-6")}>
      <span className="flex -space-x-1.5">
        {icons.map((I, i) => (
          <span
            key={i}
            className="grid size-9 place-items-center rounded-full border border-line-2 bg-panel text-text-2 transition-transform duration-200 group-hover/drop:-translate-y-0.5"
            style={{ transitionDelay: `${i * 30}ms` }}
          >
            <I className="size-4" strokeWidth={1.7} />
          </span>
        ))}
      </span>
      <p className="text-sm font-medium text-text">{title}</p>
      <p className="text-xs text-text-3">{hint}</p>
    </div>
  )
}

// ---------------------------------------------------------------- miniatura

function Progress({ item }: { item: MediaItem }) {
  if (item.status !== "uploading" && item.status !== "checking") return null
  return (
    <span className="absolute inset-x-1.5 bottom-1.5 h-1 overflow-hidden rounded-full bg-black/40">
      <motion.span
        className="block h-full rounded-full bg-white"
        initial={false}
        animate={{ width: item.status === "checking" ? "8%" : `${Math.max(4, item.progress * 100)}%` }}
        transition={{ duration: 0.2 }}
      />
    </span>
  )
}

function Thumb({ item, className }: { item: MediaItem; className?: string }) {
  if (item.kind === "image") return <img src={item.previewUrl} alt="" className={cn("size-full object-cover", className)} draggable={false} />
  if (item.kind === "video")
    return (
      <video
        src={item.previewUrl}
        muted
        loop
        playsInline
        preload="metadata"
        className={cn("size-full object-cover", className)}
        onMouseEnter={(e) => void e.currentTarget.play().catch(() => {})}
        onMouseLeave={(e) => e.currentTarget.pause()}
      />
    )
  return (
    <span className={cn("grid size-full place-items-center bg-surface-2 text-text-2", className)}>
      <AudioLines className="size-6" strokeWidth={1.6} />
    </span>
  )
}

export function ItemTile({
  item,
  index,
  slot,
  rules,
  draggable,
  onDragStartIdx,
  onDropIdx,
  fill,
}: {
  /** ocupa o contêiner inteiro (slot de frame) em vez de ser quadrado */
  fill?: boolean
  item: MediaItem
  index: number
  slot: string
  rules: SlotRules
  draggable?: boolean
  onDragStartIdx?: (i: number) => void
  onDropIdx?: (i: number) => void
}) {
  const bad = item.status === "error"
  const tag = item.kind === "image" ? "image" : item.kind === "video" ? "video" : "audio"
  return (
    <motion.figure
      layout
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.12 } }}
      transition={{ duration: 0.22, ease }}
      draggable={draggable}
      onDragStart={() => onDragStartIdx?.(index)}
      onDragOver={(e) => draggable && e.preventDefault()}
      onDrop={(e) => {
        if (!draggable) return
        e.preventDefault()
        e.stopPropagation()
        onDropIdx?.(index)
      }}
      title={item.error ?? item.warning ?? item.name}
      className={cn(
        "group/tile relative overflow-hidden rounded-[14px] border bg-surface",
        fill ? "size-full" : "aspect-square",
        bad ? "border-danger" : item.warning ? "border-accent/60" : "border-line",
        draggable && "cursor-grab active:cursor-grabbing",
      )}
    >
      <Thumb item={item} className={cn(bad && "opacity-40")} />
      <span className="absolute top-1.5 left-1.5 rounded-full bg-black/55 px-1.5 py-0.5 font-mono text-[11px] text-white backdrop-blur">
        {tag}_{index + 1}
        {item.meta.duration ? ` · ${fmtDuration(item.meta.duration)}` : ""}
      </span>
      {draggable && (
        <GripVertical className="absolute bottom-1.5 left-1 size-4 text-white/80 opacity-0 drop-shadow transition-opacity group-hover/tile:opacity-100" />
      )}
      <button
        type="button"
        aria-label={`Remover ${item.name}`}
        onClick={(e) => {
          e.stopPropagation()
          removeItem(slot, item.id)
        }}
        className="absolute top-1.5 right-1.5 grid size-6 place-items-center rounded-full bg-black/60 text-white opacity-0 backdrop-blur transition-opacity group-hover/tile:opacity-100 focus-visible:opacity-100"
      >
        <X className="size-3.5" />
      </button>
      {bad && (
        <span className="absolute inset-x-1.5 bottom-1.5 flex items-center gap-1 rounded-lg bg-danger/90 px-1.5 py-1 text-[11px] leading-tight text-white">
          <AlertTriangle className="size-3 shrink-0" />
          <span className="line-clamp-2">{item.error}</span>
          {item.error?.startsWith("Falha no envio") && (
            <button type="button" aria-label="Tentar de novo" onClick={(e) => (e.stopPropagation(), void retryItem(slot, item.id, rules))} className="ml-auto">
              <RefreshCw className="size-3" />
            </button>
          )}
        </span>
      )}
      <Progress item={item} />
    </motion.figure>
  )
}

// ---------------------------------------------------------------- grade (imagens, vídeos, áudios)

export function MediaGrid({
  slot,
  rules,
  empty,
  label,
  extraCount,
  compact,
}: {
  slot: string
  rules: SlotRules
  empty: { icons: LucideIcon[]; title: string; hint: string }
  label?: string
  /** soma de outros slots que contam pro mesmo teto (ex.: total de 50 nas Referências) */
  extraCount?: number
  compact?: boolean
}) {
  const items = useSlot(slot)
  const dragFrom = useRef<number | null>(null)
  const full = items.length >= rules.max
  return (
    <div className="min-w-0">
      {label && (
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <span className="label">{label}</span>
          <span className={cn("font-mono text-[11px] tabular", full ? "text-accent" : "text-text-3")}>
            {items.length}/{rules.max}
            {extraCount !== undefined ? ` · total ${items.length + extraCount}/50` : ""}
          </span>
        </div>
      )}
      {items.length === 0 ? (
        <DropZone slot={slot} rules={rules}>
          <EmptyHint icons={empty.icons} title={empty.title} hint={empty.hint} compact={compact} />
        </DropZone>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(76px,1fr))] gap-2">
          <AnimatePresence initial={false}>
            {items.map((it, i) => (
              <ItemTile
                key={it.id}
                item={it}
                index={i}
                slot={slot}
                rules={rules}
                draggable={items.length > 1}
                onDragStartIdx={(from) => (dragFrom.current = from)}
                onDropIdx={(to) => {
                  if (dragFrom.current !== null && dragFrom.current !== to) moveItem(slot, dragFrom.current, to)
                  dragFrom.current = null
                }}
              />
            ))}
          </AnimatePresence>
          {!full && (
            <DropZone slot={slot} rules={rules} className="grid aspect-square place-items-center">
              <span className="flex flex-col items-center gap-1 text-text-3 transition-colors group-hover/drop:text-text">
                <ImagePlus className="size-5" strokeWidth={1.6} />
                <span className="text-[11px]">adicionar</span>
              </span>
            </DropZone>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- vídeo de origem (1 slot grande)

export function VideoSlot({
  slot,
  rules,
  title,
  hint,
  label,
}: {
  slot: string
  rules: SlotRules
  title: string
  hint: string
  label?: string
}) {
  const [item] = useSlot(slot)
  return (
    <div className="min-w-0">
      {label && (
        <div className="mb-2 flex items-baseline justify-between">
          <span className="label">{label}</span>
          {item?.meta.duration && <span className="font-mono text-[11px] text-text-3 tabular">{item.meta.duration.toFixed(1)} s</span>}
        </div>
      )}
      {!item ? (
        <DropZone slot={slot} rules={rules}>
          <EmptyHint icons={[Video]} title={title} hint={hint} />
        </DropZone>
      ) : (
        <div className={cn("relative overflow-hidden rounded-[18px] border bg-black", item.status === "error" ? "border-danger" : "border-line")}>
          <video
            src={item.previewUrl}
            muted
            loop
            playsInline
            autoPlay
            className={cn("aspect-video w-full object-contain", item.status === "error" && "opacity-40")}
          />
          <div className="absolute inset-x-0 top-0 flex items-center gap-2 bg-gradient-to-b from-black/70 to-transparent p-2.5 text-xs text-white">
            <Video className="size-3.5" />
            <span className="truncate">{item.name}</span>
            <span className="ml-auto shrink-0 font-mono tabular">
              {item.meta.duration ? fmtDuration(item.meta.duration) : "…"}
              {item.meta.width ? ` · ${item.meta.width}×${item.meta.height}` : ""} · {fmtBytes(item.bytes)}
            </span>
          </div>
          <div className="absolute inset-x-0 bottom-0 flex items-end gap-2 bg-gradient-to-t from-black/75 to-transparent p-2.5">
            <span className="min-w-0 flex-1 text-xs">
              {item.status === "error" ? (
                <span className="flex items-center gap-1.5 text-[#ff8f94]">
                  <AlertTriangle className="size-3.5 shrink-0" /> {item.error}
                </span>
              ) : item.warning ? (
                <span className="text-white/85">{item.warning}</span>
              ) : item.status === "done" ? (
                <span className="text-white/70">Enviado · pronto pra gerar</span>
              ) : (
                <span className="text-white/70">{item.status === "checking" ? "Conferindo o vídeo…" : `Enviando ${Math.round(item.progress * 100)}%`}</span>
              )}
            </span>
            <DropZone slot={slot} rules={rules} className="flex h-8 items-center gap-1.5 rounded-full border-solid border-white/25 bg-black/40 px-3 text-xs text-white backdrop-blur hover:border-white/50 hover:bg-black/60">
              <Upload className="size-3.5" /> trocar
            </DropZone>
            <button
              type="button"
              aria-label="Remover vídeo"
              onClick={() => removeItem(slot, item.id)}
              className="grid size-8 place-items-center rounded-full bg-black/40 text-white backdrop-blur hover:bg-black/60"
            >
              <X className="size-4" />
            </button>
          </div>
          {(item.status === "uploading" || item.status === "checking") && (
            <span className="absolute inset-x-0 bottom-0 h-1 bg-white/15">
              <motion.span className="block h-full bg-accent" animate={{ width: `${Math.max(4, item.progress * 100)}%` }} transition={{ duration: 0.2 }} />
            </span>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- 1º e último frame

function FrameSlot({ slot, rules, title, required }: { slot: string; rules: SlotRules; title: string; required?: boolean }) {
  const [item] = useSlot(slot)
  return (
    <div className="min-w-0 flex-1">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="label">{title}</span>
        <span className="font-mono text-[11px] text-text-3">{required ? "obrigatório" : "opcional"}</span>
      </div>
      {item ? (
        <div className="aspect-video">
          <ItemTile item={item} index={0} slot={slot} rules={rules} fill />
        </div>
      ) : (
        <DropZone slot={slot} rules={rules} className="grid aspect-video place-items-center">
          <EmptyHint icons={[ImagePlus]} title={required ? "Primeiro frame" : "Último frame"} hint="jpeg, png, webp" compact />
        </DropZone>
      )}
    </div>
  )
}

export function FramePair({ first, last, rules }: { first: string; last: string; rules: SlotRules }) {
  return (
    <div className="flex max-w-[620px] items-end gap-2">
      <FrameSlot slot={first} rules={rules} title="Primeiro frame" required />
      <button
        type="button"
        onClick={() => swapSlots(first, last)}
        aria-label="Trocar a ordem dos frames"
        title="Trocar a ordem"
        className="glass-2 mb-[calc(28%-18px)] grid size-9 shrink-0 place-items-center rounded-full text-text-2 transition-[color,rotate] duration-200 hover:rotate-180 hover:text-text"
      >
        <ArrowLeftRight className="size-4" strokeWidth={1.8} />
      </button>
      <FrameSlot slot={last} rules={rules} title="Último frame" />
    </div>
  )
}

// ---------------------------------------------------------------- abas com contador

export function MediaTabs({
  tabs,
}: {
  tabs: { id: string; label: string; icon: LucideIcon; slot: string; rules: SlotRules; empty: { title: string; hint: string } }[]
}) {
  const [active, setActive] = useState(tabs[0].id)
  const media = useMediaState()
  const counts = tabs.map((t) => ({ id: t.id, n: (media[t.slot] ?? []).length }))
  const total = counts.reduce((a, c) => a + c.n, 0)
  const tab = tabs.find((t) => t.id === active) ?? tabs[0]
  return (
    <div className="min-w-0">
      <div className="mb-2.5 flex items-center gap-2">
        <div role="tablist" className="flex gap-1 rounded-full bg-surface p-1">
          {tabs.map((t) => {
            const n = counts.find((c) => c.id === t.id)!.n
            const on = t.id === active
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setActive(t.id)}
                className={cn("relative flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-colors", on ? "text-invert-ink" : "text-text-2 hover:text-text")}
              >
                {on && <motion.span layoutId={`mt-${tabs[0].slot}`} className="absolute inset-0 rounded-full bg-invert" transition={{ type: "spring", stiffness: 460, damping: 36 }} />}
                <t.icon className="relative size-3.5" strokeWidth={1.8} />
                <span className="relative">{t.label}</span>
                <span className={cn("relative font-mono text-[11px] tabular", on ? "text-invert-ink/60" : "text-text-3")}>
                  {n}/{t.rules.max}
                </span>
              </button>
            )
          })}
        </div>
        <span className={cn("ml-auto font-mono text-[11px] tabular", total >= 50 ? "text-danger" : "text-text-3")}>total {total}/50</span>
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={tab.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.1 } }} transition={{ duration: 0.18 }}>
          <MediaGrid
            slot={tab.slot}
            rules={{ ...tab.rules, max: Math.min(tab.rules.max, 50 - (total - counts.find((c) => c.id === tab.id)!.n)) }}
            empty={{ icons: [tab.icon], ...tab.empty }}
            compact
          />
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

export const ICONS = { Smile, Shirt, Box, Images, Video, AudioLines }
