import { Hono } from "hono"
import { z } from "zod"
import type { GenerateRequest } from "../../shared/generation"
import { cancelJob, createJobs, redoJob, refreshJob, toView, type JobRow } from "../lib/jobs"
import type { AppEnv } from "../types"
import { EstimateBody } from "./estimate"

const MediaRef = z.object({ url: z.string().url().max(2083), durationSec: z.number().positive().optional() })
const GenerateBody = EstimateBody.extend({
  prompt: z.string().max(10_000),
  media: z.record(z.string(), z.array(MediaRef).max(50)),
  confirmed: z.boolean().optional(),
})

const ACTIVE = "('waiting_slot','submitting','queued','in_progress','completed','saving')"

export const jobs = new Hono<AppEnv>()
  /** Cria 1 job por take (estimativa + limites + Idempotency-Key = id). */
  .post("/", async (c) => {
    const parsed = GenerateBody.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return c.json({ error: "pedido inválido" }, 400)
    const res = await createJobs(c.env, parsed.data as GenerateRequest, c.executionCtx)
    if (!res.ok) return c.json({ error: res.error, needsConfirm: res.needsConfirm, remaining: res.remaining }, res.status)
    return c.json({ jobs: res.jobs }, 201)
  })

  /**
   * Lista jobs. Com ?active=1, antes de responder consulta a Higgsfield pelos jobs em andamento
   * (é o polling da fase 2 — no máx. 1 consulta a cada 3 s por job).
   */
  .get("/", async (c) => {
    const active = c.req.query("active") === "1"
    const limit = Math.min(Number(c.req.query("limit") ?? 30) || 30, 100)
    if (active) {
      const pending = await c.env.DB.prepare(`SELECT * FROM jobs WHERE status IN ${ACTIVE} ORDER BY created_at LIMIT 20`).all<JobRow>()
      await Promise.all(pending.results.map((j) => refreshJob(c.env, j, c.executionCtx)))
    }
    if (active) {
      const rows = await c.env.DB.prepare(`SELECT * FROM jobs WHERE status IN ${ACTIVE} OR completed_at >= ?2 ORDER BY created_at DESC LIMIT ?1`)
        .bind(limit, Date.now() - 30 * 60 * 1000)
        .all<JobRow>()
      return c.json({ jobs: rows.results.map(toView) })
    }

    // Galeria: filtros + paginação por cursor (created_at do último item)
    const where: string[] = []
    const args: unknown[] = []
    const add = (sql: string, v: unknown) => {
      args.push(v)
      where.push(sql.replace("?", `?${args.length}`))
    }
    const status = c.req.query("status")
    if (status === "saved") where.push(`status = 'saved'`)
    else if (status === "failed") where.push(`status IN ('failed','nsfw','canceled')`)
    const mode = c.req.query("mode")
    if (mode) add("mode = ?", mode)
    const model = c.req.query("model")
    if (model) add("model_id = ?", model)
    if (c.req.query("favorite") === "1") where.push("favorite = 1")
    const since = Number(c.req.query("since"))
    if (since) add("created_at >= ?", since)
    const before = Number(c.req.query("before"))
    if (before) add("created_at < ?", before)
    const q = c.req.query("q")?.trim()
    if (q) add("prompt LIKE ?", `%${q.replace(/[%_]/g, "")}%`)
    args.push(limit)
    const sql = `SELECT * FROM jobs ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY created_at DESC LIMIT ?${args.length}`
    const rows = await c.env.DB.prepare(sql).bind(...args).all<JobRow>()
    const items = rows.results.map(toView)
    return c.json({ jobs: items, next: items.length === limit ? items[items.length - 1].created_at : null })
  })

  .get("/:id", async (c) => {
    const job = await c.env.DB.prepare(`SELECT * FROM jobs WHERE id = ?1`).bind(c.req.param("id")).first<JobRow>()
    if (!job) return c.json({ error: "job não encontrado" }, 404)
    await refreshJob(c.env, job, c.executionCtx)
    const fresh = await c.env.DB.prepare(`SELECT * FROM jobs WHERE id = ?1`).bind(job.id).first<JobRow>()
    return c.json({ job: toView(fresh!) })
  })

  /** Favoritar / desfavoritar. */
  .patch("/:id", async (c) => {
    const body = z.object({ favorite: z.boolean() }).safeParse(await c.req.json().catch(() => null))
    if (!body.success) return c.json({ error: "pedido inválido" }, 400)
    const r = await c.env.DB.prepare(`UPDATE jobs SET favorite = ?2 WHERE id = ?1`).bind(c.req.param("id"), body.data.favorite ? 1 : 0).run()
    return r.meta.changes ? c.json({ ok: true }) : c.json({ error: "job não encontrado" }, 404)
  })

  /** Refazer igual (geração nova com o mesmo pedido). */
  .post("/:id/redo", async (c) => {
    const job = await c.env.DB.prepare(`SELECT * FROM jobs WHERE id = ?1`).bind(c.req.param("id")).first<JobRow>()
    if (!job) return c.json({ error: "job não encontrado" }, 404)
    const confirmed = !!(await c.req.json().catch(() => ({})) as { confirmed?: boolean }).confirmed
    const res = await redoJob(c.env, job, confirmed, c.executionCtx)
    if (!res.ok) return c.json({ error: res.error, needsConfirm: res.needsConfirm }, res.status)
    return c.json({ jobs: res.jobs }, 201)
  })

  .post("/:id/cancel", async (c) => {
    const job = await c.env.DB.prepare(`SELECT * FROM jobs WHERE id = ?1`).bind(c.req.param("id")).first<JobRow>()
    if (!job) return c.json({ error: "job não encontrado" }, 404)
    const res = await cancelJob(c.env, job, c.executionCtx)
    return res.ok ? c.json({ ok: true }) : c.json({ error: res.error }, 409)
  })

/** Serve o resultado salvo no R2 (com Range, pra o <video> poder avançar). */
export const files = new Hono<AppEnv>().get("/*", async (c) => {
  const key = c.req.path.replace(/^\/api\/files\//, "")
  if (!key.startsWith("jobs/") || key.includes("..")) return c.json({ error: "arquivo não encontrado" }, 404)
  const range = c.req.header("Range")
  const m = range?.match(/bytes=(\d+)-(\d*)/)
  const obj = await c.env.FILES.get(key, m ? { range: { offset: Number(m[1]), ...(m[2] ? { length: Number(m[2]) - Number(m[1]) + 1 } : {}) } } : undefined)
  if (!obj) return c.json({ error: "arquivo não encontrado" }, 404)
  const headers = new Headers()
  obj.writeHttpMetadata(headers)
  headers.set("ETag", obj.httpEtag)
  headers.set("Accept-Ranges", "bytes")
  headers.set("Cache-Control", "private, max-age=31536000, immutable")
  if (m && obj.range && "offset" in obj.range) {
    const start = obj.range.offset ?? 0
    const len = obj.range.length ?? obj.size - start
    headers.set("Content-Range", `bytes ${start}-${start + len - 1}/${obj.size}`)
    headers.set("Content-Length", String(len))
    return new Response(obj.body, { status: 206, headers })
  }
  headers.set("Content-Length", String(obj.size))
  return new Response(obj.body, { headers })
})
