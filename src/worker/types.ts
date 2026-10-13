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
}

export type AppEnv = { Bindings: Env }
