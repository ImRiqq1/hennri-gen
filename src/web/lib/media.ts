// Mídia de referência: validação no navegador, upload direto pra Higgsfield (URL presignada,
// PUT com progresso) e um store por "slot" (ex.: "genjutsu:video", "ref:imagens").
// O store vive fora do React: trocar de modo ou de página não perde o que já subiu.

import { useSyncExternalStore } from "react"

export type MediaKind = "image" | "video" | "audio"

export const ACCEPT: Record<MediaKind, string[]> = {
  image: ["image/jpeg", "image/png", "image/webp", "image/gif"],
  video: ["video/mp4"],
  audio: ["audio/wav", "audio/x-wav"],
}

const MiB = 1024 * 1024

export type SlotRules = {
  kinds: MediaKind[]
  max: number
  maxBytes?: Partial<Record<MediaKind, number>>
  /** vídeo: duração mínima (s). */
  minDuration?: number
  /** vídeo: acima disso a Higgsfield corta (aviso, não erro). */
  trimAt?: number
  /** vídeo: mínimo de pixels por frame (Object swap: 409.600). */
  minPixels?: number
}

const DEFAULT_MAX: Record<MediaKind, number> = { image: 64 * MiB, video: 200 * MiB, audio: 64 * MiB }

export type MediaMeta = { width?: number; height?: number; duration?: number }

export type MediaItem = {
  id: string
  name: string
  kind: MediaKind
  mime: string
  bytes: number
  previewUrl: string
  meta: MediaMeta
  status: "checking" | "uploading" | "done" | "error"
  progress: number
  error?: string
  warning?: string
  publicUrl?: string
  assetId?: string
}

// ---------------------------------------------------------------- store

type State = Record<string, MediaItem[]>
let state: State = {}
const listeners = new Set<() => void>()
const EMPTY: MediaItem[] = []

function emit() {
  listeners.forEach((l) => l())
}
function setSlot(key: string, fn: (items: MediaItem[]) => MediaItem[]) {
  state = { ...state, [key]: fn(state[key] ?? EMPTY) }
  emit()
}
function patch(key: string, id: string, p: Partial<MediaItem>) {
  setSlot(key, (items) => items.map((it) => (it.id === id ? { ...it, ...p } : it)))
}

export function useSlot(key: string): MediaItem[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => state[key] ?? EMPTY,
  )
}

/** Estado de todos os slots (pra contar vários de uma vez sem hook em loop). */
export function useMediaState(): State {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => state,
  )
}

export function getSlot(key: string) {
  return state[key] ?? EMPTY
}

export function removeItem(key: string, id: string) {
  setSlot(key, (items) => {
    const it = items.find((x) => x.id === id)
    if (it) URL.revokeObjectURL(it.previewUrl)
    return items.filter((x) => x.id !== id)
  })
}

export function moveItem(key: string, from: number, to: number) {
  setSlot(key, (items) => {
    const next = items.slice()
    const [it] = next.splice(from, 1)
    next.splice(Math.max(0, Math.min(to, next.length)), 0, it)
    return next
  })
}

/** Troca o conteúdo de dois slots (ex.: primeiro ↔ último frame). */
export function swapSlots(a: string, b: string) {
  const A = state[a] ?? EMPTY
  const B = state[b] ?? EMPTY
  state = { ...state, [a]: B, [b]: A }
  emit()
}

// ---------------------------------------------------------------- validação

export function kindOf(file: File): MediaKind | null {
  for (const k of Object.keys(ACCEPT) as MediaKind[]) if (ACCEPT[k].includes(file.type)) return k
  return null
}

