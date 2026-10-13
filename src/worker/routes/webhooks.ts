import { Hono } from "hono"
import { z } from "zod"
import { refreshJob, type JobRow } from "../lib/jobs"
import type { AppEnv } from "../types"

// Webhook da Higgsfield (docs: How-to → Webhooks). Fica FORA do Access (o middleware pula
// /api/webhooks/*), protegido por um token secreto na query.
// A documentação não descreve assinatura, então o corpo não é confiável: ele só diz QUAL job
// olhar. O estado de verdade vem de uma nova consulta ao status_url, com a nossa chave.

const Envelope = z.object({
  request_id: z.string().min(1).max(200),
  status: z.string().min(1).max(40),
  error: z.unknown().optional(),
  payload: z.unknown().optional(),
})

const FINAL = new Set(["saved", "failed", "nsfw", "canceled"])

async function sameToken(a: string, b: string) {
  const enc = new TextEncoder()
  const [x, y] = await Promise.all([crypto.subtle.digest("SHA-256", enc.encode(a)), crypto.subtle.digest("SHA-256", enc.encode(b))])
  // compara os hashes em tempo constante (mesmo tamanho sempre)
  return crypto.subtle.timingSafeEqual(x, y)
}

export const webhooks = new Hono<AppEnv>().post("/higgsfield", async (c) => {
  const expected = c.env.WEBHOOK_TOKEN
  const got = c.req.query("token") ?? ""
  if (!expected || !(await sameToken(got, expected))) return c.json({ error: "não autorizado" }, 401)

  const parsed = Envelope.safeParse(await c.req.json().catch(() => null))
  // 4xx não é reenviado pela Higgsfield — só pra corpo realmente inválido
  if (!parsed.success) return c.json({ error: "envelope inválido" }, 400)

  const job = await c.env.DB.prepare(`SELECT * FROM jobs WHERE hf_request_id = ?1`).bind(parsed.data.request_id).first<JobRow>()
  // request desconhecido ou já resolvido (entrega duplicada): reconhece com 2xx e não faz nada
  if (!job) return c.json({ ok: true, ignored: "request desconhecido" })
  if (FINAL.has(job.status)) return c.json({ ok: true, duplicate: true })

  // revalida no status_url (ignora o throttle de 3 s do polling); a cópia pro R2 vai pra Queue
  await refreshJob(c.env, job, c.executionCtx, true)
  return c.json({ ok: true })
})
