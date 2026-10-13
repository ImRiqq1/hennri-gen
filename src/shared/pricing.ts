// Preço por job. Fonte de verdade: POST /estimate/<endpoint> da Higgsfield.
// Conferido em 13/10/2026:
//  - Kling 3.0, SOUL V2 (e outros) devolvem { usd } exato  → usamos direto.
//  - Seedance 2.5, Genjutsu e Cinema Studio devolvem só texto com a tabela
//    → extraímos as taxas do texto e aplicamos a fórmula abaixo.
//  - Se a API falhar ou o texto mudar de formato → tabela local (marcada "estimado").

export type Res = "480p" | "720p" | "1080p"

export type EstimateInput = {
  modeId: string
  model: string
  resolution: string
  duration: number
  aspect: string
  audio: boolean
  takes: number
  /** duração do vídeo de origem (Genjutsu, Editar, Estender), em segundos */
  sourceVideoSec?: number
  /** soma das durações dos vídeos de referência (Referências, Cinema) */
  refVideoSec?: number
  /** Restyle */
  presetId?: string
}

export type EstimateResult = {
  perTake: number | null
  total: number | null
  /** api = valor exato da API · api-taxa = taxa atual da API + fórmula · tabela = fallback local */
  source: "api" | "api-taxa" | "tabela" | "indisponivel"
  /** como o valor foi composto, pra mostrar no tooltip */
  basis: string
}

type Kind = "seedance" | "seedance-src" | "genjutsu" | "cinema" | "exact"

const ENDPOINTS: Record<string, Record<string, { endpoint: string; kind: Kind }>> = {
  t2v: {
    "Seedance 2.5": { endpoint: "bytedance/seedance-2.5/text-to-video", kind: "seedance" },
    "Kling 3.0": { endpoint: "kling-video/v3.0/std/text-to-video", kind: "exact" },
  },
  i2v: {
    "Seedance 2.5": { endpoint: "bytedance/seedance-2.5/image-to-video", kind: "seedance" },
    "Kling 3.0": { endpoint: "kling-video/v3.0/std/image-to-video", kind: "exact" },
  },
  ref: { "Seedance 2.5": { endpoint: "bytedance/seedance-2.5/reference-to-video", kind: "seedance" } },
  edit: { "Seedance 2.5": { endpoint: "bytedance/seedance-2.5/video-edit", kind: "seedance-src" } },
  extend: { "Seedance 2.5": { endpoint: "bytedance/seedance-2.5/video-extend", kind: "seedance-src" } },
  genjutsu: {
    "Motion transfer": { endpoint: "higgsfield/genjutsu/motion-transfer/v1.0", kind: "genjutsu" },
    "Object swap": { endpoint: "higgsfield/genjutsu/object-swap/v1.0", kind: "genjutsu" },
    Restyle: { endpoint: "higgsfield/genjutsu/restyle/v1.0", kind: "genjutsu" },
  },
  cinema: { "Cinema Studio 4.0": { endpoint: "higgsfield/cinema-studio/4.0", kind: "cinema" } },
  image: {
    "SOUL V2": { endpoint: "higgsfield-ai/soul/v2/standard", kind: "exact" },
    "Grok Image 2.0": { endpoint: "xai/grok-imagine-image-2.0", kind: "exact" },
    "Qwen Image 3": { endpoint: "alibaba/qwen-image-3/text-to-image", kind: "exact" },
  },
}

export function endpointFor(modeId: string, model: string) {
  return ENDPOINTS[modeId]?.[model] ?? null
}

// Tabela local (US$/s, saída 16:9) — fallback. Valores lidos das descrições da API em 13/10/2026.
const TABLE: Record<Exclude<Kind, "exact">, Partial<Record<Res, number>>> = {
  seedance: { "480p": 0.2056, "720p": 0.4622, "1080p": 1.1372 },
  // entrada de vídeo: 0,6× a taxa, cobrando entrada + saída
  "seedance-src": { "480p": 0.1234, "720p": 0.2773, "1080p": 0.6823 },
  genjutsu: { "480p": 0.318, "720p": 0.681, "1080p": 1.632 },
  cinema: { "480p": 0.2056, "720p": 0.4622 },
}
const EXACT_FALLBACK: Record<string, number | undefined> = {
  // US$/s publicado em set/2026 (blog Higgsfield) — só se a API não responder
  "Kling 3.0": 0.112,
}

