export type Env = {
  DB: D1Database
  FILES: R2Bucket
  ASSETS: Fetcher
  /** "id:secret" — secret do Worker. Nunca vai pro front nem pra log. */
  HF_CREDENTIALS?: string
  ACCESS_TEAM_DOMAIN: string
  ACCESS_AUD: string
  /** Só no .dev.vars: pula a checagem do Access no wrangler dev. */
  DEV_BYPASS_ACCESS?: string
  /** Fila que copia resultados pro R2 fora da requisição (fase 3). Sem ela, usa waitUntil. */
  SAVE_QUEUE?: Queue<SaveMessage>
  /** Secret: token na query do webhook (/api/webhooks/higgsfield?token=…). */
  WEBHOOK_TOKEN?: string
  /** URL pública do site (https://gen.hennri.com). Vazia no dev: sem webhook, só polling/cron. */
  PUBLIC_URL?: string
}

export type SaveMessage = { id: string }

export type AppEnv = { Bindings: Env }
