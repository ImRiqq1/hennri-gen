import { useCallback, useEffect, useRef, useState } from "react"
import type { GenerateRequest, JobStatus, JobView } from "@shared/generation"

export const JOBS_CHANGED = "hg:jobs-changed"

export const STATUS_LABEL: Record<JobStatus, string> = {
  waiting_slot: "aguardando vaga",
  submitting: "enviando",
  queued: "na fila",
  in_progress: "gerando",
  completed: "baixando",
  saving: "salvando",
  saved: "pronto",
  failed: "falhou",
  nsfw: "bloqueado",
  canceled: "cancelado",
}

const LIVE: JobStatus[] = ["waiting_slot", "submitting", "queued", "in_progress", "completed", "saving"]
export const isLive = (s: JobStatus) => LIVE.includes(s)

export type SubmitOutcome =
  | { ok: true; jobs: JobView[] }
  | { ok: false; error: string; needsConfirm?: boolean }

export async function submitJobs(req: GenerateRequest): Promise<SubmitOutcome> {
  const res = await fetch("/api/jobs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(req) })
  const body = (await res.json().catch(() => null)) as { jobs?: JobView[]; error?: string; needsConfirm?: boolean } | null
  if (res.ok && body?.jobs) {
    window.dispatchEvent(new Event(JOBS_CHANGED))
    return { ok: true, jobs: body.jobs }
  }
  return { ok: false, error: body?.error ?? `HTTP ${res.status}`, needsConfirm: body?.needsConfirm }
}

export async function cancelJob(id: string) {
  const res = await fetch(`/api/jobs/${id}/cancel`, { method: "POST" })
  const body = (await res.json().catch(() => null)) as { error?: string } | null
  window.dispatchEvent(new Event(JOBS_CHANGED))
  return res.ok ? null : (body?.error ?? `HTTP ${res.status}`)
}

/**
 * Jobs em andamento + recentes. Enquanto houver job vivo, pergunta a cada 3 s (o Worker
 * aproveita pra consultar a Higgsfield); parado, a cada 20 s. Avisa quando um job termina.
 */
export function useLiveJobs(onFinish?: (job: JobView) => void) {
  const [jobs, setJobs] = useState<JobView[] | null>(null)
  const prev = useRef(new Map<string, JobStatus>())
  const finishRef = useRef(onFinish)
  useEffect(() => {
    finishRef.current = onFinish
  })

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/jobs?active=1&limit=30")
      const body = (await r.json()) as { jobs: JobView[] }
      for (const j of body.jobs) {
        const before = prev.current.get(j.id)
        if (before && isLive(before) && !isLive(j.status)) finishRef.current?.(j)
        prev.current.set(j.id, j.status)
      }
      setJobs(body.jobs)
      return body.jobs.some((j) => isLive(j.status))
    } catch {
      return false
    }
  }, [])

  useEffect(() => {
    let alive = true
    let timer = 0
    const tick = async () => {
      const live = document.visibilityState === "visible" ? await load() : true
      if (alive) timer = window.setTimeout(tick, live ? 3000 : 20000)
    }
    void tick()
    const kick = () => {
      window.clearTimeout(timer)
      void tick()
    }
    window.addEventListener(JOBS_CHANGED, kick)
    return () => {
      alive = false
      window.clearTimeout(timer)
      window.removeEventListener(JOBS_CHANGED, kick)
    }
  }, [load])

  return jobs
}

export function useSavedJobs(limit = 8) {
  const [jobs, setJobs] = useState<JobView[] | null>(null)
  useEffect(() => {
    let alive = true
    const load = () =>
      fetch(`/api/jobs?limit=${limit * 3}`)
        .then((r) => r.json() as Promise<{ jobs: JobView[] }>)
        .then((b) => alive && setJobs(b.jobs.filter((j) => j.status === "saved").slice(0, limit)))
        .catch(() => alive && setJobs([]))
    void load()
    window.addEventListener(JOBS_CHANGED, load)
    const id = window.setInterval(load, 20000)
    return () => {
      alive = false
      window.removeEventListener(JOBS_CHANGED, load)
      window.clearInterval(id)
    }
  }, [limit])
  return jobs
}

export const elapsed = (from: number, to = Date.now()) => {
  const s = Math.max(0, Math.round((to - from) / 1000))
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m${String(s % 60).padStart(2, "0")}`
}
