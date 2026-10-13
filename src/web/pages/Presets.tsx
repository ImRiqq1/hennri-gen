import { AnimatePresence, motion } from "motion/react"
import { Archive, ArchiveRestore, Check, FolderPlus, Layers, Pencil, Play, Trash2, X } from "lucide-react"
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Eyebrow, GlassCard } from "@/components/Glass"
import { SavePresetDialog, TemplateText, VarsDialog } from "@/components/studio/PresetDialogs"
import { useToast } from "@/components/Toaster"
import { MODES } from "@/lib/modes"
import { setPrefill } from "@/lib/reuse"
import { api, notifyStudio, PROJECT_COLORS, templateVars, useStudio, type Preset, type Project } from "@/lib/studio"
import { cn } from "@/lib/utils"

const usd = (n: number) => "US$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function ProjectRow({ p }: { p: Project }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(p.name)
  const [picking, setPicking] = useState(false)
  const toast = useToast()
  const isDefault = p.id === "sem-projeto"

  async function patch(data: Partial<Pick<Project, "name" | "color" | "archived">>) {
    try {
      await api.updateProject(p.id, data)
      notifyStudio()
    } catch (e) {
      toast({ title: "Não salvou", detail: (e as Error).message, tone: "error" })
    }
  }

  return (
    <li className={cn("group/row rounded-[16px] border border-line bg-surface p-3", p.archived && "opacity-60")}>
      <div className="flex items-center gap-2.5">
        <div className="relative">
          <button
            type="button"
            disabled={isDefault}
            onClick={() => setPicking((v) => !v)}
            aria-label={`Cor do projeto ${p.name}`}
            className="grid size-6 place-items-center rounded-full disabled:cursor-default"
          >
            <span className="size-3 rounded-full ring-2 ring-[var(--panel)]" style={{ background: p.color ?? "var(--text-3)" }} />
          </button>
          <AnimatePresence>
            {picking && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="float absolute top-8 left-0 z-20 flex gap-1 rounded-full p-1.5"
              >
                {PROJECT_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Cor ${c}`}
                    onClick={() => {
                      setPicking(false)
                      void patch({ color: c })
                    }}
                    className={cn("size-6 rounded-full", p.color === c && "ring-2 ring-text")}
                    style={{ background: c }}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {editing ? (
          <form
            className="flex min-w-0 flex-1 items-center gap-1"
            onSubmit={(e) => {
              e.preventDefault()
              if (name.trim()) void patch({ name: name.trim() })
              setEditing(false)
            }}
          >
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} aria-label="Nome do projeto" className="h-8 min-w-0 flex-1 rounded-lg border border-line-2 bg-surface px-2 text-sm text-text outline-none" />
            <button type="submit" aria-label="Salvar nome" className="grid size-8 place-items-center rounded-full text-text-2 hover:bg-surface-2">
              <Check className="size-4" />
            </button>
            <button type="button" aria-label="Cancelar" onClick={() => (setEditing(false), setName(p.name))} className="grid size-8 place-items-center rounded-full text-text-3 hover:bg-surface-2">
              <X className="size-4" />
            </button>
          </form>
        ) : (
          <>
            <span className="min-w-0 flex-1 truncate text-sm text-text">{p.name}</span>
            {!isDefault && (
              <span className="flex opacity-0 transition-opacity group-hover/row:opacity-100 focus-within:opacity-100">
                <button type="button" aria-label="Renomear" onClick={() => setEditing(true)} className="grid size-8 place-items-center rounded-full text-text-3 hover:bg-surface-2 hover:text-text">
                  <Pencil className="size-3.5" />
                </button>
                <button
                  type="button"
                  aria-label={p.archived ? "Desarquivar" : "Arquivar"}
                  onClick={() => void patch({ archived: !p.archived })}
                  className="grid size-8 place-items-center rounded-full text-text-3 hover:bg-surface-2 hover:text-text"
                >
                  {p.archived ? <ArchiveRestore className="size-3.5" /> : <Archive className="size-3.5" />}
                </button>
              </span>
            )}
          </>
        )}
      </div>
      <p className="mt-1.5 pl-[34px] font-mono text-[11px] text-text-3">
        {p.jobs} {p.jobs === 1 ? "job" : "jobs"} · {usd(p.spent_usd)}
        {p.archived ? " · arquivado" : ""}
      </p>
    </li>
  )
}

function PresetCard({ p, onUse, onEdit, onDelete }: { p: Preset; onUse: () => void; onEdit: () => void; onDelete: () => void }) {
  const mode = MODES.find((m) => m.id === p.mode)
  const vars = templateVars(p.prompt_template)
  const params = [p.params.resolution, p.params.duration ? `${p.params.duration}s` : null, p.params.aspect, p.params.audio === undefined ? null : p.params.audio ? "com áudio" : "sem áudio"].filter(Boolean)
  return (
    <GlassCard interactive className="group flex h-full flex-col p-4">
      <div className="flex items-start gap-2">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 text-text">
          <Layers className="size-4" strokeWidth={1.7} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-text">{p.name}</p>
          <p className="truncate font-mono text-[11px] text-text-3">
            {p.model_id} · {mode?.short ?? p.mode}
          </p>
        </div>
        {p.project_name && (
          <span className="flex max-w-[45%] items-center gap-1.5 rounded-full border border-line-2 px-2 py-0.5 text-[11px] text-text-2">
            <span className="size-1.5 shrink-0 rounded-full" style={{ background: p.project_color ?? "var(--text-3)" }} />
            <span className="truncate">{p.project_name}</span>
          </span>
        )}
      </div>
      {p.prompt_template ? (
        <TemplateText text={p.prompt_template} className="mt-3 line-clamp-3 text-[13px] leading-relaxed text-text-2" />
      ) : (
        <p className="mt-3 text-[13px] text-text-3">Sem prompt base.</p>
      )}
      <p className="mt-2 font-mono text-[11px] text-text-3">
        {params.join(" · ")}
        {vars.length ? ` · ${vars.length} ${vars.length === 1 ? "variável" : "variáveis"}` : ""}
      </p>
      <div className="mt-auto flex items-center gap-1.5 pt-4">
        <button type="button" onClick={onUse} className="flex h-9 items-center gap-1.5 rounded-full bg-accent px-3.5 text-sm font-medium text-accent-ink">
          <Play className="size-3.5" fill="currentColor" /> Usar
        </button>
        <button type="button" onClick={onEdit} aria-label={`Editar ${p.name}`} className="grid size-9 place-items-center rounded-full text-text-3 hover:bg-surface-2 hover:text-text">
          <Pencil className="size-4" />
        </button>
        <button type="button" onClick={onDelete} aria-label={`Apagar ${p.name}`} className="ml-auto grid size-9 place-items-center rounded-full text-text-3 hover:bg-danger/10 hover:text-danger">
          <Trash2 className="size-4" />
        </button>
      </div>
    </GlassCard>
  )
}

export function Presets() {
  const { data: projects } = useStudio(api.projects)
  const { data: presets } = useStudio(api.presets)
  const [filter, setFilter] = useState<string>("")
  const [newName, setNewName] = useState("")
  const [using, setUsing] = useState<Preset | null>(null)
  const [editing, setEditing] = useState<Preset | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const navigate = useNavigate()
  const toast = useToast()

  const go = (p: Preset, prompt: string) => {
    setPrefill({
      modeId: p.mode,
      model: p.model_id,
      prompt,
      ...p.params,
      projectId: p.project_id ?? undefined,
      templateId: p.id,
    })
    navigate(`/criar?modo=${p.mode}`)
  }

  const visible = (presets ?? []).filter((p) => !filter || p.project_id === filter)
  const projectList = (projects ?? []).filter((p) => showArchived || !p.archived)

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Eyebrow>Estúdio</Eyebrow>
        <h1 className="display-title mt-3 text-page text-text">
          Presets e projetos<span className="text-accent">.</span>
        </h1>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        <GlassCard className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="label">Projetos</p>
            <button type="button" onClick={() => setShowArchived((v) => !v)} className="text-xs text-text-3 hover:text-text" aria-pressed={showArchived}>
              {showArchived ? "esconder arquivados" : "ver arquivados"}
            </button>
          </div>
          <form
            className="mb-3 flex items-center gap-2 rounded-[14px] border border-dashed border-line-2 px-3"
            onSubmit={async (e) => {
              e.preventDefault()
              if (!newName.trim()) return
              try {
                await api.createProject({ name: newName.trim(), color: PROJECT_COLORS[(projects?.length ?? 0) % PROJECT_COLORS.length] })
                setNewName("")
                notifyStudio()
              } catch (err) {
                toast({ title: "Não criou", detail: (err as Error).message, tone: "error" })
              }
            }}
          >
            <FolderPlus className="size-4 shrink-0 text-text-3" />
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Novo projeto (cliente, campanha)…" aria-label="Nome do novo projeto" className="h-10 min-w-0 flex-1 bg-transparent text-sm text-text outline-none placeholder:text-text-3" />
          </form>
          {projects === null ? (
            <span className="skeleton block h-40 rounded-xl" />
          ) : (
            <ul className="flex flex-col gap-2">
              {projectList.map((p) => (
                <ProjectRow key={p.id + p.name + p.color + p.archived} p={p} />
              ))}
            </ul>
          )}
        </GlassCard>

        <div className="flex min-w-0 flex-col gap-3">
          <div className="no-scrollbar flex gap-1 overflow-x-auto rounded-full bg-surface p-1">
            <button type="button" onClick={() => setFilter("")} className={cn("shrink-0 rounded-full px-3 py-1.5 text-sm", !filter ? "bg-invert text-invert-ink" : "text-text-2 hover:text-text")}>
              Todos
            </button>
            {(projects ?? [])
              .filter((p) => !p.archived)
              .map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setFilter(p.id)}
                  className={cn("flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm", filter === p.id ? "bg-invert text-invert-ink" : "text-text-2 hover:text-text")}
                >
                  <span className="size-2 rounded-full" style={{ background: p.color ?? "var(--text-3)" }} />
                  {p.name}
                </button>
              ))}
          </div>
          {presets === null ? (
            <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
              {Array.from({ length: 3 }, (_, i) => (
                <span key={i} className="skeleton h-48 rounded-[24px]" />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <GlassCard className="p-8 text-center">
              <p className="text-card font-medium text-text">Nenhum preset{filter ? " neste projeto" : ""}</p>
              <p className="mt-1 text-sm text-text-2">
                No Criar, monte o pedido e use <span className="text-text">Presets → Salvar o atual como preset</span>. Escreva {"{{produto}}"} no prompt pros trechos que mudam.
              </p>
            </GlassCard>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
              {visible.map((p) => (
                <PresetCard
                  key={p.id}
                  p={p}
                  onUse={() => (templateVars(p.prompt_template).length ? setUsing(p) : go(p, p.prompt_template ?? ""))}
                  onEdit={() => setEditing(p)}
                  onDelete={async () => {
                    if (!window.confirm(`Apagar o preset "${p.name}"?`)) return
                    await api.deletePreset(p.id)
                    notifyStudio()
                    toast({ title: "Preset apagado", detail: p.name })
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <VarsDialog key={using?.id ?? "nenhum"} preset={using} onClose={() => setUsing(null)} onApply={(text) => using && go(using, text)} />
      {editing && projects && <SavePresetDialog key={editing.id} open editing={editing} draft={null} projects={projects} onClose={() => setEditing(null)} />}
    </div>
  )
}
