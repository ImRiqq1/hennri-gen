// Cliente da API interna (o Worker). O navegador nunca fala com a Higgsfield.

export type Check = { ok: boolean; detail: string }

export type Health = {
  ok: boolean
  checks: { db: Check; files: Check; higgsfield: Check }
}

export type Stats = {
  queue: { active: number; waiting: number; concurrency: number }
  spend: {
    dayUsd: number
    monthUsd: number
    dayLimitUsd: number | null
    monthLimitUsd: number | null
    brlRate: number | null
    confirmAboveUsd: number | null
  }
  gallery: { saved: number }
  today: {
    /** início do dia (fuso de São Paulo) em epoch ms */
    dayStart: number
    jobs: { id: string; model_id: string; mode: string; status: string; created_at: number; completed_at: number | null }[]
  }
}

async function getJson<T>(path: string, isValid: (b: unknown) => boolean): Promise<T> {
  const res = await fetch(path)
  const body = await res.json().catch(() => null)
  if (!isValid(body)) {
    throw new Error((body as { error?: string } | null)?.error ?? `HTTP ${res.status}`)
  }
  return body as T
}

export const getHealth = () =>
  getJson<Health>("/api/health", (b) => !!b && typeof b === "object" && "checks" in b)

export const getStats = () =>
  getJson<Stats>("/api/stats", (b) => !!b && typeof b === "object" && "queue" in b)

export const usd = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "USD", minimumFractionDigits: 2 })
