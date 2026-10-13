import { Hono } from "hono"
import { estimate, HiggsfieldError } from "../lib/higgsfield"
import type { AppEnv } from "../types"

// Endpoint barato usado só pra provar que a chave funciona: a estimativa não cobra.
const PROBE_ENDPOINT = "higgsfield-ai/soul/v2/standard"

type Check = { ok: boolean; detail: string }

export const health = new Hono<AppEnv>().get("/", async (c) => {
  const [db, files, hf] = await Promise.all([
    checkDb(c.env.DB),
    checkR2(c.env.FILES),
    checkHiggsfield(c.env.HF_CREDENTIALS),
  ])
  const ok = db.ok && files.ok && hf.ok
  return c.json({ ok, checks: { db, files, higgsfield: hf } }, ok ? 200 : 503)
})

async function checkDb(db: D1Database): Promise<Check> {
  try {
    const row = await db
      .prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table' AND name = 'jobs'")
      .first<{ n: number }>()
    return row?.n ? { ok: true, detail: "D1 ok, migrations aplicadas" } : { ok: false, detail: "migrations não aplicadas" }
  } catch (e) {
    return { ok: false, detail: `D1 indisponível: ${(e as Error).message}` }
  }
}

async function checkR2(bucket: R2Bucket): Promise<Check> {
  try {
    await bucket.list({ limit: 1 })
    return { ok: true, detail: "R2 ok" }
  } catch (e) {
    return { ok: false, detail: `R2 indisponível: ${(e as Error).message}` }
  }
}

async function checkHiggsfield(credentials: string | undefined): Promise<Check> {
  if (!credentials) return { ok: false, detail: "HF_CREDENTIALS não configurada" }
  try {
    const est = await estimate(credentials, PROBE_ENDPOINT, { prompt: "health check" })
    const valor = "usd" in est ? ` — estimativa de teste US$ ${est.usd}` : ""
    return { ok: true, detail: `chave ok${valor}` }
  } catch (e) {
    if (e instanceof HiggsfieldError) {
      if (e.status === 401) return { ok: false, detail: "credenciais inválidas (401)" }
      const corr = e.correlationId ? ` · correlation ${e.correlationId}` : ""
      return { ok: false, detail: `Higgsfield ${e.status || "erro"}: ${e.message}${corr}` }
    }
    return { ok: false, detail: `falha de rede: ${(e as Error).message}` }
  }
}
