// Registro de modelos: um item por (modo, modelo) com endpoint e limites do schema
// (docs.higgsfield.ai, conferido em 13/10/2026). O formulário do Criar se ajusta a isto —
// adicionar modelo = adicionar uma entrada aqui + o corpo em generation.ts.

export type ModelSpec = {
  endpoint: string
  tier: 1 | 2
  /** null = a duração segue a mídia de origem */
  duration: { min: number; max: number } | null
  /** rótulos mostrados; `send` diz se vai como `resolution` no corpo */
  resolutions: string[]
  sendResolution: boolean
  /** null = proporção segue a imagem/vídeo de origem */
  aspects: string[] | null
  audio: boolean
  promptRequired: boolean
  note?: string
}

const SEEDANCE_ASPECTS = ["16:9", "4:3", "1:1", "3:4", "9:16", "21:9"]
const KLING_ASPECTS = ["16:9", "9:16", "1:1"]
const KLING_DUR = { min: 3, max: 15 }
const SD_DUR = { min: 4, max: 30 }
const R3 = ["480p", "720p", "1080p"]

export const MODEL_SPECS: Record<string, Record<string, ModelSpec>> = {
  t2v: {
    "Seedance 2.5": { endpoint: "bytedance/seedance-2.5/text-to-video", tier: 1, duration: SD_DUR, resolutions: R3, sendResolution: true, aspects: SEEDANCE_ASPECTS, audio: true, promptRequired: true },
    "Kling 3.0 Std": { endpoint: "kling-video/v3.0/std/text-to-video", tier: 2, duration: KLING_DUR, resolutions: ["720p"], sendResolution: false, aspects: KLING_ASPECTS, audio: true, promptRequired: true },
    "Kling 3.0 Pro": { endpoint: "kling-video/v3.0/pro/text-to-video", tier: 2, duration: KLING_DUR, resolutions: ["1080p"], sendResolution: false, aspects: KLING_ASPECTS, audio: true, promptRequired: true },
    "Kling 3.0 4K": { endpoint: "kling-video/v3.0/4k/text-to-video", tier: 2, duration: KLING_DUR, resolutions: ["4K"], sendResolution: false, aspects: KLING_ASPECTS, audio: true, promptRequired: true },
    "Kling 3.0 Turbo": { endpoint: "kling-video/v3.0-turbo/text-to-video", tier: 2, duration: KLING_DUR, resolutions: ["720p", "1080p"], sendResolution: true, aspects: KLING_ASPECTS, audio: false, promptRequired: true },
    "Wan 3.0 Prime": { endpoint: "alibaba/wan-3.0-prime/text-to-video", tier: 2, duration: { min: 2, max: 30 }, resolutions: R3, sendResolution: true, aspects: ["16:9", "4:3", "1:1", "3:4", "9:16"], audio: true, promptRequired: true },
    "MiniMax H3": { endpoint: "minimax/h3/text-to-video", tier: 2, duration: { min: 5, max: 15 }, resolutions: ["2K"], sendResolution: false, aspects: ["21:9", "16:9", "4:3", "1:1", "3:4", "9:16"], audio: false, promptRequired: true },
  },
  i2v: {
    "Seedance 2.5": { endpoint: "bytedance/seedance-2.5/image-to-video", tier: 1, duration: SD_DUR, resolutions: R3, sendResolution: true, aspects: null, audio: true, promptRequired: false },
    "Kling 3.0 Std": { endpoint: "kling-video/v3.0/std/image-to-video", tier: 2, duration: KLING_DUR, resolutions: ["720p"], sendResolution: false, aspects: null, audio: true, promptRequired: false },
    "Kling 3.0 Pro": { endpoint: "kling-video/v3.0/pro/image-to-video", tier: 2, duration: KLING_DUR, resolutions: ["1080p"], sendResolution: false, aspects: null, audio: true, promptRequired: false },
    "Kling 3.0 4K": { endpoint: "kling-video/v3.0/4k/image-to-video", tier: 2, duration: KLING_DUR, resolutions: ["4K"], sendResolution: false, aspects: null, audio: true, promptRequired: false },
    "Kling 3.0 Turbo": { endpoint: "kling-video/v3.0-turbo/image-to-video", tier: 2, duration: KLING_DUR, resolutions: ["720p", "1080p"], sendResolution: true, aspects: null, audio: false, promptRequired: true, note: "sem último frame" },
    "Kling O3": { endpoint: "kling-video/o3/first-last-frame", tier: 2, duration: KLING_DUR, resolutions: ["720p", "1080p", "4K"], sendResolution: false, aspects: KLING_ASPECTS, audio: true, promptRequired: false },
    "Wan 3.0 Prime": { endpoint: "alibaba/wan-3.0-prime/image-to-video", tier: 2, duration: { min: 2, max: 30 }, resolutions: R3, sendResolution: true, aspects: null, audio: true, promptRequired: true },
    "MiniMax H3": { endpoint: "minimax/h3/image-to-video", tier: 2, duration: { min: 5, max: 15 }, resolutions: ["2K"], sendResolution: false, aspects: null, audio: false, promptRequired: true },
  },
  ref: {
    "Seedance 2.5": { endpoint: "bytedance/seedance-2.5/reference-to-video", tier: 1, duration: SD_DUR, resolutions: R3, sendResolution: true, aspects: SEEDANCE_ASPECTS, audio: true, promptRequired: true },
    "Kling O3": { endpoint: "kling-video/o3/image-reference", tier: 2, duration: KLING_DUR, resolutions: ["720p", "1080p", "4K"], sendResolution: false, aspects: KLING_ASPECTS, audio: true, promptRequired: true, note: "só imagens (até 7)" },
  },
  edit: { "Seedance 2.5": { endpoint: "bytedance/seedance-2.5/video-edit", tier: 1, duration: null, resolutions: R3, sendResolution: true, aspects: null, audio: true, promptRequired: true } },
  extend: { "Seedance 2.5": { endpoint: "bytedance/seedance-2.5/video-extend", tier: 1, duration: SD_DUR, resolutions: R3, sendResolution: true, aspects: null, audio: true, promptRequired: true } },
  genjutsu: {
    "Motion transfer": { endpoint: "higgsfield/genjutsu/motion-transfer/v1.0", tier: 1, duration: null, resolutions: R3, sendResolution: true, aspects: null, audio: false, promptRequired: false },
    "Object swap": { endpoint: "higgsfield/genjutsu/object-swap/v1.0", tier: 1, duration: null, resolutions: R3, sendResolution: true, aspects: null, audio: false, promptRequired: false },
    Restyle: { endpoint: "higgsfield/genjutsu/restyle/v1.0", tier: 1, duration: null, resolutions: R3, sendResolution: true, aspects: null, audio: false, promptRequired: false },
  },
  cinema: {
    "Cinema Studio 4.0": { endpoint: "higgsfield/cinema-studio/4.0", tier: 1, duration: SD_DUR, resolutions: ["480p", "720p"], sendResolution: true, aspects: SEEDANCE_ASPECTS, audio: false, promptRequired: true },
  },
  image: {
    "SOUL V2": { endpoint: "higgsfield-ai/soul/v2/standard", tier: 1, duration: null, resolutions: ["1K"], sendResolution: false, aspects: null, audio: false, promptRequired: true },
    "Grok Image 2.0": { endpoint: "xai/grok-imagine-image-2.0", tier: 1, duration: null, resolutions: ["1K"], sendResolution: false, aspects: null, audio: false, promptRequired: true },
    "Qwen Image 3": { endpoint: "alibaba/qwen-image-3/text-to-image", tier: 2, duration: null, resolutions: ["1K"], sendResolution: false, aspects: null, audio: false, promptRequired: true },
  },
}

export function specFor(modeId: string, model: string): ModelSpec | null {
  return MODEL_SPECS[modeId]?.[model] ?? null
}

export function modelsFor(modeId: string) {
  return Object.entries(MODEL_SPECS[modeId] ?? {})
    .map(([name, s]) => ({ name, tier: s.tier, note: s.note }))
    .sort((a, b) => a.tier - b.tier)
}
