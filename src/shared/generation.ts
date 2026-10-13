// Pedido de geração: o que o front manda pro Worker e como vira o corpo de cada endpoint.
// Campos conferidos nos schemas da documentação (docs.higgsfield.ai, 13/10/2026).

import { endpointFor, type EstimateInput } from "./pricing"

export type MediaRef = { url: string; durationSec?: number }

export type GenerateRequest = EstimateInput & {
  prompt: string
  /** URLs públicas (já enviadas à Higgsfield) por slot: "i2v:first", "ref:img", "genjutsu:video"… */
  media: Record<string, MediaRef[]>
  /** o usuário confirmou um envio acima do valor de confirmação */
  confirmed?: boolean
  /** projeto (cliente/campanha); padrão "sem-projeto" */
  projectId?: string
  /** preset do MISE.IA usado pra montar o pedido (não confundir com presetId do Restyle) */
  templateId?: string
  /** linhagem: de qual job este veio e como */
  parentJobId?: string
  parentRelation?: Relation
}

export const RELATIONS = ["refeito", "editado", "estendido", "continuação", "referência", "genjutsu"] as const
export type Relation = (typeof RELATIONS)[number]

const urls = (m: Record<string, MediaRef[]>, key: string) => (m[key] ?? []).map((x) => x.url)
const o3Mode = (res: string) => (res === "4K" ? "4k" : res === "1080p" ? "pro" : "std")
const nonEmpty = <T,>(a: T[]) => (a.length ? a : undefined)

