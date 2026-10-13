// Ciclo de vida do job (BRIEFING.md → "Status internos do job"):
// waiting_slot → submitting → queued | in_progress → completed → saving → saved
//                                                  ↘ failed | nsfw | canceled
// O id do job é a Idempotency-Key. Fase 2: acompanhamento por polling (o front pergunta,
// o Worker consulta o status_url). Webhook, Queue e Cron entram na fase 3.

import { buildRequest, type GenerateRequest, type JobStatus, type JobView } from "../../shared/generation"
import { estimateFor } from "../routes/estimate"
import type { Env } from "../types"
import { cancelRequest, getStatus, HiggsfieldError, submit } from "./higgsfield"

export type JobRow = {
  id: string
  batch_id: string | null
  parent_job_id: string | null
  parent_relation: string | null
  model_id: string
  mode: string
  prompt: string | null
  params_json: string
  refs_json: string
  status: JobStatus
  hf_request_id: string | null
  hf_status_url: string | null
  hf_cancel_url: string | null
  hf_correlation_id: string | null
  estimated_cost_usd: number | null
  estimate_basis: string | null
  error: string | null
  output_source_url: string | null
  output_r2_key: string | null
  output_mime: string | null
  endpoint: string | null
  request_body_json: string | null
  favorite: number
  project_id: string
  preset_id: string | null
  attempts: number
  last_checked_at: number | null
  created_at: number
  submitted_at: number | null
  completed_at: number | null
}

/** Só o que usamos do contexto de execução (o tipo do Hono difere do do Workers). */
type Ctx = { waitUntil(p: Promise<unknown>): void }

const SPENT = "('completed','saving','saved')"
const IN_FLIGHT = "('submitting','queued','in_progress')"
const PENDING = "('waiting_slot','submitting','queued','in_progress')"
const POLL_EVERY_MS = 3000
const MAX_ATTEMPTS = 5

export function toView(r: JobRow): JobView {
  return {
    id: r.id,
    batch_id: r.batch_id,
    parent_job_id: r.parent_job_id,
    parent_relation: r.parent_relation,
    model_id: r.model_id,
    mode: r.mode,
    prompt: r.prompt,
    status: r.status,
    error: r.error,
    estimated_cost_usd: r.estimated_cost_usd,
    estimate_basis: r.estimate_basis,
    output_url: r.output_r2_key ? `/api/files/${r.output_r2_key}` : null,
    output_mime: r.output_mime,
    params: JSON.parse(r.params_json || "{}"),
    refs: JSON.parse(r.refs_json || "{}"),
    created_at: r.created_at,
    submitted_at: r.submitted_at,
    completed_at: r.completed_at,
    favorite: !!r.favorite,
    project_id: r.project_id,
  }
}

async function settings(db: D1Database) {
  const rows = await db.prepare("SELECT key, value FROM settings").all<{ key: string; value: string }>()
  const m = Object.fromEntries(rows.results.map((r) => [r.key, JSON.parse(r.value)]))
  return {
    dayLimit: Number(m.limite_diario_usd ?? 20),
    monthLimit: Number(m.limite_mensal_usd ?? 200),
    confirmAbove: Number(m.confirmacao_acima_usd ?? 5),
    concurrency: Number(m.concorrencia_max ?? 4),
  }
}

