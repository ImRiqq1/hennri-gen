import { Hono } from "hono"
import { z } from "zod"
import {
  computePerTake,
  describe,
  endpointFor,
  parseRates,
  tableEstimate,
  type EstimateInput,
  type EstimateResult,
  type Res,
} from "../../shared/pricing"
import { estimateRequest } from "../../shared/generation"
import { estimate, HiggsfieldError } from "../lib/higgsfield"
import type { AppEnv } from "../types"

export const EstimateBody = z.object({
  modeId: z.string(),
  model: z.string(),
  resolution: z.string(),
  duration: z.number().int().min(1).max(60),
  aspect: z.string(),
  audio: z.boolean(),
  takes: z.number().int().min(1).max(4),
  sourceVideoSec: z.number().positive().optional(),
  refVideoSec: z.number().nonnegative().optional(),
  presetId: z.string().uuid().optional(),
})

function hfBody(i: EstimateInput) {
  const built = estimateRequest(i)
  return "error" in built ? {} : built.body
}

// As taxas por segundo só mudam quando a Higgsfield muda a tabela: 10 min de cache por endpoint.
const rateCache = new Map<string, { rates: Partial<Record<Res, number>>; at: number }>()
const RATE_TTL = 10 * 60 * 1000

/**
 * Estimativa de um pedido (usada pela rota e pelo envio de jobs). Pra Seedance/Genjutsu/Cinema,
 * a API só dá a tabela cheia; aplica o desconto da conta guardado em settings.desconto_pct
 * (a API não expõe esse desconto — ver CLAUDE.md). Kling/Wan/MiniMax já vêm com desconto.
 */
export async function estimateFor(env: { HF_CREDENTIALS?: string; DB: D1Database }, input: EstimateInput): Promise<EstimateResult> {
  const r = await listEstimate(env.HF_CREDENTIALS, input)
  const ep = endpointFor(input.modeId, input.model)
  if (!ep || ep.kind === "exact" || r.perTake === null || r.total === null) return r
  const family = ep.kind === "seedance-src" ? "seedance" : ep.kind
  const row = await env.DB.prepare(`SELECT value FROM settings WHERE key = 'desconto_pct'`).first<{ value: string }>()
  const pct = Math.min(95, Math.max(0, Number((row ? JSON.parse(row.value) : {})[family] ?? 0)))
  if (!pct) return r
  const k = 1 - pct / 100
  return { ...r, perTake: r.perTake * k, total: r.total * k, basis: `${r.basis} · −${pct}% desconto da conta` }
}

async function listEstimate(credentials: string | undefined, input: EstimateInput): Promise<EstimateResult> {
  const ep = endpointFor(input.modeId, input.model)
  if (!ep) return { perTake: null, total: null, source: "indisponivel", basis: "modelo sem endpoint conhecido" }

  // Fórmula com taxa: usa o cache quando dá, senão pergunta à API.
  if (ep.kind !== "exact") {
    const cached = rateCache.get(ep.endpoint)
    let rates = cached && Date.now() - cached.at < RATE_TTL ? cached.rates : null
    if (!rates) {
      try {
        const est = await estimate(credentials, ep.endpoint, hfBody(input))
        if ("pricing_description" in est) {
          const r = parseRates(est.pricing_description)
          if (Object.keys(r).length) {
            rates = r
            rateCache.set(ep.endpoint, { rates: r, at: Date.now() })
          }
        }
      } catch {
        // cai na tabela local
      }
    }
    if (rates) {
      const perTake = computePerTake(input, ep.kind, rates)
      if (perTake !== null) return { perTake, total: perTake * input.takes, source: "api-taxa", basis: describe(input, ep.kind, rates) }
      return {
        perTake: null,
        total: null,
        source: "indisponivel",
        basis: ep.kind === "genjutsu" || ep.kind === "seedance-src" ? "envie o vídeo de origem pra calcular" : "resolução sem taxa publicada",
      }
    }
    return tableEstimate(input)
  }

  // Valor exato: depende dos parâmetros, então pergunta toda vez (o front faz debounce).
  let why = "API sem valor"
  try {
    const est = await estimate(credentials, ep.endpoint, hfBody(input))
    if ("usd" in est && !Number.isNaN(Number(est.usd))) {
      const perTake = Number(est.usd)
      return { perTake, total: perTake * input.takes, source: "api", basis: describe(input, "exact") }
    }
  } catch (e) {
    // 409/423/503 = modelo indisponível agora na Higgsfield; o envio também vai falhar
    why = e instanceof HiggsfieldError ? `Higgsfield ${e.status}: ${e.message}` : "falha de rede"
  }
  const fb = tableEstimate(input)
  return { ...fb, basis: `${fb.source === "tabela" ? "tabela local aproximada" : fb.basis} · ${why}` }
}

export const estimateRoute = new Hono<AppEnv>().post("/", async (c) => {
  const parsed = EstimateBody.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return c.json({ error: "parâmetros inválidos" }, 400)
  return c.json<EstimateResult>(await estimateFor(c.env, parsed.data))
})
