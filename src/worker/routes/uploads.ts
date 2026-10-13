import { Hono } from "hono"
import { z } from "zod"
import { generateUploadUrl, HiggsfieldError, restylePresets } from "../lib/higgsfield"
import type { AppEnv } from "../types"

// Tipos aceitos pela Higgsfield (docs: File uploads). O navegador já valida antes;
// aqui é a segunda trava, pra nunca pedir URL de algo que a API vai recusar.
const KINDS = {
  "image/jpeg": "image",
  "image/jpg": "image",
  "image/png": "image",
  "image/webp": "image",
  "image/gif": "image",
  "audio/wav": "audio",
  "audio/x-wav": "audio",
  "video/mp4": "video",
} as const

const MiB = 1024 * 1024
// Restyle aceita vídeo de até 200 MiB e imagem de até 64 MiB; usamos isso como teto geral.
const MAX_BYTES = { image: 64 * MiB, audio: 64 * MiB, video: 200 * MiB }

const Body = z.object({
  content_type: z.enum(Object.keys(KINDS) as [keyof typeof KINDS, ...(keyof typeof KINDS)[]]),
  bytes: z.number().int().positive(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  duration_s: z.number().positive().optional(),
})

function hfErrorResponse(e: unknown) {
  if (e instanceof HiggsfieldError) {
    return { error: e.status === 401 ? "credenciais da Higgsfield inválidas" : e.message, status: e.status || 502 }
  }
  return { error: "falha de rede ao falar com a Higgsfield", status: 502 }
}

export const uploads = new Hono<AppEnv>()
  /** Pede a URL presignada e registra o asset. O arquivo NÃO passa pelo Worker. */
  .post("/", async (c) => {
    const parsed = Body.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return c.json({ error: "tipo de arquivo ou metadados inválidos" }, 400)
    const { content_type, bytes, width, height, duration_s } = parsed.data
    const kind = KINDS[content_type]
    if (bytes > MAX_BYTES[kind]) {
      return c.json({ error: `arquivo grande demais (máx. ${MAX_BYTES[kind] / MiB} MiB para ${kind})` }, 413)
    }

    let ticket
    try {
      ticket = await generateUploadUrl(c.env.HF_CREDENTIALS, content_type)
    } catch (e) {
      const { error, status } = hfErrorResponse(e)
      return c.json({ error }, status >= 500 || status === 0 ? 502 : 400)
    }

    const id = crypto.randomUUID()
    await c.env.DB.prepare(
      `INSERT INTO assets (id, kind, r2_key, hf_public_url, mime, bytes, width, height, duration_s, source_job_id, created_at)
       VALUES (?1, ?2, NULL, ?3, ?4, ?5, ?6, ?7, ?8, NULL, ?9)`,
    )
      .bind(id, kind, ticket.public_url, content_type, bytes, width ?? null, height ?? null, duration_s ?? null, Date.now())
      .run()

    return c.json({ id, upload_url: ticket.upload_url, upload_headers: ticket.upload_headers, public_url: ticket.public_url })
  })

export const genjutsu = new Hono<AppEnv>()
  /** Catálogo de estilos do Restyle (com imagem de preview). Cacheado 10 min na borda. */
  .get("/presets", async (c) => {
    try {
      const items = await restylePresets(c.env.HF_CREDENTIALS)
      c.header("Cache-Control", "private, max-age=600")
      return c.json({ items })
    } catch (e) {
      const { error } = hfErrorResponse(e)
      return c.json({ error }, 502)
    }
  })