/** Gasto já feito + o que está na fila (ainda pode ser cobrado), no dia e no mês (fuso de SP). */
async function committedSpend(db: D1Database) {
  const off = 3 * 60 * 60 * 1000
  const local = new Date(Date.now() - off)
  const day = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) + off
  const month = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) + off
  const row = await db
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN status IN ${SPENT} AND completed_at >= ?1 THEN estimated_cost_usd END), 0)
       + COALESCE(SUM(CASE WHEN status IN ${PENDING} THEN estimated_cost_usd END), 0) AS day,
         COALESCE(SUM(CASE WHEN status IN ${SPENT} AND completed_at >= ?2 THEN estimated_cost_usd END), 0)
       + COALESCE(SUM(CASE WHEN status IN ${PENDING} THEN estimated_cost_usd END), 0) AS month
       FROM jobs`,
    )
    .bind(day, month)
    .first<{ day: number; month: number }>()
  return { day: row?.day ?? 0, month: row?.month ?? 0 }
}

type CreateResult =
  | { ok: true; jobs: JobView[] }
  | { ok: false; status: 400 | 403 | 409; error: string; needsConfirm?: boolean; remaining?: number }

/** Cria os jobs (1 por take). Nenhum sai sem estimativa e sem passar pelos limites. */
export async function createJobs(env: Env, req: GenerateRequest, ctx: Ctx): Promise<CreateResult> {
  const built = buildRequest(req)
  if ("error" in built) return { ok: false, status: 400, error: built.error }

  const est = await estimateFor(env.HF_CREDENTIALS, req)
  if (est.perTake === null || est.total === null) {
    return { ok: false, status: 400, error: `Sem estimativa de custo — o job não sai (${est.basis}).` }
  }

  const cfg = await settings(env.DB)
  const spent = await committedSpend(env.DB)
  const fmt = (n: number) => `US$ ${n.toFixed(2).replace(".", ",")}`
  if (spent.day + est.total > cfg.dayLimit) {
    const remaining = Math.max(0, cfg.dayLimit - spent.day)
    return { ok: false, status: 403, error: `Passa do limite diário: restam ${fmt(remaining)} hoje.`, remaining }
  }
  if (spent.month + est.total > cfg.monthLimit) {
    const remaining = Math.max(0, cfg.monthLimit - spent.month)
    return { ok: false, status: 403, error: `Passa do limite mensal: restam ${fmt(remaining)} no mês.`, remaining }
  }
  if (est.total > cfg.confirmAbove && !req.confirmed) {
    return { ok: false, status: 409, error: `Acima de ${fmt(cfg.confirmAbove)} — confirme o envio.`, needsConfirm: true }
  }

  // projeto precisa existir e estar ativo; senão vai pro padrão
  const project = req.projectId
    ? await env.DB.prepare(`SELECT id FROM projects WHERE id = ?1 AND archived = 0`).bind(req.projectId).first<{ id: string }>()
    : null
  const template = req.templateId ? await env.DB.prepare(`SELECT id FROM presets WHERE id = ?1`).bind(req.templateId).first<{ id: string }>() : null
  const parent = req.parentJobId ? await env.DB.prepare(`SELECT id FROM jobs WHERE id = ?1`).bind(req.parentJobId).first<{ id: string }>() : null

  const now = Date.now()
  const batch = crypto.randomUUID()
  const params = {
    resolution: req.resolution,
    duration: req.duration,
    aspect: req.aspect,
    audio: req.audio,
    takes: req.takes,
    presetId: req.presetId ?? null,
    sourceVideoSec: req.sourceVideoSec ?? null,
  }
  const ids = Array.from({ length: req.takes }, () => crypto.randomUUID())
  await env.DB.batch(
    ids.map((id, i) =>
      env.DB.prepare(
        `INSERT INTO jobs (id, batch_id, model_id, mode, prompt, params_json, refs_json, status,
           estimated_cost_usd, estimate_basis, estimate_source, endpoint, request_body_json, created_at, project_id, preset_id,
           parent_job_id, parent_relation)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'waiting_slot', ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17)`,
      ).bind(
        id,
        batch,
        req.model,
        req.modeId,
        req.prompt || null,
        JSON.stringify(params),
        JSON.stringify(req.media),
        est.perTake,
        est.basis,
        est.source,
        built.endpoint,
        JSON.stringify(built.body),
        now + i, // ordem estável entre takes
        project?.id ?? "sem-projeto",
        template?.id ?? null,
        parent?.id ?? null,
        parent ? (req.parentRelation ?? "referência") : null,
      ),
    ),
  )

  await dispatch(env, ctx)
  const rows = await env.DB.prepare(`SELECT * FROM jobs WHERE batch_id = ?1 ORDER BY created_at`).bind(batch).all<JobRow>()
  return { ok: true, jobs: rows.results.map(toView) }
}

/** Ocupa as vagas livres de concorrência com os jobs mais antigos em waiting_slot. */
export async function dispatch(env: Env, ctx: Ctx) {
  const { concurrency } = await settings(env.DB)
  const active = await env.DB.prepare(`SELECT COUNT(*) AS n FROM jobs WHERE status IN ${IN_FLIGHT}`).first<{ n: number }>()
  let free = concurrency - (active?.n ?? 0)
  if (free <= 0) return
  const waiting = await env.DB.prepare(`SELECT * FROM jobs WHERE status = 'waiting_slot' ORDER BY created_at LIMIT ?1`).bind(free).all<JobRow>()
  for (const job of waiting.results) {
    // reserva atômica: só um despachante pega cada job
    const claimed = await env.DB.prepare(
      `UPDATE jobs SET status = 'submitting', attempts = attempts + 1, last_checked_at = ?2 WHERE id = ?1 AND status = 'waiting_slot'`,
    )
      .bind(job.id, Date.now())
      .run()
    if (!claimed.meta.changes) continue
    const stop = await sendJob(env, job.id)
    if (stop) break
    free--
  }
  void ctx
}

/** Envia (ou reenvia, com a mesma Idempotency-Key) um job em 'submitting'. Devolve true se bateu na concorrência. */
async function sendJob(env: Env, id: string): Promise<boolean> {
  const job = await env.DB.prepare(`SELECT * FROM jobs WHERE id = ?1`).bind(id).first<JobRow>()
  if (!job?.endpoint || !job.request_body_json) return false
  try {
    const res = await submit(env.HF_CREDENTIALS, job.endpoint, JSON.parse(job.request_body_json), job.id, webhookUrl(env))
    await env.DB.prepare(
      `UPDATE jobs SET status = 'queued', hf_request_id = ?2, hf_status_url = ?3, hf_cancel_url = ?4,
         hf_correlation_id = ?5, submitted_at = COALESCE(submitted_at, ?6), error = NULL WHERE id = ?1`,
    )
      .bind(job.id, res.request_id, res.status_url, res.cancel_url, res.correlationId, Date.now())
      .run()
    return false
  } catch (e) {
    const err = e instanceof HiggsfieldError ? e : null
    const status = err?.status ?? 0
    if (status === 400 && /concurrent/i.test(err?.message ?? "")) {
      // sem vaga na Higgsfield: volta pra fila interna (não conta como tentativa)
      await env.DB.prepare(`UPDATE jobs SET status = 'waiting_slot', attempts = attempts - 1 WHERE id = ?1`).bind(id).run()
      return true
    }
    if (status >= 400 && status < 500) {
      const msg = status === 403 ? "Saldo insuficiente na Higgsfield (recarregue no console)." : status === 401 ? "Credencial da Higgsfield inválida." : err!.message
      await env.DB.prepare(`UPDATE jobs SET status = 'failed', error = ?2, hf_correlation_id = ?3, completed_at = ?4 WHERE id = ?1`)
        .bind(id, msg, err?.correlationId ?? null, Date.now())
        .run()
      return false
    }
    // 5xx / rede: fica em 'submitting'; o próximo refresh reenvia com a MESMA chave (sem duplicar)
    const fail = job.attempts >= MAX_ATTEMPTS
    await env.DB.prepare(`UPDATE jobs SET status = ?2, error = ?3, completed_at = ?4 WHERE id = ?1`)
      .bind(id, fail ? "failed" : "submitting", `Falha ao enviar: ${(e as Error).message}`, fail ? Date.now() : null)
      .run()
    return false
  }
}

/** Consulta o status_url (no máx. a cada 3 s por job) e avança o job. */
export async function refreshJob(env: Env, job: JobRow, ctx: Ctx, force = false): Promise<void> {
  const now = Date.now()
  if (!force && job.last_checked_at && now - job.last_checked_at < POLL_EVERY_MS && job.status !== "completed") return

  if (job.status === "submitting") {
    await env.DB.prepare(`UPDATE jobs SET last_checked_at = ?2, attempts = attempts + 1 WHERE id = ?1`).bind(job.id, now).run()
    await sendJob(env, job.id)
    return
  }
  if (job.status === "completed" || (job.status === "saving" && now - (job.last_checked_at ?? 0) > 120_000)) {
    await enqueueSave(env, job.id, ctx)
    return
  }
  if ((job.status !== "queued" && job.status !== "in_progress") || !job.hf_status_url) return

  await env.DB.prepare(`UPDATE jobs SET last_checked_at = ?2 WHERE id = ?1`).bind(job.id, now).run()
  let st
  try {
    st = await getStatus(env.HF_CREDENTIALS, job.hf_status_url)
  } catch (e) {
    if (e instanceof HiggsfieldError && e.status === 404) {
      await env.DB.prepare(`UPDATE jobs SET status = 'failed', error = 'Request não encontrado na Higgsfield', completed_at = ?2 WHERE id = ?1`)
        .bind(job.id, now)
        .run()
      ctx.waitUntil(dispatch(env, ctx))
    }
    return // 5xx/rede: tenta no próximo polling
  }

  if (st.status === "queued" || st.status === "in_progress") {
    if (st.status !== job.status) await env.DB.prepare(`UPDATE jobs SET status = ?2 WHERE id = ?1`).bind(job.id, st.status).run()
    return
  }
  if (st.status === "completed") {
    const out = st.video?.url ?? st.images?.[0]?.url ?? st.audio?.url ?? null
    const mime = st.video ? (st.video.content_type ?? "video/mp4") : st.images?.[0] ? (st.images[0].content_type ?? "image/png") : "audio/mpeg"
    await env.DB.prepare(`UPDATE jobs SET status = 'completed', output_source_url = ?2, output_mime = ?3 WHERE id = ?1`)
      .bind(job.id, out, mime)
      .run()
    await enqueueSave(env, job.id, ctx)
    return
  }
  if (st.status === "failed" || st.status === "nsfw" || st.status === "canceled") {
    const error = st.status === "nsfw" ? "Bloqueado pela moderação da Higgsfield (não cobrado)." : st.status === "canceled" ? null : (st.error ?? "Falhou na Higgsfield (não cobrado).")
    await env.DB.prepare(`UPDATE jobs SET status = ?2, error = ?3, completed_at = ?4 WHERE id = ?1`).bind(job.id, st.status, error, now).run()
    ctx.waitUntil(dispatch(env, ctx))
  }
}

/** Manda a cópia pro R2 pra Queue (fora da requisição); sem Queue (dev), usa waitUntil. */
async function enqueueSave(env: Env, id: string, ctx: Ctx) {
  if (env.SAVE_QUEUE) {
    await env.SAVE_QUEUE.send({ id })
    return
  }
  ctx.waitUntil(saveOutput(env, id, ctx))
}

/** URL do webhook com o token; vazia no dev (localhost não recebe webhook). */
export function webhookUrl(env: Env) {
  if (!env.PUBLIC_URL || !env.WEBHOOK_TOKEN) return undefined
  return `${env.PUBLIC_URL.replace(/\/$/, "")}/api/webhooks/higgsfield?token=${encodeURIComponent(env.WEBHOOK_TOKEN)}`
}

/**
 * Cron (a cada minuto): recupera o que ficou parado quando ninguém está com a tela aberta
 * ou um webhook se perdeu. Consulta jobs vivos, reenvia 'submitting', refaz cópias travadas
 * e ocupa vagas livres.
 */
export async function recoverAll(env: Env, ctx: Ctx) {
  const stale = Date.now() - 20_000
  const rows = await env.DB.prepare(
    `SELECT * FROM jobs
     WHERE (status IN ('queued','in_progress','submitting') AND COALESCE(last_checked_at, 0) < ?1)
        OR status = 'completed'
        OR (status = 'saving' AND COALESCE(last_checked_at, 0) < ?2)
     ORDER BY created_at LIMIT 40`,
  )
    .bind(stale, Date.now() - 120_000)
    .all<JobRow>()
  for (const job of rows.results) await refreshJob(env, job, ctx, true)
  await dispatch(env, ctx)
  return rows.results.length
}

/** Copia o resultado pro R2 (os links da Higgsfield duram ~7 dias). */
export async function saveOutput(env: Env, id: string, ctx: Ctx) {
  const claimed = await env.DB.prepare(
    `UPDATE jobs SET status = 'saving', last_checked_at = ?2 WHERE id = ?1 AND (status = 'completed' OR status = 'saving')`,
  )
    .bind(id, Date.now())
    .run()
  if (!claimed.meta.changes) return
  const job = await env.DB.prepare(`SELECT * FROM jobs WHERE id = ?1`).bind(id).first<JobRow>()
  if (!job?.output_source_url) return
  try {
    const res = await fetch(job.output_source_url)
    if (!res.ok || !res.body) throw new Error(`download ${res.status}`)
    const mime = res.headers.get("content-type") ?? job.output_mime ?? "application/octet-stream"
    const ext = mime.includes("mp4") ? "mp4" : mime.includes("quicktime") ? "mov" : mime.includes("png") ? "png" : mime.includes("jpeg") ? "jpg" : mime.includes("webp") ? "webp" : "bin"
    const key = `jobs/${id}.${ext}`
    await env.FILES.put(key, res.body, { httpMetadata: { contentType: mime } })
    await env.DB.prepare(`UPDATE jobs SET status = 'saved', output_r2_key = ?2, output_mime = ?3, completed_at = ?4, error = NULL WHERE id = ?1`)
      .bind(id, key, mime, Date.now())
      .run()
  } catch (e) {
    // volta pra 'completed' — o próximo refresh tenta de novo; o link da Higgsfield ainda vale por dias
    await env.DB.prepare(`UPDATE jobs SET status = 'completed', error = ?2 WHERE id = ?1`).bind(id, `Falha ao salvar no R2: ${(e as Error).message}`).run()
  }
  await dispatch(env, ctx)
}

/**
 * Refazer igual: mesmo endpoint e corpo, id novo (= Idempotency-Key nova → geração nova).
 * Passa pelos mesmos limites e confirmação do envio normal.
 */
export async function redoJob(env: Env, src: JobRow, confirmed: boolean, ctx: Ctx): Promise<CreateResult> {
  if (!src.endpoint || !src.request_body_json) return { ok: false, status: 400, error: "Job antigo sem o corpo original — refaça pelo Criar." }
  const cost = src.estimated_cost_usd ?? 0
  const cfg = await settings(env.DB)
  const spent = await committedSpend(env.DB)
  const fmt = (n: number) => `US$ ${n.toFixed(2).replace(".", ",")}`
  if (spent.day + cost > cfg.dayLimit) {
    const remaining = Math.max(0, cfg.dayLimit - spent.day)
    return { ok: false, status: 403, error: `Passa do limite diário: restam ${fmt(remaining)} hoje.`, remaining }
  }
  if (spent.month + cost > cfg.monthLimit) {
    return { ok: false, status: 403, error: `Passa do limite mensal: restam ${fmt(Math.max(0, cfg.monthLimit - spent.month))} no mês.` }
  }
  if (cost > cfg.confirmAbove && !confirmed) return { ok: false, status: 409, error: `Acima de ${fmt(cfg.confirmAbove)} — confirme o envio.`, needsConfirm: true }

  const id = crypto.randomUUID()
  await env.DB.prepare(
    `INSERT INTO jobs (id, batch_id, parent_job_id, parent_relation, project_id, model_id, mode, prompt, params_json, refs_json, status,
       estimated_cost_usd, estimate_basis, estimate_source, endpoint, request_body_json, created_at)
     SELECT ?1, ?1, id, 'refeito', project_id, model_id, mode, prompt, params_json, refs_json, 'waiting_slot',
       estimated_cost_usd, estimate_basis, estimate_source, endpoint, request_body_json, ?2
     FROM jobs WHERE id = ?3`,
  )
    .bind(id, Date.now(), src.id)
    .run()
  await dispatch(env, ctx)
  const row = await env.DB.prepare(`SELECT * FROM jobs WHERE id = ?1`).bind(id).first<JobRow>()
  return { ok: true, jobs: [toView(row!)] }
}

/** Cancela: na fila interna some na hora; na Higgsfield só enquanto 'queued'. */
export async function cancelJob(env: Env, job: JobRow, ctx: Ctx): Promise<{ ok: boolean; error?: string }> {
  if (job.status === "waiting_slot") {
    await env.DB.prepare(`UPDATE jobs SET status = 'canceled', completed_at = ?2 WHERE id = ?1 AND status = 'waiting_slot'`).bind(job.id, Date.now()).run()
    return { ok: true }
  }
  if (job.status !== "queued" || !job.hf_cancel_url) return { ok: false, error: "Já começou a gerar — não dá mais pra cancelar." }
  const code = await cancelRequest(env.HF_CREDENTIALS, job.hf_cancel_url)
  if (code === 202) {
    await env.DB.prepare(`UPDATE jobs SET status = 'canceled', completed_at = ?2 WHERE id = ?1`).bind(job.id, Date.now()).run()
    ctx.waitUntil(dispatch(env, ctx))
    return { ok: true }
  }
  return { ok: false, error: code === 400 ? "Já começou a gerar — não dá mais pra cancelar." : `Higgsfield respondeu ${code}.` }
}
