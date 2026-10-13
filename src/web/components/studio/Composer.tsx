import { AnimatePresence, LayoutGroup, motion } from "motion/react"
import { ChevronDown, Clapperboard, ImagePlus, Lock, Minus, Music2, Plus, Sparkles, Volume2, VolumeX, X } from "lucide-react"
import { useEffect, useMemo, useRef, useState, type DragEvent } from "react"
import { Eyebrow, GlassCard } from "@/components/Glass"
import { ASPECTS, CINEMA_CONTROLS, MODES, type ModeDef } from "@/lib/modes"
import { cn } from "@/lib/utils"

const spring = { type: "spring", stiffness: 460, damping: 36 } as const
const ease = [0.16, 1, 0.3, 1] as const

type LocalRef = { id: string; url: string; name: string }

export function ModeTabs({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  return (
    <LayoutGroup id="modes">
      <div className="glass-2 no-scrollbar -mx-1 flex max-w-full gap-1 overflow-x-auto rounded-full p-1">
        {MODES.map((m) => {
          const active = m.id === value
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onChange(m.id)}
              className={cn(
                "relative shrink-0 rounded-full px-4 py-2.5 text-sm transition-colors duration-200",
                active ? "text-invert-ink" : "text-text-2 hover:text-text",
              )}
            >
              {active && (
                <motion.span layoutId="mode-pill" transition={spring} className="absolute inset-0 rounded-full bg-invert shadow-[var(--shadow-sm)]" />
              )}
              <span className="relative whitespace-nowrap">{m.label}</span>
            </button>
          )
        })}
      </div>
    </LayoutGroup>
  )
}

function Segmented({ options, value, onChange, id }: { options: string[]; value: string; onChange: (v: string) => void; id: string }) {
  return (
    <div className="flex gap-1 rounded-full bg-surface p-1">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          className={cn("relative flex-1 rounded-full px-3 py-2 text-sm tabular transition-colors", o === value ? "text-invert-ink" : "text-text-2 hover:text-text")}
        >
          {o === value && <motion.span layoutId={`seg-${id}`} transition={spring} className="absolute inset-0 rounded-full bg-invert" />}
          <span className="relative">{o}</span>
        </button>
      ))}
    </div>
  )
}

function Field({ label, hint, children, className }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0 rounded-[22px] border border-line bg-surface p-4", className)}>
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-text-3">{label}</span>
        {hint && <span className="text-xs text-text-3">{hint}</span>}
      </div>
      {children}
    </div>
  )
}

function ModelPicker({ mode, model, onChange }: { mode: ModeDef; model: string; onChange: (m: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    document.addEventListener("pointerdown", close)
    return () => document.removeEventListener("pointerdown", close)
  }, [open])
  const current = mode.models.find((m) => m.name === model) ?? mode.models[0]
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="glass-2 flex h-11 items-center gap-2.5 rounded-full pr-3 pl-1.5 text-sm text-text"
      >
        <span className="grid size-8 place-items-center rounded-full bg-accent text-accent-ink">
          <Clapperboard className="size-4" strokeWidth={2} />
        </span>
        <span className="font-semibold">{current.name}</span>
        <ChevronDown className={cn("size-4 text-text-3 transition-transform duration-200", open && "rotate-180")} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.ul
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, transition: { duration: 0.12 } }}
            transition={{ duration: 0.24, ease }}
            className="glass absolute top-[calc(100%+8px)] left-0 z-30 min-w-[240px] rounded-[22px] p-1.5"
          >
            {mode.models.map((m) => (
              <li key={m.name}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(m.name)
                    setOpen(false)
                  }}
                  className={cn(
                    "flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-left text-sm transition-colors",
                    m.name === current.name ? "bg-surface-2 text-text" : "text-text-2 hover:bg-surface hover:text-text",
                  )}
                >
                  {m.name}
                  <span className="rounded-full border border-line-2 px-2 py-0.5 text-[10px] uppercase tracking-wider text-text-3">
                    {m.tier === 1 ? "principal" : "mais modelos"}
                  </span>
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  )
}

