import { Hono } from "hono"
import { recoverAll, saveOutput } from "./lib/jobs"
import { requireAccess } from "./middleware/access"
import { estimateRoute } from "./routes/estimate"
import { health } from "./routes/health"
import { files, jobs } from "./routes/jobs"
import { stats } from "./routes/stats"
import { genjutsu, uploads } from "./routes/uploads"
import { webhooks } from "./routes/webhooks"
import type { AppEnv, Env, SaveMessage } from "./types"

// Só /api/* chega aqui (run_worker_first); o resto é servido direto pelo binding de assets,
// protegido pelo Access na borda.
const app = new Hono<AppEnv>().basePath("/api")

app.use("*", requireAccess) // pula /api/webhooks/* (ver middleware/access.ts)
app.route("/webhooks", webhooks)
app.route("/health", health)
app.route("/stats", stats)
app.route("/uploads", uploads)
app.route("/genjutsu", genjutsu)
app.route("/estimate", estimateRoute)
app.route("/jobs", jobs)
app.route("/files", files)

app.notFound((c) => c.json({ error: "rota não encontrada" }, 404))
app.onError((err, c) => {
  console.error("erro não tratado:", err.message)
  return c.json({ error: "erro interno" }, 500)
})

export default {
  fetch: app.fetch,

  /** Cron (a cada minuto): recupera jobs parados e libera vagas se um webhook se perder. */
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    const n = await recoverAll(env, ctx)
    if (n) console.log(`cron: ${n} job(s) revisados`)
  },

  /** Queue: copia resultados pro R2 fora da requisição. Falha → a Queue tenta de novo. */
  async queue(batch: MessageBatch<SaveMessage>, env: Env, ctx: ExecutionContext) {
    for (const msg of batch.messages) {
      await saveOutput(env, msg.body.id, ctx)
      const row = await env.DB.prepare(`SELECT status FROM jobs WHERE id = ?1`).bind(msg.body.id).first<{ status: string }>()
      if (row?.status === "completed") msg.retry({ delaySeconds: 30 })
      else msg.ack()
    }
  },
} satisfies ExportedHandler<Env, SaveMessage>