/** Monta { endpoint, body } ou devolve o motivo de não dar pra enviar. */
export function buildRequest(r: GenerateRequest): { endpoint: string; body: Record<string, unknown> } | { error: string } {
  const ep = endpointFor(r.modeId, r.model)
  if (!ep) return { error: `Modelo sem endpoint: ${r.model}` }
  const prompt = r.prompt.trim()
  const m = r.media
  const seedanceBase = { resolution: r.resolution, generate_audio: r.audio }
  let body: Record<string, unknown>

  switch (ep.endpoint) {
    case "bytedance/seedance-2.5/text-to-video":
      if (!prompt) return { error: "Escreva o prompt." }
      body = { ...seedanceBase, prompt, duration: r.duration, aspect_ratio: r.aspect }
      break
    case "bytedance/seedance-2.5/image-to-video": {
      const [first] = urls(m, "i2v:first")
      if (!first) return { error: "Envie o primeiro frame." }
      const [last] = urls(m, "i2v:last")
      body = { ...seedanceBase, image_url: first, ...(last ? { end_image_url: last } : {}), ...(prompt ? { prompt } : {}), duration: r.duration }
      break
    }
    case "bytedance/seedance-2.5/reference-to-video": {
      const image_urls = nonEmpty(urls(m, "ref:img"))
      const video_urls = nonEmpty(urls(m, "ref:vid"))
      const audio_urls = nonEmpty(urls(m, "ref:aud"))
      if (!image_urls && !video_urls && !audio_urls) return { error: "Envie ao menos uma referência." }
      if (!prompt) return { error: "Escreva o prompt." }
      body = { ...seedanceBase, prompt, duration: r.duration, aspect_ratio: r.aspect, image_urls, video_urls, audio_urls }
      break
    }
    case "bytedance/seedance-2.5/video-edit":
    case "bytedance/seedance-2.5/video-extend": {
      const key = r.modeId === "edit" ? "edit:video" : "extend:video"
      const [video_url] = urls(m, key)
      if (!video_url) return { error: "Envie o vídeo de origem." }
      if (!prompt) return { error: "Escreva o prompt." }
      body = { ...seedanceBase, prompt, video_url, ...(r.modeId === "extend" ? { duration: r.duration } : {}) }
      break
    }
    case "higgsfield/genjutsu/motion-transfer/v1.0":
    case "higgsfield/genjutsu/object-swap/v1.0": {
      const [video_url] = urls(m, "genjutsu:video")
      const image_urls = urls(m, "genjutsu:img").slice(0, 8)
      if (!video_url) return { error: "Envie o vídeo de referência." }
      if (!image_urls.length) return { error: "Envie ao menos uma imagem (personagem, produto ou roupa)." }
      body = { video_url, image_urls, resolution: r.resolution, ...(prompt ? { prompt } : {}) }
      break
    }
    case "higgsfield/genjutsu/restyle/v1.0": {
      const [video_url] = urls(m, "genjutsu:video")
      if (!video_url) return { error: "Envie o vídeo de referência." }
      if (!r.presetId) return { error: "Escolha um estilo." }
      body = { video_url, preset_id: r.presetId, image_urls: urls(m, "genjutsu:img").slice(0, 5), resolution: r.resolution, ...(prompt ? { prompt } : {}) }
      break
    }
    case "higgsfield/cinema-studio/4.0":
      if (!prompt) return { error: "Escreva o prompt." }
      body = {
        prompt,
        duration: r.duration,
        resolution: r.resolution,
        aspect_ratio: r.aspect,
        image_urls: nonEmpty(urls(m, "cinema:img")),
        video_urls: nonEmpty(urls(m, "cinema:vid")),
      }
      break
    // ---- Kling 3.0 (std/pro/4k: sem resolução, áudio = sound on/off)
    case "kling-video/v3.0/std/text-to-video":
    case "kling-video/v3.0/pro/text-to-video":
    case "kling-video/v3.0/4k/text-to-video":
      if (!prompt) return { error: "Escreva o prompt." }
      body = { prompt, duration: r.duration, aspect_ratio: r.aspect, sound: r.audio ? "on" : "off" }
      break
    case "kling-video/v3.0/std/image-to-video":
    case "kling-video/v3.0/pro/image-to-video":
    case "kling-video/v3.0/4k/image-to-video": {
      const [first] = urls(m, "i2v:first")
      if (!first) return { error: "Envie o primeiro frame." }
      const [last] = urls(m, "i2v:last")
      body = { image_url: first, ...(last ? { last_image_url: last } : {}), duration: r.duration, sound: r.audio ? "on" : "off", ...(prompt ? { prompt } : {}) }
      break
    }
    case "kling-video/v3.0-turbo/text-to-video":
      if (!prompt) return { error: "Escreva o prompt." }
      body = { prompt, duration: r.duration, aspect_ratio: r.aspect, resolution: r.resolution }
      break
    case "kling-video/v3.0-turbo/image-to-video": {
      const [first] = urls(m, "i2v:first")
      if (!first) return { error: "Envie o primeiro frame." }
      if (!prompt) return { error: "Escreva o prompt." }
      if (urls(m, "i2v:last").length) return { error: "O Kling 3.0 Turbo não usa último frame — tire ou troque de modelo." }
      body = { prompt, image_url: first, duration: r.duration, resolution: r.resolution }
      break
    }
    // ---- Kling O3 (mode std/pro/4k = 720p/1080p/4K)
    case "kling-video/o3/first-last-frame": {
      const [first] = urls(m, "i2v:first")
      if (!first) return { error: "Envie o primeiro frame." }
      const [last] = urls(m, "i2v:last")
      body = { first_frame_url: first, ...(last ? { last_frame_url: last } : {}), duration: r.duration, mode: o3Mode(r.resolution), sound: r.audio ? "on" : "off", ...(prompt ? { prompt } : {}) }
      break
    }
    case "kling-video/o3/image-reference": {
      const image_urls = urls(m, "ref:img")
      if (!image_urls.length) return { error: "Envie ao menos uma imagem de referência." }
      if (urls(m, "ref:vid").length || urls(m, "ref:aud").length) return { error: "O Kling O3 aqui usa só imagens — tire vídeos/áudios ou use o Seedance." }
      if (image_urls.length > 7) return { error: "O Kling O3 aceita até 7 imagens." }
      if (!prompt) return { error: "Escreva o prompt." }
      body = { prompt, image_urls, duration: r.duration, aspect_ratio: r.aspect, mode: o3Mode(r.resolution), sound: r.audio ? "on" : "off" }
      break
    }
    // ---- Wan 3.0 Prime
    case "alibaba/wan-3.0-prime/text-to-video":
      if (!prompt) return { error: "Escreva o prompt." }
      body = { prompt, duration: r.duration, resolution: r.resolution, aspect_ratio: r.aspect, generate_audio: r.audio }
      break
    case "alibaba/wan-3.0-prime/image-to-video": {
      const [first] = urls(m, "i2v:first")
      if (!first) return { error: "Envie o primeiro frame." }
      if (!prompt) return { error: "Escreva o prompt." }
      const [last] = urls(m, "i2v:last")
      body = { prompt, image_url: first, ...(last ? { end_image_url: last } : {}), duration: r.duration, resolution: r.resolution, generate_audio: r.audio }
      break
    }
    // ---- MiniMax H3 (sempre 2K)
    case "minimax/h3/text-to-video":
      if (!prompt) return { error: "Escreva o prompt." }
      body = { prompt, duration: r.duration, aspect_ratio: r.aspect }
      break
    case "minimax/h3/image-to-video": {
      const [first] = urls(m, "i2v:first")
      if (!first) return { error: "Envie o primeiro frame." }
      if (!prompt) return { error: "Escreva o prompt." }
      const [last] = urls(m, "i2v:last")
      body = { prompt, image_url: first, ...(last ? { end_image_url: last } : {}), duration: r.duration }
      break
    }
    default: {
      // modelos de imagem: prompt + referências opcionais
      if (!prompt) return { error: "Escreva o prompt." }
      const refs = urls(m, "image:refs")
      body = { prompt, ...(refs.length && ep.endpoint.startsWith("xai/") ? { image_urls: refs } : {}) }
    }
  }
  // undefined some do JSON (a API recusa null em campos opcionais)
  return { endpoint: ep.endpoint, body: JSON.parse(JSON.stringify(body)) }
}

