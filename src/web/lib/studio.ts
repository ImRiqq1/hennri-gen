// Dados da fase 4: configurações, projetos e presets (com um cache simples por sessão).
import { useCallback, useEffect, useState } from "react"

export type Settings = {
  limite_diario_usd: number
  limite_mensal_usd: number
  confirmacao_acima_usd: number
  concorrencia_max: number
  cotacao_brl: number
  padrao_resolucao: string
  padrao_proporcao: string
  padrao_duracao: number
  padrao_audio: boolean
}

export type Project = { id: string; name: string; color: string | null; archived: boolean; jobs: number; spent_usd: number; created_at: number }

export type Preset = {
  id: string
  name: string
  project_id: string | null
  project_name: string | null
  project_color: string | null
  model_id: string
  mode: string
  params: { resolution?: string; duration?: number; aspect?: string; audio?: boolean; presetId?: string | null }
  prompt_template: string | null
  created_at: number
}

export const STUDIO_CHANGED = "hg:studio-changed"

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(path, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } })
  const b = (await r.json().catch(() => null)) as (T & { error?: string }) | null
  if (!r.ok || !b) throw new Error(b?.error ?? `HTTP ${r.status}`)
  return b
}

export const api = {
  settings: () => json<{ settings: Settings }>("/api/settings").then((b) => b.settings),
  saveSettings: (s: Partial<Settings>) => json<{ settings: Settings }>("/api/settings", { method: "PUT", body: JSON.stringify(s) }).then((b) => b.settings),
  projects: () => json<{ projects: Project[] }>("/api/projects").then((b) => b.projects),
  createProject: (p: { name: string; color?: string | null }) => json<{ id: string }>("/api/projects", { method: "POST", body: JSON.stringify(p) }),
  updateProject: (id: string, p: Partial<Pick<Project, "name" | "color" | "archived">>) =>
    json<{ ok: true }>(`/api/projects/${id}`, { method: "PATCH", body: JSON.stringify(p) }),
  presets: () => json<{ presets: Preset[] }>("/api/presets").then((b) => b.presets),
  createPreset: (p: Omit<Preset, "id" | "created_at" | "project_name" | "project_color">) =>
    json<{ id: string }>("/api/presets", { method: "POST", body: JSON.stringify(p) }),
  updatePreset: (id: string, p: Partial<Omit<Preset, "id" | "created_at">>) => json<{ ok: true }>(`/api/presets/${id}`, { method: "PATCH", body: JSON.stringify(p) }),
  deletePreset: (id: string) => json<{ ok: true }>(`/api/presets/${id}`, { method: "DELETE" }),
}

export function notifyStudio() {
  window.dispatchEvent(new Event(STUDIO_CHANGED))
}

/** Carrega e recarrega quando algo da fase 4 muda (ex.: criou projeto na outra tela). */
export function useStudio<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const run = useCallback(() => {
    load()
      .then((d) => {
        setData(d)
        setError(null)
      })
      .catch((e: Error) => setError(e.message))
  }, [load])
  useEffect(() => {
    run()
    window.addEventListener(STUDIO_CHANGED, run)
    return () => window.removeEventListener(STUDIO_CHANGED, run)
  }, [run])
  return { data, error, reload: run }
}

/** Variáveis {{nome}} de um prompt base, na ordem em que aparecem (sem repetir). */
export function templateVars(t: string | null | undefined) {
  if (!t) return []
  return [...new Set([...t.matchAll(/\{\{\s*([\p{L}\w-]+)\s*\}\}/gu)].map((m) => m[1]))]
}

export function fillTemplate(t: string, values: Record<string, string>) {
  return t.replace(/\{\{\s*([\p{L}\w-]+)\s*\}\}/gu, (_, k: string) => values[k] ?? `{{${k}}}`)
}

export const PROJECT_COLORS = ["#ff5b1f", "#2f6bff", "#d6f54a", "#e8e0d5", "#a78bfa", "#22d3ee", "#f472b6", "#94a3b8"]
