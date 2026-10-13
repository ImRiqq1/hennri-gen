import { Hono } from "hono"
import { requireAccess } from "./middleware/access"
import { health } from "./routes/health"
import { stats } from "./routes/stats"
import { genjutsu, uploads } from "./routes/uploads"
import type { AppEnv } from "./types"

// Só /api/* chega aqui (run_worker_first); o resto é servido direto pelo binding de assets,
// protegido pelo Access na borda.
const app = new Hono<AppEnv>().basePath("/api")

app.use("*", requireAccess)
app.route("/health", health)
app.route("/stats", stats)
app.route("/uploads", uploads)
app.route("/genjutsu", genjutsu)

app.notFound((c) => c.json({ error: "rota não encontrada" }, 404))
app.onError((err, c) => {
  console.error("erro não tratado:", err.message)
  return c.json({ error: "erro interno" }, 500)
})

export default app