// pixels de saída 16:9 por resolução (pra converter taxa por token em taxa por segundo)
const PIXELS: Record<Res, number> = { "480p": 854 * 480, "720p": 1280 * 720, "1080p": 1920 * 1080 }

/** Extrai US$/s por resolução de um pricing_description. Ignora taxas por mil tokens (< 0,05). */
export function parseRates(text: string): Partial<Record<Res, number>> {
  const out: Partial<Record<Res, number>> = {}
  const re = /\$([\d.]+)(?:\s+per second(?:\s+of [a-z ]+?)?)?\s+at\s+(480p|720p|1080p)(?!\s+or)/gi
  for (const m of text.matchAll(re)) {
    const v = Number(m[1])
    const r = m[2].toLowerCase() as Res
    if (v > 0.05 && out[r] === undefined) out[r] = v
  }
  if (Object.keys(out).length === 0) {
    // Cinema Studio: só a taxa por mil tokens → converte com a contagem de pixels
    const tok = text.match(/\$([\d.]+)\s+without video input/i)
    if (tok) {
      const perK = Number(tok[1])
      for (const r of Object.keys(PIXELS) as Res[]) out[r] = (PIXELS[r] * 24) / 1024 / 1000 * perK
    }
  }
  return out
}

const clampSrc = (s: number | undefined) => Math.min(Math.max(s ?? 0, 0), 30)

/** Aplica a fórmula do tipo de modelo com as taxas dadas. null = falta dado (ex.: sem vídeo de origem). */
export function computePerTake(input: EstimateInput, kind: Exclude<Kind, "exact">, rates: Partial<Record<Res, number>>) {
  const rate = rates[input.resolution as Res]
  if (rate === undefined) return null
  const d = input.duration
  switch (kind) {
    case "seedance":
    case "cinema": {
      const refV = clampSrc(input.refVideoSec)
      // com vídeo de referência: 0,6× a taxa sobre (entrada + gerado)
      return refV > 0 ? rate * 0.6 * (refV + d) : rate * d
    }
    case "seedance-src": {
      if (!input.sourceVideoSec) return null
      const src = clampSrc(input.sourceVideoSec)
      const gen = input.modeId === "edit" ? Math.max(src, 4) : d
      return rate * (src + gen)
    }
    case "genjutsu": {
      if (!input.sourceVideoSec) return null
      return rate * Math.ceil(clampSrc(input.sourceVideoSec))
    }
  }
}

export function describe(input: EstimateInput, kind: Kind, rates?: Partial<Record<Res, number>>) {
  const rate = rates?.[input.resolution as Res]
  const r = rate !== undefined ? `US$ ${rate.toFixed(4).replace(".", ",")}/s` : ""
  switch (kind) {
    case "genjutsu":
      return `${Math.ceil(clampSrc(input.sourceVideoSec))} s do vídeo de origem × ${r}`
    case "seedance-src":
      return `(origem + gerado) × ${r}`
    case "exact":
      return "valor exato da API"
    default:
      return clampSrc(input.refVideoSec) > 0 ? `(${input.duration} s + vídeos de ref.) × 0,6 × ${r}` : `${input.duration} s × ${r}`
  }
}

export function tableEstimate(input: EstimateInput): EstimateResult {
  const ep = endpointFor(input.modeId, input.model)
  if (!ep) return { perTake: null, total: null, source: "indisponivel", basis: "modelo sem endpoint conhecido" }
  let perTake: number | null = null
  if (ep.kind === "exact") {
    const ps = EXACT_FALLBACK[input.model]
    perTake = ps !== undefined ? ps * input.duration : null
  } else {
    perTake = computePerTake(input, ep.kind, TABLE[ep.kind])
  }
  return {
    perTake,
    total: perTake === null ? null : perTake * input.takes,
    source: perTake === null ? "indisponivel" : "tabela",
    basis: perTake === null ? "sem dado suficiente" : describe(input, ep.kind, ep.kind === "exact" ? undefined : TABLE[ep.kind]),
  }
}

export function kindOfEndpoint(modeId: string, model: string) {
  return endpointFor(modeId, model)?.kind ?? null
}
