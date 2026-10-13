import { Hono } from "hono"
import { z } from "zod"
import type { AppEnv } from "../types"

// Fase 4: configurações, projetos, presets e custos.

// ---------------------------------------------------------------- configurações

const SettingsSchema = z.object({
  limite_diario_usd: z.number().min(0).max(10_000),
  limite_mensal_usd: z.number().min(0).max(100_000),
  confirmacao_acima_usd: z.number().min(0).max(10_000),
  concorrencia_max: z.number().int().min(1).max(20),
  cotacao_brl: z.number().min(0.1).max(100),
  padrao_resolucao: z.enum(["480p", "720p", "1080p"]),
  padrao_proporcao: z.enum(["16:9", "4:3", "1:1", "3:4", "9:16", "21:9"]),
  padrao_duracao: z.number().int().min(4).max(30),
  padrao_audio: z.boolean(),
})
export type Settings = z.infer<typeof SettingsSchema>

async function readSettings(db: D1Database) {
  const rows = await db.prepare("SELECT key, value FROM settings").all<{ key: string; value: string }>()
  return Object.fromEntries(rows.results.map((r) => [r.key, JSON.parse(r.value)])) as Partial<Settings>
}

export const settings = new Hono<AppEnv>()
  .get("/", async (c) => c.json({ settings: await readSettings(c.env.DB) }))
  .put("/", async (c) => {
    const parsed = SettingsSchema.partial().safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return c.json({ error: "valor inválido", issues: parsed.error.issues.map((i) => i.path.join(".")) }, 400)
    const entries = Object.entries(parsed.data)
    if (!entries.length) return c.json({ error: "nada pra salvar" }, 400)
    if (parsed.data.limite_diario_usd !== undefined && parsed.data.limite_mensal_usd !== undefined && parsed.data.limite_diario_usd > parsed.data.limite_mensal_usd) {
      return c.json({ error: "o limite diário não pode passar do mensal" }, 400)
    }
    await c.env.DB.batch(
      entries.map(([k, v]) =>
        c.env.DB.prepare("INSERT INTO settings (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(k, JSON.stringify(v)),
      ),
    )
    return c.json({ settings: await readSettings(c.env.DB) })
  })

// ---------------------------------------------------------------- projetos

const SPENT = "('completed','saving','saved')"
const ProjectBody = z.object({
  name: z.string().trim().min(1).max(60),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullable()
    .optional(),
  archived: z.boolean().optional(),
})

export const projects = new Hono<AppEnv>()
  .get("/", async (c) => {
    const rows = await c.env.DB.prepare(
      `SELECT p.id, p.name, p.color, p.archived, p.created_at,
              COUNT(j.id) AS jobs,
              COALESCE(SUM(CASE WHEN j.status IN ${SPENT} THEN j.estimated_cost_usd END), 0) AS spent_usd
       FROM projects p LEFT JOIN jobs j ON j.project_id = p.id
       GROUP BY p.id ORDER BY p.archived, (p.id = 'sem-projeto') DESC, p.created_at DESC`,
    ).all()
    return c.json({ projects: rows.results.map((r) => ({ ...r, archived: !!r.archived })) })
  })
  .post("/", async (c) => {
    const p = ProjectBody.safeParse(await c.req.json().catch(() => null))
    if (!p.success) return c.json({ error: "nome inválido" }, 400)
    const id = crypto.randomUUID()
    await c.env.DB.prepare("INSERT INTO projects (id, name, color, archived, created_at) VALUES (?1, ?2, ?3, 0, ?4)")
      .bind(id, p.data.name, p.data.color ?? null, Date.now())
      .run()
    return c.json({ id }, 201)
  })
  .patch("/:id", async (c) => {
    const id = c.req.param("id")
    const p = ProjectBody.partial().safeParse(await c.req.json().catch(() => null))
    if (!p.success) return c.json({ error: "dados inválidos" }, 400)
    if (id === "sem-projeto" && p.data.archived) return c.json({ error: "o projeto padrão não pode ser arquivado" }, 400)
    const sets: string[] = []
    const args: unknown[] = [id]
    for (const [k, v] of Object.entries(p.data)) {
      args.push(k === "archived" ? (v ? 1 : 0) : v)
      sets.push(`${k} = ?${args.length}`)
    }
    if (!sets.length) return c.json({ error: "nada pra salvar" }, 400)
    const r = await c.env.DB.prepare(`UPDATE projects SET ${sets.join(", ")} WHERE id = ?1`).bind(...args).run()
    return r.meta.changes ? c.json({ ok: true }) : c.json({ error: "projeto não encontrado" }, 404)
  })

// ---------------------------------------------------------------- presets

const PresetBody = z.object({
  name: z.string().trim().min(1).max(80),
  project_id: z.string().nullable().optional(),
  model_id: z.string().min(1),
  mode: z.string().min(1),
  params: z.record(z.string(), z.unknown()),
  prompt_template: z.string().max(10_000).nullable().optional(),
})

export const presets = new Hono<AppEnv>()
  .get("/", async (c) => {
    const rows = await c.env.DB.prepare(
      `SELECT pr.*, p.name AS project_name, p.color AS project_color
       FROM presets pr LEFT JOIN projects p ON p.id = pr.project_id ORDER BY pr.created_at DESC`,
    ).all<Record<string, unknown> & { params_json: string }>()
    return c.json({ presets: rows.results.map(({ params_json, ...r }) => ({ ...r, params: JSON.parse(params_json || "{}") })) })
  })
  .post("/", async (c) => {
    const p = PresetBody.safeParse(await c.req.json().catch(() => null))
    if (!p.success) return c.json({ error: "preset inválido" }, 400)
    const id = crypto.randomUUID()
    await c.env.DB.prepare(
      "INSERT INTO presets (id, name, project_id, model_id, mode, params_json, prompt_template, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
    )
      .bind(id, p.data.name, p.data.project_id ?? null, p.data.model_id, p.data.mode, JSON.stringify(p.data.params), p.data.prompt_template ?? null, Date.now())
      .run()
    return c.json({ id }, 201)
  })
  .patch("/:id", async (c) => {
    const p = PresetBody.partial().safeParse(await c.req.json().catch(() => null))
    if (!p.success) return c.json({ error: "preset inválido" }, 400)
    const map: Record<string, unknown> = { ...p.data }
    if (map.params) {
      map.params_json = JSON.stringify(map.params)
      delete map.params
    }
    const sets: string[] = []
    const args: unknown[] = [c.req.param("id")]
    for (const [k, v] of Object.entries(map)) {
      args.push(v ?? null)
      sets.push(`${k} = ?${args.length}`)
    }
    if (!sets.length) return c.json({ error: "nada pra salvar" }, 400)
    const r = await c.env.DB.prepare(`UPDATE presets SET ${sets.join(", ")} WHERE id = ?1`).bind(...args).run()
    return r.meta.changes ? c.json({ ok: true }) : c.json({ error: "preset não encontrado" }, 404)
  })
  .delete("/:id", async (c) => {
    // jobs que usaram o preset guardam o id; desliga a referência antes de apagar
    await c.env.DB.batch([
      c.env.DB.prepare("UPDATE jobs SET preset_id = NULL WHERE preset_id = ?1").bind(c.req.param("id")),
      c.env.DB.prepare("DELETE FROM presets WHERE id = ?1").bind(c.req.param("id")),
    ])
    return c.json({ ok: true })
  })

// ---------------------------------------------------------------- custos

const OFF = 3 * 60 * 60 * 1000 // São Paulo, UTC-3

function localDayStart(t: number) {
  const l = new Date(t - OFF)
  return Date.UTC(l.getUTCFullYear(), l.getUTCMonth(), l.getUTCDate()) + OFF
}

export const costs = new Hono<AppEnv>().get("/", async (c) => {
  const days = Math.min(Math.max(Number(c.req.query("days") ?? 30) || 30, 7), 90)
  const now = Date.now()
  const today = localDayStart(now)
  const from = today - (days - 1) * 86_400_000
  const l = new Date(now - OFF)
  const monthStart = Date.UTC(l.getUTCFullYear(), l.getUTCMonth(), 1) + OFF
  // semana começando na segunda
  const weekStart = today - ((l.getUTCDay() + 6) % 7) * 86_400_000
  const db = c.env.DB

  const [totals, byDay, byModel, byProject, cfg] = await db.batch([
    db
      .prepare(
        `SELECT
           COALESCE(SUM(CASE WHEN completed_at >= ?1 THEN estimated_cost_usd END), 0) AS day,
           COALESCE(SUM(CASE WHEN completed_at >= ?2 THEN estimated_cost_usd END), 0) AS week,
           COALESCE(SUM(CASE WHEN completed_at >= ?3 THEN estimated_cost_usd END), 0) AS month,
           COUNT(CASE WHEN completed_at >= ?3 THEN 1 END) AS month_jobs
         FROM jobs WHERE status IN ${SPENT}`,
      )
      .bind(today, weekStart, monthStart),
    db
      .prepare(
        `SELECT CAST((completed_at - ?1) / 86400000 AS INTEGER) AS d, SUM(estimated_cost_usd) AS usd, COUNT(*) AS n
         FROM jobs WHERE status IN ${SPENT} AND completed_at >= ?1 GROUP BY d`,
      )
      .bind(from),
    db
      .prepare(
        `SELECT model_id AS label, SUM(estimated_cost_usd) AS usd, COUNT(*) AS n
         FROM jobs WHERE status IN ${SPENT} AND completed_at >= ?1 GROUP BY model_id ORDER BY usd DESC`,
      )
      .bind(from),
    db
      .prepare(
        `SELECT p.id, p.name AS label, p.color, COALESCE(SUM(j.estimated_cost_usd), 0) AS usd, COUNT(j.id) AS n
         FROM jobs j JOIN projects p ON p.id = j.project_id
         WHERE j.status IN ${SPENT} AND j.completed_at >= ?1 GROUP BY p.id ORDER BY usd DESC`,
      )
      .bind(from),
    db.prepare(`SELECT key, value FROM settings WHERE key IN ('limite_diario_usd','limite_mensal_usd','cotacao_brl')`),
  ])

  const t = totals.results[0] as { day: number; week: number; month: number; month_jobs: number }
  const series = Array.from({ length: days }, (_, i) => ({ start: from + i * 86_400_000, usd: 0, n: 0 }))
  for (const r of byDay.results as { d: number; usd: number; n: number }[]) {
    if (series[r.d]) {
      series[r.d].usd = r.usd
      series[r.d].n = r.n
    }
  }
  const s = Object.fromEntries((cfg.results as { key: string; value: string }[]).map((r) => [r.key, Number(JSON.parse(r.value))]))
  return c.json({
    totals: { dayUsd: t.day, weekUsd: t.week, monthUsd: t.month, avgPerJobUsd: t.month_jobs ? t.month / t.month_jobs : null, monthJobs: t.month_jobs },
    limits: { dayUsd: s.limite_diario_usd ?? null, monthUsd: s.limite_mensal_usd ?? null, brlRate: s.cotacao_brl ?? null },
    series,
    byModel: byModel.results,
    byProject: byProject.results,
  })
})