function AspectGlyph({ w, h, active }: { w: number; h: number; active: boolean }) {
  const scale = 18 / Math.max(w, h)
  return (
    <span
      className={cn("block rounded-[3px] border-[1.5px] transition-colors", active ? "border-invert-ink" : "border-text-3")}
      style={{ width: w * scale, height: h * scale }}
    />
  )
}

export function Composer({ modeId }: { modeId: string }) {
  const mode = MODES.find((m) => m.id === modeId) ?? MODES[0]
  const [modelChoice, setModel] = useState(mode.models[0].name)
  const [prompt, setPrompt] = useState("")
  const [duration, setDuration] = useState(5)
  const [resolutionChoice, setResolution] = useState("720p")
  const [aspect, setAspect] = useState("16:9")
  const [audio, setAudio] = useState(false)
  const [takes, setTakes] = useState(1)
  const [refs, setRefs] = useState<LocalRef[]>([])
  const [dragging, setDragging] = useState(false)
  const [nudge, setNudge] = useState(false)

  // Troca de modo: se o modelo/resolução escolhidos não existem no modo novo, cai no padrão dele.
  const model = mode.models.some((m) => m.name === modelChoice) ? modelChoice : mode.models[0].name
  const resolution = mode.resolutions.includes(resolutionChoice)
    ? resolutionChoice
    : mode.resolutions[Math.min(1, mode.resolutions.length - 1)]

  useEffect(() => () => refs.forEach((r) => URL.revokeObjectURL(r.url)), [refs])

  const imageLimit = mode.refs.find((r) => r.kind === "imagem")?.max ?? 0

  function addFiles(files: FileList | File[]) {
    const imgs = Array.from(files).filter((f) => /^image\/(jpeg|png|webp|gif)$/.test(f.type))
    setRefs((cur) =>
      [...cur, ...imgs.map((f) => ({ id: crypto.randomUUID(), url: URL.createObjectURL(f), name: f.name }))].slice(0, imageLimit),
    )
  }

  // Ctrl+V de imagem e Ctrl/Cmd+Enter (que por enquanto só mostra o aviso da fase 2).
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (!imageLimit) return
      const files = Array.from(e.clipboardData?.files ?? [])
      if (files.length) addFiles(files)
    }
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") tryGenerate()
    }
    window.addEventListener("paste", onPaste)
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("paste", onPaste)
      window.removeEventListener("keydown", onKey)
    }
  })

  function tryGenerate() {
    setNudge(true)
    window.setTimeout(() => setNudge(false), 2600)
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setDragging(false)
    addFiles(e.dataTransfer.files)
  }

  const summary = useMemo(() => {
    const parts = [model]
    if (mode.duration) parts.push(`${duration}s`)
    parts.push(resolution)
    if (mode.aspect) parts.push(aspect)
    if (mode.audio) parts.push(audio ? "com áudio" : "sem áudio")
    return parts.join(" · ")
  }, [model, mode, duration, resolution, aspect, audio])

  return (
    <GlassCard delay={0.08} className="flex flex-col gap-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <ModelPicker mode={mode} model={model} onChange={setModel} />
        <div className="ml-auto flex items-center gap-1 rounded-full bg-surface p-1">
          <button type="button" aria-label="Menos takes" onClick={() => setTakes((t) => Math.max(1, t - 1))} className="grid size-9 place-items-center rounded-full text-text-2 hover:bg-surface-2 hover:text-text">
            <Minus className="size-4" />
          </button>
          <span className="min-w-[72px] text-center text-sm text-text tabular">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span key={takes} initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -10, opacity: 0 }} transition={{ duration: 0.2 }} className="inline-block font-semibold">
                {takes}
              </motion.span>
            </AnimatePresence>{" "}
            {takes === 1 ? "take" : "takes"}
          </span>
          <button type="button" aria-label="Mais takes" onClick={() => setTakes((t) => Math.min(4, t + 1))} className="grid size-9 place-items-center rounded-full text-text-2 hover:bg-surface-2 hover:text-text">
            <Plus className="size-4" />
          </button>
        </div>
      </div>

      {/* Prompt */}
      <div className="group relative flex flex-1 flex-col rounded-[24px] border border-line bg-surface transition-colors focus-within:border-line-2 focus-within:bg-surface-2">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={mode.placeholder}
          rows={4}
          className="block min-h-[170px] w-full flex-1 resize-none bg-transparent px-5 pt-5 pb-12 text-lg leading-relaxed text-text outline-none placeholder:text-text-3 sm:text-xl"
        />
        <div className="pointer-events-none absolute right-5 bottom-4 left-5 flex items-center justify-between text-xs text-text-3">
          <span className="tabular">{prompt.length.toLocaleString("pt-BR")} caracteres</span>
          <span className="hidden sm:inline">↑ ↓ histórico de prompts</span>
        </div>
      </div>

      {/* Referências */}
      <AnimatePresence initial={false}>
        {mode.refs.length > 0 && (
          <motion.div
            key="refs"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.35, ease }}
            className="overflow-hidden"
          >
            <div
              onDragOver={(e) => {
                e.preventDefault()
                setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={cn(
                "flex flex-wrap items-stretch gap-2 rounded-[24px] border border-dashed p-2 transition-colors",
                dragging ? "border-accent bg-accent/10" : "border-line-2",
              )}
            >
              <label className="flex min-h-[88px] min-w-[200px] flex-1 cursor-pointer items-center gap-3 rounded-[18px] px-4 text-sm text-text-2 transition-colors hover:bg-surface">
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-surface-2 text-text">
                  <ImagePlus className="size-5" strokeWidth={1.8} />
                </span>
                <span>
                  <span className="block text-text">Arraste, cole ou escolha</span>
                  <span className="text-xs text-text-3">jpeg, png, webp, gif, mp4, wav · prévia local</span>
                </span>
                <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple className="sr-only" onChange={(e) => e.target.files && addFiles(e.target.files)} />
              </label>
              <AnimatePresence>
                {refs.map((r, i) => (
                  <motion.figure
                    key={r.id}
                    layout
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={spring}
                    className="group/ref relative size-[88px] overflow-hidden rounded-[18px]"
                  >
                    <img src={r.url} alt={r.name} className="size-full object-cover" />
                    <span className="absolute bottom-1.5 left-1.5 rounded-full bg-black/55 px-2 py-0.5 text-[10px] text-white backdrop-blur">image_{i + 1}</span>
                    <button
                      type="button"
                      aria-label="Remover referência"
                      onClick={() => setRefs((cur) => cur.filter((x) => x.id !== r.id))}
                      className="absolute top-1.5 right-1.5 grid size-6 place-items-center rounded-full bg-black/55 text-white opacity-0 backdrop-blur transition-opacity group-hover/ref:opacity-100"
                    >
                      <X className="size-3.5" />
                    </button>
                  </motion.figure>
                ))}
              </AnimatePresence>
              <div className="flex flex-col justify-center gap-1.5 px-3">
                {mode.refs.map((l) => (
                  <span key={l.kind + l.label} className="flex items-center gap-2 text-xs text-text-2 tabular">
                    {l.kind === "áudio" ? <Music2 className="size-3.5 text-text-3" /> : null}
                    <span className="font-semibold text-text">
                      {l.kind === "imagem" ? refs.length : 0}/{l.max}
                    </span>
                    {l.label}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Parâmetros */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[1.2fr_1fr_1.4fr_auto]">
        {mode.duration ? (
          <Field label="Duração" hint="4–30 s">
            <div className="flex items-center gap-4">
              <span className="w-[58px] font-condensed text-4xl leading-none text-text tabular">
                {duration}
                <span className="text-lg text-text-3">s</span>
              </span>
              <input
                type="range"
                min={4}
                max={30}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                aria-label="Duração em segundos"
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full accent-[var(--accent)]"
                style={{ background: `linear-gradient(90deg, var(--accent) ${((duration - 4) / 26) * 100}%, var(--line-2) 0)` }}
              />
            </div>
          </Field>
        ) : (
          <Field label="Duração">
            <p className="py-2 text-sm text-text-2">Segue o vídeo de origem</p>
          </Field>
        )}

        <Field label="Resolução">
          <Segmented id="res" options={mode.resolutions} value={resolution} onChange={setResolution} />
        </Field>

        {mode.aspect ? (
          <Field label="Proporção" className="sm:col-span-2 xl:col-span-1">
            <div className="no-scrollbar flex gap-1 overflow-x-auto rounded-full bg-surface p-1">
              {ASPECTS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setAspect(a.id)}
                  className={cn("relative flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-xs tabular transition-colors", aspect === a.id ? "text-invert-ink" : "text-text-2 hover:text-text")}
                >
                  {aspect === a.id && <motion.span layoutId="seg-aspect" transition={spring} className="absolute inset-0 rounded-full bg-invert" />}
                  <span className="relative grid size-5 place-items-center">
                    <AspectGlyph w={a.w} h={a.h} active={aspect === a.id} />
                  </span>
                  <span className="relative">{a.id}</span>
                </button>
              ))}
            </div>
          </Field>
        ) : (
          <Field label="Proporção" className="sm:col-span-2 xl:col-span-1">
            <p className="py-2 text-sm text-text-2">Segue a mídia de origem</p>
          </Field>
        )}

        <Field label="Áudio">
          <button
            type="button"
            role="switch"
            aria-checked={audio}
            disabled={!mode.audio}
            onClick={() => setAudio((v) => !v)}
            className={cn("relative flex h-10 w-[76px] items-center rounded-full p-1 transition-colors disabled:opacity-40", audio ? "bg-accent" : "bg-surface-2")}
          >
            <motion.span layout transition={spring} className={cn("grid size-8 place-items-center rounded-full shadow-[var(--shadow-sm)]", audio ? "ml-auto bg-accent-ink text-accent" : "bg-invert text-invert-ink")}>
              {audio ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
            </motion.span>
          </button>
        </Field>
      </div>

      {/* Cinema Studio: controles fechados, "automático" pré-selecionado */}
      <AnimatePresence initial={false}>
        {mode.id === "cinema" && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.35, ease }} className="overflow-hidden">
            <div className="flex flex-wrap gap-2">
              {CINEMA_CONTROLS.map((c) => (
                <span key={c} className="flex items-center gap-2 rounded-full border border-line-2 py-1.5 pr-3 pl-1.5 text-sm text-text-2">
                  <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs text-text">{c}</span>
                  automático
                </span>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rodapé: custo + gerar */}
      <div className="flex flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <Eyebrow>Estimativa</Eyebrow>
          <p className="mt-1 flex items-baseline gap-2">
            <span className="font-condensed text-3xl leading-none text-text">—</span>
            <span className="truncate text-sm text-text-3">
              {takes > 1 ? `× ${takes} takes · ` : ""}custo ao vivo na fase 2
            </span>
          </p>
          <p className="mt-1.5 truncate text-xs text-text-3">{summary}</p>
        </div>
        <div className="relative flex items-center gap-2">
          <AnimatePresence>
            {nudge && (
              <motion.span
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                className="glass absolute right-0 bottom-[calc(100%+10px)] flex items-center gap-2 rounded-full px-3 py-1.5 text-xs whitespace-nowrap text-text"
              >
                <Lock className="size-3.5" /> A geração entra na fase 2 — nada foi enviado.
              </motion.span>
            )}
          </AnimatePresence>
          <motion.button
            type="button"
            onClick={tryGenerate}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            transition={spring}
            className="group relative flex h-14 flex-1 items-center justify-center gap-3 overflow-hidden rounded-full bg-accent pr-2 pl-6 text-base font-semibold text-accent-ink shadow-[0_18px_40px_-14px_rgb(var(--accent-glow)/0.7)] sm:flex-none"
          >
            <span className="pointer-events-none absolute inset-0 -translate-x-full bg-[linear-gradient(110deg,transparent_30%,rgb(255_255_255/0.35)_50%,transparent_70%)] transition-transform duration-700 ease-out group-hover:translate-x-full" />
            <Sparkles className="size-5" strokeWidth={2} />
            Gerar {takes > 1 ? `${takes} takes` : ""}
            <kbd className="ml-2 rounded-full bg-black/15 px-3 py-2 font-sans text-xs font-medium">Ctrl ↵</kbd>
          </motion.button>
        </div>
      </div>
      <div className="sr-only" aria-live="polite">
        {nudge ? "A geração entra na fase 2. Nada foi enviado." : ""}
      </div>
    </GlassCard>
  )
}