export type JobStatus =
  | "waiting_slot"
  | "submitting"
  | "queued"
  | "in_progress"
  | "completed"
  | "failed"
  | "nsfw"
  | "canceled"
  | "saving"
  | "saved"

export const ACTIVE: JobStatus[] = ["waiting_slot", "submitting", "queued", "in_progress", "completed", "saving"]
export const FINAL: JobStatus[] = ["failed", "nsfw", "canceled", "saved"]

export type JobView = {
  id: string
  batch_id: string | null
  parent_job_id: string | null
  parent_relation: string | null
  model_id: string
  mode: string
  prompt: string | null
  status: JobStatus
  error: string | null
  estimated_cost_usd: number | null
  estimate_basis: string | null
  output_url: string | null
  output_mime: string | null
  params: Record<string, unknown>
  refs: Record<string, MediaRef[]>
  created_at: number
  submitted_at: number | null
  completed_at: number | null
  favorite: boolean
  project_id: string
}

/**
 * Corpo só pra estimativa: mesma montagem do envio, com prompt e mídia de mentira (a estimativa
 * só valida o formato das URLs). Assim a estimativa nunca diverge do que vai ser enviado.
 */
export function estimateRequest(r: EstimateInput) {
  const IMG = "https://example.com/mise-ia/estimativa.png"
  const VID = "https://example.com/mise-ia/estimativa.mp4"
  const one = (url: string) => [{ url }]
  const media: Record<string, MediaRef[]> = {
    "i2v:first": one(IMG),
    "ref:img": one(IMG),
    "edit:video": one(VID),
    "extend:video": one(VID),
    "genjutsu:video": one(VID),
    "genjutsu:img": one(IMG),
    ...(r.refVideoSec ? { "ref:vid": one(VID), "cinema:vid": one(VID) } : {}),
  }
  return buildRequest({
    ...r,
    // Restyle: o preset escolhido ou um público qualquer (o preço não depende do estilo)
    presetId: r.presetId ?? "c2143317-f28d-4c3c-a0b8-39bd547e08a7",
    prompt: "estimativa de custo",
    media,
  })
}
