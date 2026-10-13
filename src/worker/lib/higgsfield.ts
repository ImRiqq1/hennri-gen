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

export type Estimate = { credits: string; usd: string }

/** POST /estimate/<endpoint> — mesmo corpo da geração; não cobra nada. */
export async function estimate(credentials: string | undefined, endpoint: string, input: unknown) {
  const { body } = await hfFetch(credentials, `/estimate/${endpoint}`, {
    method: "POST",
    body: JSON.stringify(input),
  })
  return body as Estimate
}
