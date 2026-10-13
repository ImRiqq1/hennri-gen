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

// ---------------------------------------------------------------- geração

/** A credencial só pode ir pra api.higgsfield.ai — status_url/cancel_url vêm da API e são conferidas. */
function assertHfUrl(url: string) {
  const u = new URL(url)
  if (u.protocol !== "https:" || u.host !== new URL(HF_BASE_URL).host) {
    throw new HiggsfieldError(`URL fora da Higgsfield recusada: ${u.host}`, 0, null, null)
  }
  return u.toString()
}

export type SubmitResult = { request_id: string; status_url: string; cancel_url: string; status: string }

/**
 * POST /<endpoint> com Idempotency-Key. Reenviar com a mesma chave e o mesmo corpo devolve o
 * mesmo request (sem cobrar de novo); o status do recibo pode vir "queued" mesmo já terminado.
 */
export async function submit(
  credentials: string | undefined,
  endpoint: string,
  body: unknown,
  idempotencyKey: string,
  webhookUrl?: string,
) {
  const q = webhookUrl ? `?hf_webhook=${encodeURIComponent(webhookUrl)}` : ""
  const { body: res, correlationId } = await hfFetch(credentials, `/${endpoint}${q}`, {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
    body: JSON.stringify(body),
  })
  return { ...(res as SubmitResult), correlationId }
}

export type StatusResult = {
  status: string
  request_id: string
  error?: string | null
  video?: { url: string; content_type?: string }
  images?: { url: string; content_type?: string }[]
  audio?: { url: string }
}

export async function getStatus(credentials: string | undefined, statusUrl: string) {
  const res = await fetch(assertHfUrl(statusUrl), { headers: { Authorization: authHeader(credentials) } })
  const correlationId = res.headers.get("X-Correlation-ID")
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    const detail = (body as { detail?: unknown } | null)?.detail ?? body
    throw new HiggsfieldError(typeof detail === "string" ? detail : `HTTP ${res.status}`, res.status, correlationId, detail)
  }
  return body as StatusResult
}

/** 202 = cancelado (estava queued); 400 = já começou, não dá mais. */
export async function cancelRequest(credentials: string | undefined, cancelUrl: string) {
  const res = await fetch(assertHfUrl(cancelUrl), { method: "POST", headers: { Authorization: authHeader(credentials) } })
  return res.status
}
