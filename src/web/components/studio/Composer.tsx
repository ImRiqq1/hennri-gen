import { AnimatePresence, LayoutGroup, motion } from "motion/react"
import { ChevronDown, Clapperboard, Images, Loader2, Minus, Plus, Sparkles, Volume2, VolumeX } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { GlassCard } from "@/components/Glass"
import { MediaInputs, pasteTargetFor, slotsFor } from "@/components/studio/MediaInputs"
import { useToast } from "@/components/Toaster"
import { lastActiveZone } from "@/components/upload/Media"
import { ConfirmCost, EstimatePanel, guardFor, useEstimate } from "@/components/studio/Estimate"
import type { Stats } from "@/lib/api"
import { submitJobs } from "@/lib/jobs"
import { templateVars, type Preset, type Project, type Settings } from "@/lib/studio"
import { PresetPicker, ProjectPicker, SavePresetDialog, VarsDialog } from "@/components/studio/PresetDialogs"
import { takePrefill } from "@/lib/reuse"
import { addFiles, kindOf, useMediaState } from "@/lib/media"
import type { EstimateInput } from "@shared/pricing"
import { ASPECTS, CINEMA_CONTROLS, MODES, type ModeDef } from "@/lib/modes"
import { specFor } from "@shared/models"
import { EVENTS, isTyping, MOD, overlayOpen } from "@/lib/shortcuts"
import { cn } from "@/lib/utils"

const spring = { type: "spring", stiffness: 460, damping: 36 } as const
const ease = [0.16, 1, 0.3, 1] as const