export const fmtBytes = (n: number) => (n >= MiB ? `${(n / MiB).toFixed(n >= 10 * MiB ? 0 : 1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`)
export const fmtDuration = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`

function readMeta(kind: MediaKind, url: string): Promise<MediaMeta> {
  return new Promise((resolve) => {
    if (kind === "image") {
      const img = new Image()
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
      img.onerror = () => resolve({})
      img.src = url
      return
    }
    const el = document.createElement(kind === "video" ? "video" : "audio")
    el.preload = "metadata"
    el.muted = true
    el.onloadedmetadata = () => {
      const v = el as HTMLVideoElement
      resolve({ duration: el.duration, width: v.videoWidth || undefined, height: v.videoHeight || undefined })
    }
    el.onerror = () => resolve({})
    el.src = url
  })
}

function check(file: File, kind: MediaKind, meta: MediaMeta, rules: SlotRules): { error?: string; warning?: string } {
  const max = rules.maxBytes?.[kind] ?? DEFAULT_MAX[kind]
  if (file.size > max) return { error: `Grande demais: ${fmtBytes(file.size)} (máx. ${fmtBytes(max)})` }
  if (kind === "video") {
    if (meta.duration === undefined) return { error: "Não consegui ler o vídeo (use MP4 H.264)" }
    if (rules.minDuration && meta.duration < rules.minDuration) {
      return { error: `Curto demais: ${meta.duration.toFixed(1)} s (mín. ${rules.minDuration} s)` }
    }
    if (rules.minPixels && meta.width && meta.height && meta.width * meta.height < rules.minPixels) {
      return { error: `Resolução baixa: ${meta.width}×${meta.height} (mín. ${rules.minPixels.toLocaleString("pt-BR")} px por frame, ex.: 640×640)` }
    }
    if (rules.trimAt && meta.duration > rules.trimAt) {
      return { warning: `Tem ${Math.round(meta.duration)} s — a Higgsfield usa só os primeiros ${rules.trimAt} s` }
    }
  }
  return {}
}

// ---------------------------------------------------------------- upload

function putWithProgress(url: string, headers: Record<string, string>, file: File, onProgress: (p: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open("PUT", url)
    // Só os headers da URL presignada — nunca a credencial da API.
    Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v))
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total)
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`storage respondeu ${xhr.status}`)))
    xhr.onerror = () => reject(new Error("falha de rede no envio"))
    xhr.send(file)
  })
}

async function upload(key: string, item: MediaItem, file: File) {
  patch(key, item.id, { status: "uploading", progress: 0 })
  try {
    const res = await fetch("/api/uploads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content_type: item.mime,
        bytes: item.bytes,
        width: item.meta.width,
        height: item.meta.height,
        duration_s: item.meta.duration,
      }),
    })
    const body = (await res.json().catch(() => null)) as
      | { id: string; upload_url: string; upload_headers: Record<string, string>; public_url: string; error?: string }
      | null
    if (!res.ok || !body?.upload_url) throw new Error(body?.error ?? `HTTP ${res.status}`)
    await putWithProgress(body.upload_url, body.upload_headers, file, (p) => patch(key, item.id, { progress: p }))
    patch(key, item.id, { status: "done", progress: 1, publicUrl: body.public_url, assetId: body.id })
  } catch (e) {
    patch(key, item.id, { status: "error", error: `Falha no envio: ${(e as Error).message}` })
  }
}

/**
 * Adiciona arquivos a um slot: confere tipo e limite, lê metadados, valida e já sobe.
 * Devolve mensagens de recusa (tipo errado / limite) pra quem chamou mostrar.
 */
export async function addFiles(key: string, files: File[], rules: SlotRules): Promise<string[]> {
  const refused: string[] = []
  const room = rules.max - getSlot(key).length
  const accepted = files.filter((f) => {
    const k = kindOf(f)
    if (!k || !rules.kinds.includes(k)) {
      refused.push(`${f.name}: formato não aceito aqui`)
      return false
    }
    return true
  })
  if (accepted.length > room) refused.push(`Limite de ${rules.max} — ${accepted.length - room} arquivo(s) ficaram de fora`)
  // slot de 1 item: o novo substitui o antigo
  if (rules.max === 1 && accepted.length) {
    getSlot(key).forEach((it) => removeItem(key, it.id))
  }
  const take = rules.max === 1 ? accepted.slice(0, 1) : accepted.slice(0, Math.max(0, room))

  await Promise.all(
    take.map(async (file) => {
      const kind = kindOf(file)!
      const previewUrl = URL.createObjectURL(file)
      const item: MediaItem = {
        id: crypto.randomUUID(),
        name: file.name,
        kind,
        mime: file.type,
        bytes: file.size,
        previewUrl,
        meta: {},
        status: "checking",
        progress: 0,
      }
      setSlot(key, (items) => [...items, item])
      const meta = await readMeta(kind, previewUrl)
      const { error, warning } = check(file, kind, meta, rules)
      patch(key, item.id, { meta, warning })
      if (error) {
        patch(key, item.id, { status: "error", error })
        return
      }
      await upload(key, { ...item, meta }, file)
    }),
  )
  return refused
}

/** Tenta de novo um item que falhou no envio (precisa do arquivo — refaz a partir do preview). */
export async function retryItem(key: string, id: string, rules: SlotRules) {
  const it = getSlot(key).find((x) => x.id === id)
  if (!it) return
  const blob = await fetch(it.previewUrl).then((r) => r.blob())
  const file = new File([blob], it.name, { type: it.mime })
  const { error } = check(file, it.kind, it.meta, rules)
  if (error) return patch(key, id, { status: "error", error })
  await upload(key, it, file)
}
