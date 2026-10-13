// Cliente da API interna (o Worker). O navegador nunca fala com a Higgsfield.

export type Check = { ok: boolean; detail: string }

export type Health = {
  ok: boolean
  checks: { db: Check; files: Check; higgsfield: Check }
}

export async function getHealth(): Promise<Health> {
  const res = await fetch("/api/health")
  const body = await res.json().catch(() => null)
  if (!body || typeof body !== "object" || !("checks" in body)) {
    throw new Error((body as { error?: string } | null)?.error ?? `HTTP ${res.status}`)
  }
  return body as Health
}
