import { Hono } from "hono"
import type { AppEnv } from "../types"

// Números da tela inicial, direto do D1. Gasto conta só job completed/saving/saved
// (failed, nsfw e canceled são devolvidos pela Higgsfield).
const SPENT_STATUSES = "('completed','saving','saved')"
const ACTIVE_STATUSES = "('submitting','queued','in_progress','saving')"

export const stats = new Hono<AppEnv>().get("/", async (c) => {
  const now = new Date()
  // Dia e mês no fuso de São Paulo (UTC-3, sem horário de verão desde 2019).
  const offsetMs = 3 * 60 * 60 * 1000
  const local = new Date(now.getTime() - offsetMs)
  const dayStart = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) + offsetMs
  const monthStart = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) + offsetMs

  const db = c.env.DB
  const [queue, spend, settings, totals] = await db.batch([
    db.prepare(
      `SELECT
         SUM(CASE WHEN status IN ${ACTIVE_STATUSES} THEN 1 ELSE 0 END) AS active,
         SUM(CASE WHEN status = 'waiting_slot' THEN 1 ELSE 0 END) AS waiting
       FROM jobs`,
    ),
    db
      .prepare(
        `SELECT
           COALESCE(SUM(CASE WHEN completed_at >= ?1 THEN estimated_cost_usd END), 0) AS day,
           COALESCE(SUM(CASE WHEN completed_at >= ?2 THEN estimated_cost_usd END), 0) AS month
         FROM jobs WHERE status IN ${SPENT_STATUSES}`,
      )
      .bind(dayStart, monthStart),
    db.prepare(
      `SELECT key, value FROM settings
       WHERE key IN ('limite_diario_usd','limite_mensal_usd','concorrencia_max','cotacao_brl')`,
    ),
    db.prepare(`SELECT COUNT(*) AS saved FROM jobs WHERE status = 'saved'`),
  ])

  const q = (queue.results[0] ?? {}) as { active: number | null; waiting: number | null }
  const s = (spend.results[0] ?? {}) as { day: number; month: number }
  const cfg = Object.fromEntries(
    (settings.results as { key: string; value: string }[]).map((r) => [r.key, Number(JSON.parse(r.value))]),
  )
  const t = (totals.results[0] ?? {}) as { saved: number }

  return c.json({
    queue: { active: q.active ?? 0, waiting: q.waiting ?? 0, concurrency: cfg.concorrencia_max ?? 4 },
    spend: {
      dayUsd: s.day,
      monthUsd: s.month,
      dayLimitUsd: cfg.limite_diario_usd ?? null,
      monthLimitUsd: cfg.limite_mensal_usd ?? null,
      brlRate: cfg.cotacao_brl ?? null,
    },
    gallery: { saved: t.saved },
  })
})
