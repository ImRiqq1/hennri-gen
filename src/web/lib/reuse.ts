// Reaproveitar um resultado: usar como referência, continuar a cena, refazer editando.

import type { JobView, Relation } from "@shared/generation"
import { addFiles, type SlotRules } from "@/lib/media"

const PREFILL_KEY = "mise:prefill"

export type Prefill = {
  modeId: string
  model: string
  prompt: string
  resolution?: string
  duration?: number
  aspect?: string
  audio?: boolean
  presetId?: string | null
  /** fase 4: projeto e preset do MISE.IA que originaram o pedido */
  projectId?: string
  templateId?: string
  /** fase 5: linhagem */
  parentJobId?: string
  parentRelation?: Relation
}

/** Guarda o pedido pra tela Criar abrir já preenchida (refazer editando). */
export function setPrefill(p: Prefill) {
  try {
    sessionStorage.setItem(PREFILL_KEY, JSON.stringify(p))
  } catch {
    // sem storage: abre o Criar vazio
  }
}

/** Lê e apaga o pré-preenchimento (só vale uma vez, e só pro modo certo). */
export function takePrefill(modeId: string): Prefill | null {
  try {
    const raw = sessionStorage.getItem(PREFILL_KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as Prefill
    if (p.modeId !== modeId) return null
    sessionStorage.removeItem(PREFILL_KEY)
    return p
  } catch {
    return null
  }
}

export function prefillFrom(job: JobView, relation: Relation = "editado"): Prefill {
  const p = job.params as { resolution?: string; duration?: number; aspect?: string; audio?: boolean; presetId?: string | null }
  return { modeId: job.mode, model: job.model_id, prompt: job.prompt ?? "", ...p, projectId: job.project_id, parentJobId: job.id, parentRelation: relation }
}

/** Só a origem (pra quando o resultado vira mídia de outro modo). */
export function setOrigin(job: JobView, modeId: string, relation: Relation) {
  setPrefill({ modeId, model: "", prompt: "", projectId: job.project_id, parentJobId: job.id, parentRelation: relation })
}

/**
 * Baixa o resultado (do nosso R2) e sobe de novo pra Higgsfield num slot do Criar —
 * a API só aceita URL pública dela, não a nossa (que fica atrás do login).
 */
export async function reuseAsReference(job: JobView, slot: string, rules: SlotRules) {
  if (!job.output_url) throw new Error("job sem resultado salvo")
  const blob = await fetch(job.output_url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    return r.blob()
  })
  const ext = blob.type.includes("mp4") ? "mp4" : blob.type.includes("png") ? "png" : blob.type.includes("jpeg") ? "jpg" : "bin"
  const file = new File([blob], `mise-${job.id.slice(0, 8)}.${ext}`, { type: blob.type })
  return addFiles(slot, [file], rules)
}

/** Captura o último frame do vídeo (no navegador, via <video> + canvas) como PNG. */
export function captureLastFrame(src: string): Promise<File> {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video")
    v.muted = true
    v.playsInline = true
    v.preload = "auto"
    v.src = src
    const fail = (msg: string) => reject(new Error(msg))
    v.onerror = () => fail("não consegui abrir o vídeo")
    v.onloadedmetadata = () => {
      // um pouco antes do fim: o último frame exato às vezes não decodifica
      v.currentTime = Math.max(0, v.duration - 0.05)
    }
    v.onseeked = () => {
      const c = document.createElement("canvas")
      c.width = v.videoWidth
      c.height = v.videoHeight
      const ctx = c.getContext("2d")
      if (!ctx) return fail("canvas indisponível")
      ctx.drawImage(v, 0, 0)
      c.toBlob((b) => (b ? resolve(new File([b], "ultimo-frame.png", { type: "image/png" })) : fail("não consegui gerar o PNG")), "image/png")
    }
  })
}
