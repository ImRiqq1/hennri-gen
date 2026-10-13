import { AnimatePresence, motion } from "motion/react"
import { Check, ChevronDown, FolderPlus, Layers, Loader2 } from "lucide-react"
import { useEffect, useRef, useState, type ReactNode } from "react"
import { useToast } from "@/components/Toaster"
import { api, fillTemplate, notifyStudio, PROJECT_COLORS, templateVars, type Preset, type Project } from "@/lib/studio"
import { useFocusTrap } from "@/lib/useFocusTrap"
import { cn } from "@/lib/utils"

const ease = [0.16, 1, 0.3, 1] as const

export function Modal({ open, onClose, title, label, children }: { open: boolean; onClose: () => void; title: string; label: string; children: ReactNode }) {
  const trap = useFocusTrap<HTMLDivElement>(open)
  useEffect(() => {
    if (!open) return
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", k)
    return () => window.removeEventListener("keydown", k)
  }, [open, onClose])
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[105] grid place-items-center bg-black/45 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.12 } }}
          onPointerDown={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            ref={trap}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.12 } }}
            transition={{ duration: 0.22, ease }}
            className="float max-h-[90dvh] w-full max-w-[520px] overflow-y-auto rounded-[24px] p-6"
          >
            <p className="label">{label}</p>
            <h2 className="display-title mt-2 text-[24px] text-text">{title}</h2>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

const input = "h-10 w-full rounded-[12px] border border-line-2 bg-surface px-3 text-sm text-text outline-none placeholder:text-text-3 focus:border-text-3"