export function ModeTabs({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  return (
    <LayoutGroup id="modes">
      <div className="glass-2 no-scrollbar -mx-1 flex max-w-full gap-1 overflow-x-auto rounded-full p-1">
        {MODES.map((m, i) => {
          const active = m.id === value
          return (
            <button
              key={m.id}
              type="button"
              ref={active ? (el) => el?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" }) : undefined}
              onClick={() => onChange(m.id)}
              className={cn(
                "relative shrink-0 rounded-full px-4 py-2.5 text-sm transition-colors duration-200",
                active ? "text-invert-ink" : "text-text-2 hover:text-text",
              )}
            >
              {active && (
                <motion.span layoutId="mode-pill" transition={spring} className="absolute inset-0 rounded-full bg-invert shadow-[var(--shadow-sm)]" />
              )}
              <span className="relative flex items-center gap-2 whitespace-nowrap">
                {m.label}
                <span className={cn("hidden font-mono text-[11px] lg:inline", active ? "text-invert-ink/50" : "text-text-3")}>{i + 1}</span>
              </span>
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
    <div className={cn("min-w-0 rounded-[18px] border border-line bg-surface px-3.5 py-3", className)}>
      <div className="mb-2 flex items-baseline justify-between gap-2">
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
                  <span className="flex flex-col">
                    {m.name}
                    {m.note && <span className="text-[11px] text-text-3">{m.note}</span>}
                  </span>
                  <span className="rounded-full border border-line-2 px-2 py-0.5 text-[11px] uppercase tracking-wider text-text-3">
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

/** Sub-modos do Genjutsu como abas (no lugar do seletor de modelo). */
function GenjutsuTabs({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const subs = MODES.find((m) => m.id === "genjutsu")!.models.map((m) => m.name)
  return (
    <div role="tablist" aria-label="Modo do Genjutsu" className="flex gap-1 rounded-full bg-surface p-1">
      {subs.map((s) => (
        <button
          key={s}
          type="button"
          role="tab"
          aria-selected={s === value}
          onClick={() => onChange(s)}
          className={cn("relative rounded-full px-3.5 py-2 text-sm transition-colors", s === value ? "text-invert-ink" : "text-text-2 hover:text-text")}
        >
          {s === value && <motion.span layoutId="genjutsu-sub" transition={spring} className="absolute inset-0 rounded-full bg-invert" />}
          <span className="relative whitespace-nowrap">{s}</span>
        </button>
      ))}
    </div>
  )
}

function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={cn("relative flex h-6 w-10 items-center rounded-full p-0.5 transition-colors", on ? "bg-accent" : "bg-surface-2")}
    >
      <motion.span layout transition={spring} className={cn("size-5 rounded-full shadow-[var(--shadow-sm)]", on ? "ml-auto bg-accent-ink" : "bg-invert")} />
    </button>
  )
}

export function Composer({
  modeId,
  spend,
  settings,
  projects,
  presets,
}: {
  modeId: string
  spend: Stats["spend"] | null
  /** padrões (Config) — o Criar só monta o Composer depois de carregar */
  settings: Settings
  projects: Project[]
  presets: Preset[]
}) {
  const mode = MODES.find((m) => m.id === modeId) ?? MODES[0]
  // "Refazer editando" / "Continuar cena" da Galeria deixam o pedido pronto (vale uma vez)
  const [prefill] = useState(() => takePrefill(modeId))
  const [modelChoice, setModel] = useState(prefill?.model ?? mode.models[0].name)
  const [prompt, setPrompt] = useState(prefill?.prompt ?? "")
  const [promptOn, setPromptOn] = useState(false)
  const [preset, setPreset] = useState<{ id: string; name: string } | null>(prefill?.presetId ? { id: prefill.presetId, name: "estilo anterior" } : null)
  const [duration, setDuration] = useState(prefill?.duration ?? settings.padrao_duracao)
  const [resolutionChoice, setResolution] = useState(prefill?.resolution ?? settings.padrao_resolucao)
  const [aspect, setAspect] = useState(prefill?.aspect ?? settings.padrao_proporcao)
  const [audio, setAudio] = useState(prefill?.audio ?? settings.padrao_audio)
  const [projectId, setProjectId] = useState(prefill?.projectId ?? "sem-projeto")
  const [templateId, setTemplateId] = useState<string | undefined>(prefill?.templateId)
  const [varsFor, setVarsFor] = useState<Preset | null>(null)
  const [saveOpen, setSaveOpen] = useState(0)
  const [takes, setTakes] = useState(1)
  const toast = useToast()
  const promptRef = useRef<HTMLTextAreaElement>(null)

  // Troca de modo: se o modelo/resolução escolhidos não existem no modo novo, cai no padrão dele.
  const model = mode.models.some((m) => m.name === modelChoice) ? modelChoice : mode.models[0].name
  // Limites do MODELO escolhido (src/shared/models.ts): duração, resoluções, proporções, áudio.
  const spec = specFor(mode.id, model)
  const ui = {
    duration: spec ? spec.duration : null,
    resolutions: spec?.resolutions ?? mode.resolutions,
    aspects: spec ? spec.aspects : null,
    aspect: !!spec?.aspects,
    audio: !!spec?.audio,
  }
  const resolution = ui.resolutions.includes(resolutionChoice) ? resolutionChoice : ui.resolutions[Math.min(1, ui.resolutions.length - 1)]
  const durMin = ui.duration?.min ?? 4
  const durMax = ui.duration?.max ?? 30
  const durationEff = Math.min(durMax, Math.max(durMin, duration))
  const aspectEff = ui.aspects && !ui.aspects.includes(aspect) ? ui.aspects[0] : aspect
  const isGenjutsu = mode.id === "genjutsu"
  // No Genjutsu o prompt é opcional e fica atrás de um interruptor (igual ao Higgsfield).
  const showPrompt = !isGenjutsu || promptOn

  // Ctrl+V de arquivo e atalhos da tela Criar (ver src/web/lib/shortcuts.ts).
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.files ?? [])
      if (!files.length) return
      e.preventDefault()
      for (const file of files) {
        const kind = kindOf(file)
        if (!kind) {
          toast({ title: "Arquivo recusado", detail: `${file.name || "colado"}: formato não aceito`, tone: "error" })
          continue
        }
        const zone = lastActiveZone()
        const target =
          zone && zone.key.startsWith(`${mode.id}:`) && zone.rules.kinds.includes(kind) ? zone : pasteTargetFor(mode.id, model, kind)
        if (!target) {
          toast({ title: `${mode.label} não usa ${kind === "image" ? "imagem" : kind === "video" ? "vídeo" : "áudio"}`, tone: "error" })
          continue
        }
        void addFiles(target.key, [file], target.rules).then((refused) =>
          refused.forEach((r) => toast({ title: "Arquivo recusado", detail: r, tone: "error" })),
        )
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && !overlayOpen()) {
        e.preventDefault()
        tryGenerate()
        return
      }
      if (e.altKey && !e.ctrlKey && !e.metaKey && !overlayOpen() && ui.duration && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
        e.preventDefault()
        setDuration((d) => Math.min(durMax, Math.max(durMin, Math.min(durMax, Math.max(durMin, d)) + (e.key === "ArrowRight" ? 1 : -1))))
        return
      }
      if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e) || overlayOpen()) return
      if (e.key === "/") {
        e.preventDefault()
        if (isGenjutsu) setPromptOn(true)
        window.setTimeout(() => promptRef.current?.focus(), 0)
      } else if (e.key === "-" || e.key === "_") {
        setTakes((t) => Math.max(1, t - 1))
      } else if (e.key === "+" || e.key === "=") {
        setTakes((t) => Math.min(4, t + 1))
      }
    }
    const onFocus = () => {
      if (isGenjutsu) setPromptOn(true)
      window.setTimeout(() => promptRef.current?.focus(), 0)
    }
    window.addEventListener("paste", onPaste)
    window.addEventListener("keydown", onKey)
    window.addEventListener(EVENTS.focusPrompt, onFocus)
    return () => {
      window.removeEventListener("paste", onPaste)
      window.removeEventListener("keydown", onKey)
      window.removeEventListener(EVENTS.focusPrompt, onFocus)
    }
  })

  // Durações que entram no preço: vídeo de origem (Genjutsu/Editar/Estender) e vídeos de referência.
  const mediaState = useMediaState()
  const okItems = (key: string) => (mediaState[key] ?? []).filter((it) => it.status !== "error")
  const sourceVideoSec = ["genjutsu", "edit", "extend"].includes(mode.id) ? okItems(`${mode.id}:video`)[0]?.meta.duration : undefined
  const refVideoSec =
    mode.id === "ref" || mode.id === "cinema"
      ? okItems(`${mode.id}:vid`).reduce((a, it) => a + (it.meta.duration ?? 0), 0)
      : undefined

  const estimateInput: EstimateInput = {
    modeId: mode.id,
    model,
    resolution,
    duration: ui.duration ? durationEff : 5,
    aspect: aspectEff,
    audio: ui.audio && audio,
    takes,
    ...(sourceVideoSec ? { sourceVideoSec: Math.round(sourceVideoSec * 10) / 10 } : {}),
    ...(refVideoSec ? { refVideoSec: Math.round(refVideoSec * 10) / 10 } : {}),
    ...(isGenjutsu && model === "Restyle" && preset ? { presetId: preset.id } : {}),
  }
  const est = useEstimate(estimateInput)
  const guard = guardFor(est.result?.total ?? null, spend)
  const [confirming, setConfirming] = useState(false)

  const [sending, setSending] = useState(false)

  function tryGenerate() {
    if (sending) return
    if (guard.overDay) {
      toast({ title: "Limite diário", detail: `Restam US$ ${(guard.remainingDay ?? 0).toFixed(2).replace(".", ",")} hoje.`, tone: "error" })
      return
    }
    if (guard.needsConfirm) {
      setConfirming(true)
      return
    }
    void send(false)
  }

  /** Junta as URLs já enviadas de cada zona do modo e manda pro Worker criar os jobs. */
  async function send(confirmed: boolean) {
    setConfirming(false)
    const slots = slotsFor(mode.id, model)
    const media: Record<string, { url: string; durationSec?: number }[]> = {}
    for (const { key } of slots) {
      const items = (mediaState[key] ?? []).filter((it) => it.status !== "error")
      if (items.some((it) => it.status !== "done")) {
        toast({ title: "Espere o envio terminar", detail: "Ainda tem referência subindo.", tone: "error" })
        return
      }
      if (items.length) media[key] = items.map((it) => ({ url: it.publicUrl!, ...(it.meta.duration ? { durationSec: it.meta.duration } : {}) }))
    }
    setSending(true)
    const res = await submitJobs({ ...estimateInput, prompt, media, confirmed, projectId, templateId })
    setSending(false)
    if (res.ok) {
      toast({
        title: res.jobs.length > 1 ? `${res.jobs.length} jobs enviados` : "Job enviado",
        detail: `${model} · ${summary.split(" · ").slice(1).join(" · ")}`,
        tone: "success",
      })
    } else if (res.needsConfirm) {
      setConfirming(true)
    } else {
      toast({ title: "Não enviado", detail: res.error, tone: "error" })
    }
  }

  const summary = (() => {
    const parts = [model]
    if (isGenjutsu && model === "Restyle") parts.push(preset ? preset.name : "sem estilo")
    if (ui.duration) parts.push(`${durationEff}s`)
    parts.push(resolution)
    if (ui.aspect) parts.push(aspectEff)
    if (ui.audio) parts.push(audio ? "com áudio" : "sem áudio")
    return parts.join(" · ")
  })()

  /** Aplica um preset: modelo, parâmetros e prompt base (pedindo as {{variáveis}} se houver). */
  function applyPreset(p: Preset, filledPrompt?: string) {
    if (templateVars(p.prompt_template).length && filledPrompt === undefined) {
      setVarsFor(p)
      return
    }
    setVarsFor(null)
    setModel(p.model_id)
    if (p.params.resolution) setResolution(p.params.resolution)
    if (p.params.duration) setDuration(p.params.duration)
    if (p.params.aspect) setAspect(p.params.aspect)
    if (typeof p.params.audio === "boolean") setAudio(p.params.audio)
    if (p.prompt_template !== null) setPrompt(filledPrompt ?? p.prompt_template)
    if (p.project_id) setProjectId(p.project_id)
    setTemplateId(p.id)
    toast({ title: "Preset aplicado", detail: p.name })
  }

  const promptBox = (
    <div className="group relative flex flex-1 flex-col rounded-[20px] border border-line bg-surface transition-colors focus-within:border-line-2 focus-within:bg-surface-2">
      <textarea
        ref={promptRef}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder={mode.placeholder}
        aria-label="Prompt"
        rows={isGenjutsu ? 2 : 4}
        className={cn(
          "block w-full flex-1 resize-none bg-transparent px-4 pt-3.5 pb-9 text-[16px] leading-relaxed text-text outline-none placeholder:text-text-3 sm:text-[17px]",
          isGenjutsu ? "min-h-[84px]" : "min-h-[116px]",
        )}
      />
      <div className="pointer-events-none absolute right-4 bottom-3 left-4 flex items-center justify-between text-xs text-text-3">
        <span className="tabular">{prompt.length.toLocaleString("pt-BR")} caracteres</span>
        <span className="hidden items-center gap-1.5 sm:flex">
          <span className="kbd">/</span> focar · <span className="kbd">Esc</span> sair
        </span>
      </div>
    </div>
  )

  const media = slotsFor(mode.id, model).length > 0 && (
    <div className="flex flex-col gap-2">
      <MediaInputs modeId={mode.id} model={model} presetId={preset?.id ?? null} onPreset={(id, name) => setPreset({ id, name })} />
      <div className="flex items-center justify-between gap-2 text-xs text-text-3">
        <span>Arraste, clique ou cole com {MOD}+V</span>
        <button
          type="button"
          aria-disabled="true"
          title="Escolher da Galeria — chega na fase 3"
          className="flex cursor-not-allowed items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-text-3"
        >
          <Images className="size-3.5" /> Da galeria
        </button>
      </div>
    </div>
  )

  return (
    <GlassCard delay={0.08} className="flex flex-col gap-3.5 p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-3">
        {isGenjutsu ? <GenjutsuTabs value={model} onChange={setModel} /> : <ModelPicker mode={mode} model={model} onChange={setModel} />}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <ProjectPicker projects={projects} value={projectId} onChange={setProjectId} />
          <PresetPicker presets={presets} modeId={mode.id} onPick={(p) => applyPreset(p)} onSave={() => setSaveOpen((n) => n + 1)} />
        </div>
        <div className="flex items-center gap-1 rounded-full bg-surface p-1">
          <button type="button" aria-label="Menos takes" onClick={() => setTakes((t) => Math.max(1, t - 1))} className="grid size-9 place-items-center rounded-full text-text-2 hover:bg-surface-2 hover:text-text">
            <Minus className="size-4" />
          </button>
          <span className="min-w-[72px] text-center text-sm text-text tabular" aria-live="polite">
            <span className="font-semibold">{takes}</span> {takes === 1 ? "take" : "takes"}
          </span>
          <button type="button" aria-label="Mais takes" onClick={() => setTakes((t) => Math.min(4, t + 1))} className="grid size-9 place-items-center rounded-full text-text-2 hover:bg-surface-2 hover:text-text">
            <Plus className="size-4" />
          </button>
        </div>
      </div>

      {isGenjutsu ? (
        <>
          {media}
          <div className="flex items-center justify-between rounded-[16px] border border-line bg-surface px-3.5 py-2.5">
            <span className="text-sm text-text">
              Prompt <span className="text-text-3">· opcional</span>
            </span>
            <Switch on={promptOn} onChange={setPromptOn} label="Usar prompt" />
          </div>
          <AnimatePresence initial={false}>
            {showPrompt && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.22, ease }} className="overflow-hidden">
                {promptBox}
              </motion.div>
            )}
          </AnimatePresence>
        </>
      ) : (
        <>
          {promptBox}
          {media}
        </>
      )}

      {/* Parâmetros: só os que o modo usa, numa linha que quebra conforme a largura */}
      <div className="flex flex-wrap gap-2.5">
        {ui.duration && (
          <Field label="Duração" hint={`Alt ← →  ·  ${durMin}–${durMax} s`} className="min-w-[230px] flex-[1.2]">
            <div className="flex items-center gap-3">
              <span className="display-num w-[44px] text-metric-sm text-text">
                {durationEff}
                <span className="text-base text-text-3">s</span>
              </span>
              <input
                type="range"
                min={durMin}
                max={durMax}
                value={durationEff}
                onChange={(e) => setDuration(Number(e.target.value))}
                aria-label="Duração em segundos"
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full accent-[var(--accent)]"
                style={{ background: `linear-gradient(90deg, var(--accent) ${((durationEff - durMin) / (durMax - durMin)) * 100}%, var(--line-2) 0)` }}
              />
            </div>
          </Field>
        )}

        <Field label="Resolução" className={cn("min-w-[200px] flex-1", !ui.duration && !ui.aspect && "max-w-[380px]")}>
          <Segmented id="res" options={ui.resolutions} value={resolution} onChange={setResolution} />
        </Field>

        {ui.aspect && (
          <Field label="Proporção" className="min-w-[280px] flex-[1.6]">
            <div className="no-scrollbar flex gap-1 overflow-x-auto rounded-full bg-surface p-1">
              {ASPECTS.filter((a) => ui.aspects?.includes(a.id)).map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setAspect(a.id)}
                  aria-pressed={aspectEff === a.id}
                  className={cn("relative flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs tabular transition-colors", aspectEff === a.id ? "text-invert-ink" : "text-text-2 hover:text-text")}
                >
                  {aspectEff === a.id && <motion.span layoutId="seg-aspect" transition={spring} className="absolute inset-0 rounded-full bg-invert" />}
                  <span className="relative grid size-5 place-items-center">
                    <AspectGlyph w={a.w} h={a.h} active={aspectEff === a.id} />
                  </span>
                  <span className="relative">{a.id}</span>
                </button>
              ))}
            </div>
          </Field>
        )}

        {ui.audio && (
          <Field label="Áudio" className="flex-none">
            <button
              type="button"
              role="switch"
              aria-checked={audio}
              aria-label="Gerar áudio"
              onClick={() => setAudio((v) => !v)}
              className={cn("relative flex h-9 w-[68px] items-center rounded-full p-1 transition-colors", audio ? "bg-accent" : "bg-surface-2")}
            >
              <motion.span layout transition={spring} className={cn("grid size-7 place-items-center rounded-full shadow-[var(--shadow-sm)]", audio ? "ml-auto bg-accent-ink text-accent" : "bg-invert text-invert-ink")}>
                {audio ? <Volume2 className="size-3.5" /> : <VolumeX className="size-3.5" />}
              </motion.span>
            </button>
          </Field>
        )}
      </div>
      {(!ui.duration || !ui.aspect) && (
        <p className="-mt-1 text-xs text-text-3">
          {!ui.duration && !ui.aspect
            ? "Duração e proporção seguem a mídia de origem."
            : !ui.duration
              ? "A duração segue a mídia de origem."
              : "A proporção segue a mídia de origem."}
        </p>
      )}

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

      {/* Rodapé: custo ao vivo + gerar */}
      <div className="flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center">
        <EstimatePanel
          input={estimateInput}
          result={est.result}
          loading={est.loading}
          failed={est.failed}
          guard={guard}
          brlRate={spend?.brlRate ?? null}
          summary={summary}
        />
        <div className="relative flex items-center gap-2">
          <motion.button
            type="button"
            onClick={tryGenerate}
            disabled={sending}
            aria-busy={sending}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            transition={spring}
            className={cn(
              "group relative flex h-12 flex-1 items-center justify-center gap-2.5 overflow-hidden rounded-full pr-1.5 pl-5 text-[15px] font-semibold sm:flex-none",
              guard.overDay || guard.needsConfirm
                ? "bg-danger text-white"
                : "bg-accent text-accent-ink shadow-[0_18px_40px_-14px_rgb(var(--accent-glow)/0.7)]",
            )}
          >
            <span className="pointer-events-none absolute inset-0 -translate-x-full bg-[linear-gradient(110deg,transparent_30%,rgb(255_255_255/0.35)_50%,transparent_70%)] transition-transform duration-700 ease-out group-hover:translate-x-full" />
            {sending ? <Loader2 className="size-5 animate-spin" /> : <Sparkles className="size-5" strokeWidth={2} />}
            {sending ? "Enviando…" : `Gerar${takes > 1 ? ` ${takes} takes` : ""}`}
            <kbd className="ml-2 rounded-full bg-black/15 px-3 py-2 font-mono text-xs font-medium">{MOD} ↵</kbd>
          </motion.button>
        </div>
      </div>
      <VarsDialog key={varsFor?.id ?? "nenhum"} preset={varsFor} onClose={() => setVarsFor(null)} onApply={(text) => varsFor && applyPreset(varsFor, text)} />
      {saveOpen > 0 && (
        <SavePresetDialog
          key={saveOpen}
          open
          projects={projects}
          defaultProject={projectId}
          draft={{
            model_id: model,
            mode: mode.id,
            params: {
              resolution,
              ...(ui.duration ? { duration: durationEff } : {}),
              ...(ui.aspect ? { aspect: aspectEff } : {}),
              ...(ui.audio ? { audio } : {}),
              ...(preset ? { presetId: preset.id } : {}),
            },
            prompt,
          }}
          onClose={() => setSaveOpen(0)}
        />
      )}
      <ConfirmCost open={confirming} total={est.result?.total ?? null} guard={guard} onCancel={() => setConfirming(false)} onConfirm={() => void send(true)} />
    </GlassCard>
  )
}
