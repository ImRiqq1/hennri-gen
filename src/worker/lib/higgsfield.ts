// Cliente da Higgsfield API — só no Worker. A credencial nunca sai daqui:
// não vai em resposta, em erro nem em log.

export const HF_BASE_URL = "https://api.higgsfield.ai"

export class HiggsfieldError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly correlationId: string | null,
    readonly detail: unknown,
  ) {
    super(message)
  }
}

function authHeader(credentials: string | undefined) {
  if (!credentials || !credentials.includes(":")) {
    throw new HiggsfieldError("HF_CREDENTIALS ausente ou fora do formato id:secret", 0, null, null)
  }
  return `Key ${credentials}`
}

async function hfFetch(credentials: string | undefined, path: string, init: RequestInit = {}) {
  const res = await fetch(`${HF_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: authHeader(credentials),
      "Content-Type": "application/json",
      ...init.headers,
    },
  })
  const correlationId = res.headers.get("X-Correlation-ID")
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    const detail = (body as { detail?: unknown } | null)?.detail ?? body
    const message = typeof detail === "string" ? detail : `HTTP ${res.status}`
    throw new HiggsfieldError(message, res.status, correlationId, detail)
  }
  return { body, correlationId }
}

/**
 * POST /estimate/<endpoint> — mesmo corpo da geração; não cobra nada.
 * Atenção (confirmado em 13/10/2026): nem todo modelo devolve número. O SOUL V2 devolve
 * `{ credits, usd }`; o Seedance 2.5 devolve `{ type: "description", pricing_description }`,
 * uma tabela em texto. Quem chama decide como transformar isso em valor.
 */
export type Estimate = { credits: string; usd: string } | { type: "description"; pricing_description: string }

export async function estimate(credentials: string | undefined, endpoint: string, input: unknown) {
  const { body } = await hfFetch(credentials, `/estimate/${endpoint}`, {
    method: "POST",
    body: JSON.stringify(input),
  })
  return body as Estimate
}

export type UploadTicket = {
  public_url: string
  upload_url: string
  content_type: string
  upload_headers: Record<string, string>
}

/** POST /files/generate-upload-url — URL presignada (expira em 1 h). O PUT vai direto do navegador. */
export async function generateUploadUrl(credentials: string | undefined, contentType: string) {
  const { body } = await hfFetch(credentials, "/files/generate-upload-url", {
    method: "POST",
    body: JSON.stringify({ content_type: contentType }),
  })
  return body as UploadTicket
}

export type RestylePreset = { id: string; name: string; preview_url: string }

/** GET /models/higgsfield/genjutsu/restyle/v1.0/presets — catálogo atual de estilos do Restyle. */
export async function restylePresets(credentials: string | undefined) {
  const { body } = await hfFetch(credentials, "/models/higgsfield/genjutsu/restyle/v1.0/presets")
  return ((body as { items?: RestylePreset[] } | null)?.items ?? []) as RestylePreset[]
}
