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
import { estimate } from "../lib/higgsfield"
import type { AppEnv } from "../types"

const Body = z.object({
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

// A estimativa só valida o formato das URLs, não baixa nada — um placeholder basta
// enquanto o usuário ainda não subiu a mídia.
const IMG = "https://example.com/mise-ia/estimativa.png"
const VID = "https://example.com/mise-ia/estimativa.mp4"
// Preset público do catálogo do Restyle (13/10/2026), usado só se nenhum estiver escolhido.
const ANY_PRESET = "c2143317-f28d-4c3c-a0b8-39bd547e08a7"

function hfBody(i: EstimateInput, endpoint: string): Record<string, unknown> {
  const prompt = "estimativa de custo"
  const common = { resolution: i.resolution }
  if (endpoint.startsWith("bytedance/seedance-2.5/")) {
    const base = { ...common, bitrate_mode: "high", generate_audio: i.audio }
    if (endpoint.endsWith("text-to-video")) return { ...base, prompt, duration: i.duration, aspect_ratio: i.aspect }
    if (endpoint.endsWith("image-to-video")) return { ...base, image_url: IMG, duration: i.duration }
    if (endpoint.endsWith("reference-to-video"))
      return { ...base, prompt, duration: i.duration, aspect_ratio: i.aspect, image_urls: [IMG], ...(i.refVideoSec ? { video_urls: [VID] } : {}) }
    if (endpoint.endsWith("video-edit")) return { ...base, prompt, video_url: VID }
    if (endpoint.endsWith("video-extend")) return { ...base, prompt, video_url: VID, duration: i.duration }
  }
  if (endpoint.includes("/genjutsu/restyle/")) return { ...common, video_url: VID, preset_id: i.presetId ?? ANY_PRESET }
  if (endpoint.includes("/genjutsu/")) return { ...common, video_url: VID, image_urls: [IMG] }
  if (endpoint.startsWith("higgsfield/cinema-studio/")) return { ...common, prompt, duration: i.duration, aspect_ratio: i.aspect }
  if (endpoint.startsWith("kling-video/"))
    return endpoint.endsWith("image-to-video") ? { prompt, image_url: IMG, duration: i.duration } : { prompt, duration: i.duration, aspect_ratio: i.aspect }
  return { prompt }
}

// As taxas por segundo só mudam quando a Higgsfield muda a tabela: 10 min de cache por endpoint.
const rateCache = new Map<string, { rates: Partial<Record<Res, number>>; at: number }>()
const RATE_TTL = 10 * 60 * 1000

export const estimateRoute = new Hono<AppEnv>().post("/", async (c) => {
  const parsed = Body.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return c.json({ error: "parâmetros inválidos" }, 400)
  const input = parsed.data
  const ep = endpointFor(input.modeId, input.model)
  if (!ep) return c.json<EstimateResult>({ perTake: null, total: null, source: "indisponivel", basis: "modelo sem endpoint conhecido" })

  // Fórmula com taxa: usa o cache quando dá, senão pergunta à API.
  if (ep.kind !== "exact") {
    const cached = rateCache.get(ep.endpoint)
    let rates = cached && Date.now() - cached.at < RATE_TTL ? cached.rates : null
    if (!rates) {
      try {
        const est = await estimate(c.env.HF_CREDENTIALS, ep.endpoint, hfBody(input, ep.endpoint))
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
      if (perTake !== null) {
        return c.json<EstimateResult>({ perTake, total: perTake * input.takes, source: "api-taxa", basis: describe(input, ep.kind, rates) })
      }
      return c.json<EstimateResult>({
        perTake: null,
        total: null,
        source: "indisponivel",
        basis: ep.kind === "genjutsu" || ep.kind === "seedance-src" ? "envie o vídeo de origem pra calcular" : "resolução sem taxa publicada",
      })
    }
    return c.json(tableEstimate(input))
  }

  // Valor exato: depende dos parâmetros, então pergunta toda vez (o front faz debounce).
  try {
    const est = await estimate(c.env.HF_CREDENTIALS, ep.endpoint, hfBody(input, ep.endpoint))
    if ("usd" in est && !Number.isNaN(Number(est.usd))) {
      const perTake = Number(est.usd)
      return c.json<EstimateResult>({ perTake, total: perTake * input.takes, source: "api", basis: describe(input, "exact") })
    }
  } catch {
    // cai na tabela local
  }
  return c.json(tableEstimate(input))
})