/** Destaca {{variáveis}} num prompt base. */
export function TemplateText({ text, className }: { text: string; className?: string }) {
  const parts = text.split(/(\{\{\s*[\p{L}\w-]+\s*\}\})/u)
  return (
    <p className={cn("whitespace-pre-wrap", className)}>
      {parts.map((p, i) =>
        /^\{\{/.test(p) ? (
          <span key={i} className="rounded-md bg-accent/15 px-1 font-mono text-[0.92em] text-text">
            {p}
          </span>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </p>
  )
}

/** Preenche as {{variáveis}} do preset e devolve o prompt pronto. */
export function VarsDialog({ preset, onClose, onApply }: { preset: Preset | null; onClose: () => void; onApply: (prompt: string) => void }) {
  const vars = templateVars(preset?.prompt_template)
  const [values, setValues] = useState<Record<string, string>>({})
  const filled = preset?.prompt_template ? fillTemplate(preset.prompt_template, values) : ""
  const missing = vars.filter((v) => !values[v]?.trim())
  return (
    <Modal open={!!preset} onClose={onClose} title={preset?.name ?? ""} label="Usar preset">
      <form
        className="mt-4 flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (!missing.length) onApply(filled)
        }}
      >
        {vars.map((v, i) => (
          <label key={v} className="flex flex-col gap-1.5">
            <span className="font-mono text-xs text-text-2">{`{{${v}}}`}</span>
            <input autoFocus={i === 0} className={input} value={values[v] ?? ""} onChange={(e) => setValues((x) => ({ ...x, [v]: e.target.value }))} />
          </label>
        ))}
        <div className="rounded-[14px] bg-surface p-3 text-sm text-text-2">
          <TemplateText text={filled} />
        </div>
        <div className="mt-2 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="glass-2 h-10 rounded-full px-4 text-sm text-text">
            Cancelar
          </button>
          <button type="submit" disabled={missing.length > 0} className="h-10 rounded-full bg-accent px-4 text-sm font-medium text-accent-ink disabled:opacity-40">
            Aplicar no Criar
          </button>
        </div>
      </form>
    </Modal>
  )
}

export type PresetDraft = { model_id: string; mode: string; params: Preset["params"]; prompt: string }

/** Salva o estado atual do Criar como preset (ou edita um existente). */
export function SavePresetDialog({
  open,
  draft,
  editing,
  projects,
  defaultProject,
  onClose,
}: {
  open: boolean
  draft: PresetDraft | null
  editing?: Preset | null
  projects: Project[]
  defaultProject?: string
  onClose: () => void
}) {
  const toast = useToast()
  const [name, setName] = useState(editing?.name ?? "")
  const [project, setProject] = useState<string>(editing?.project_id ?? defaultProject ?? "sem-projeto")
  const [template, setTemplate] = useState(editing?.prompt_template ?? draft?.prompt ?? "")
  const [busy, setBusy] = useState(false)
  const vars = templateVars(template)

  async function save() {
    if (!name.trim()) return
    setBusy(true)
    try {
      if (editing) {
        await api.updatePreset(editing.id, { name: name.trim(), project_id: project, prompt_template: template || null })
      } else if (draft) {
        await api.createPreset({ name: name.trim(), project_id: project, model_id: draft.model_id, mode: draft.mode, params: draft.params, prompt_template: template || null })
      }
      notifyStudio()
      toast({ title: editing ? "Preset atualizado" : "Preset salvo", detail: name.trim(), tone: "success" })
      onClose()
    } catch (e) {
      toast({ title: "Não salvou", detail: (e as Error).message, tone: "error" })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? "Editar preset" : "Salvar como preset"} label="Preset">
      <form
        className="mt-4 flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <label className="flex flex-col gap-1.5">
          <span className="label">Nome</span>
          <input autoFocus className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Ad vertical 9:16 — produto girando" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="label">Projeto</span>
          <select className={input} value={project} onChange={(e) => setProject(e.target.value)}>
            {projects
              .filter((p) => !p.archived)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="label">Prompt base</span>
          <textarea
            className={cn(input, "h-28 resize-none py-2.5 leading-relaxed")}
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            placeholder="Use {{produto}}, {{cor}}… pros trechos que mudam a cada uso"
          />
          <span className="text-xs text-text-3">
            {vars.length ? `Variáveis: ${vars.map((v) => `{{${v}}}`).join(", ")}` : "Dica: escreva {{nome}} pros trechos que mudam a cada uso."}
          </span>
        </label>
        {draft && !editing && (
          <p className="font-mono text-[11px] text-text-3">
            {draft.model_id} · {draft.mode} · {Object.entries(draft.params).filter(([, v]) => v !== null && v !== undefined).map(([k, v]) => `${k}: ${String(v)}`).join(" · ")}
          </p>
        )}
        <div className="mt-2 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="glass-2 h-10 rounded-full px-4 text-sm text-text">
            Cancelar
          </button>
          <button type="submit" disabled={!name.trim() || busy} className="flex h-10 items-center gap-2 rounded-full bg-accent px-4 text-sm font-medium text-accent-ink disabled:opacity-40">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Salvar
          </button>
        </div>
      </form>
    </Modal>
  )
}

/** Pílula com o projeto atual + lista (e criar um novo ali mesmo). */
export function ProjectPicker({ projects, value, onChange }: { projects: Project[]; value: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const ref = useRef<HTMLDivElement>(null)
  const toast = useToast()
  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    document.addEventListener("pointerdown", close)
    return () => document.removeEventListener("pointerdown", close)
  }, [open])
  const current = projects.find((p) => p.id === value) ?? projects[0]
  const active = projects.filter((p) => !p.archived)

  async function create() {
    if (!name.trim()) return
    try {
      const { id } = await api.createProject({ name: name.trim(), color: PROJECT_COLORS[active.length % PROJECT_COLORS.length] })
      notifyStudio()
      onChange(id)
      setName("")
      setOpen(false)
    } catch (e) {
      toast({ title: "Não criou o projeto", detail: (e as Error).message, tone: "error" })
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="glass-2 flex h-9 max-w-[200px] items-center gap-2 rounded-full pr-2.5 pl-3 text-sm text-text"
        title="Projeto (cliente/campanha) deste job"
      >
        <span className="size-2 shrink-0 rounded-full" style={{ background: current?.color ?? "var(--text-3)" }} />
        <span className="truncate">{current?.name ?? "Sem projeto"}</span>
        <ChevronDown className={cn("size-3.5 shrink-0 text-text-3 transition-transform", open && "rotate-180")} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
            transition={{ duration: 0.2, ease }}
            className="float absolute top-[calc(100%+8px)] left-0 z-30 w-[240px] rounded-[18px] p-1.5"
          >
            <ul role="listbox" aria-label="Projetos" className="max-h-[240px] overflow-y-auto">
              {active.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={p.id === value}
                    onClick={() => {
                      onChange(p.id)
                      setOpen(false)
                    }}
                    className={cn("flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-sm", p.id === value ? "bg-surface-2 text-text" : "text-text-2 hover:bg-surface hover:text-text")}
                  >
                    <span className="size-2 shrink-0 rounded-full" style={{ background: p.color ?? "var(--text-3)" }} />
                    <span className="truncate">{p.name}</span>
                    {p.id === value && <Check className="ml-auto size-3.5" />}
                  </button>
                </li>
              ))}
            </ul>
            <form
              className="mt-1 flex items-center gap-1.5 border-t border-line pt-1.5"
              onSubmit={(e) => {
                e.preventDefault()
                void create()
              }}
            >
              <FolderPlus className="ml-2 size-4 shrink-0 text-text-3" />
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Novo projeto…" aria-label="Nome do novo projeto" className="h-8 min-w-0 flex-1 bg-transparent text-sm text-text outline-none placeholder:text-text-3" />
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/** Pílula de presets do modo atual + salvar o estado atual como preset. */
export function PresetPicker({ presets, modeId, onPick, onSave }: { presets: Preset[]; modeId: string; onPick: (p: Preset) => void; onSave: () => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    document.addEventListener("pointerdown", close)
    return () => document.removeEventListener("pointerdown", close)
  }, [open])
  const mine = presets.filter((p) => p.mode === modeId)
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="glass-2 flex h-9 items-center gap-2 rounded-full pr-2.5 pl-3 text-sm text-text-2 hover:text-text"
      >
        <Layers className="size-4" strokeWidth={1.8} />
        Presets{mine.length ? <span className="font-mono text-[11px] text-text-3">{mine.length}</span> : null}
        <ChevronDown className={cn("size-3.5 text-text-3 transition-transform", open && "rotate-180")} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
            transition={{ duration: 0.2, ease }}
            className="float absolute top-[calc(100%+8px)] right-0 z-30 w-[280px] rounded-[18px] p-1.5"
          >
            {mine.length ? (
              <ul className="max-h-[260px] overflow-y-auto">
                {mine.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(false)
                        onPick(p)
                      }}
                      className="flex w-full flex-col rounded-xl px-2.5 py-2 text-left hover:bg-surface"
                    >
                      <span className="flex items-center gap-2 text-sm text-text">
                        {p.project_color && <span className="size-2 rounded-full" style={{ background: p.project_color }} />}
                        <span className="truncate">{p.name}</span>
                      </span>
                      {p.prompt_template && <span className="mt-0.5 line-clamp-1 text-xs text-text-3">{p.prompt_template}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-2.5 py-3 text-sm text-text-3">Nenhum preset deste modo ainda.</p>
            )}
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                onSave()
              }}
              className="mt-1 flex w-full items-center gap-2 rounded-xl border-t border-line px-2.5 py-2.5 text-left text-sm text-text hover:bg-surface"
            >
              <Check className="size-4 text-text-3" /> Salvar o atual como preset
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
