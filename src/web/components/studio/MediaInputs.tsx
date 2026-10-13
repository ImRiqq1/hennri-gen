import { AlertTriangle, AudioLines, Box, Images, Shirt, Smile, Video } from "lucide-react"
import { FramePair, MediaGrid, MediaTabs, VideoSlot } from "@/components/upload/Media"
import { RestylePresets } from "@/components/upload/RestylePresets"
import { useSlot, type MediaKind, type SlotRules } from "@/lib/media"

// Zonas de upload por modo (limites da documentação de cada endpoint, conferidos em 13/10/2026).
const MiB = 1024 * 1024

export type GenjutsuSub = "Motion transfer" | "Object swap" | "Restyle"

export function genjutsuVideoRules(sub: GenjutsuSub): SlotRules {
  return {
    kinds: ["video"],
    max: 1,
    minDuration: 4,
    trimAt: 30,
    maxBytes: { video: 200 * MiB },
    minPixels: sub === "Object swap" ? 409_600 : undefined,
  }
}
export const genjutsuImageRules = (sub: GenjutsuSub): SlotRules => ({ kinds: ["image"], max: sub === "Restyle" ? 5 : 8 })

const IMG = (max: number): SlotRules => ({ kinds: ["image"], max })
const VID = (max: number): SlotRules => ({ kinds: ["video"], max, trimAt: 30 })
const AUD = (max: number): SlotRules => ({ kinds: ["audio"], max })
const SOURCE_VIDEO: SlotRules = { kinds: ["video"], max: 1, trimAt: 30, maxBytes: { video: 200 * MiB } }

/** Slots de cada modo, em ordem — o Ctrl+V usa isso pra achar o destino quando nenhuma zona foi apontada. */
export function slotsFor(modeId: string, model: string): { key: string; rules: SlotRules }[] {
  switch (modeId) {
    case "i2v":
      return [
        { key: "i2v:first", rules: IMG(1) },
        { key: "i2v:last", rules: IMG(1) },
      ]
    case "ref":
      return [
        { key: "ref:img", rules: IMG(30) },
        { key: "ref:vid", rules: VID(10) },
        { key: "ref:aud", rules: AUD(10) },
      ]
    case "edit":
      return [{ key: "edit:video", rules: SOURCE_VIDEO }]
    case "extend":
      return [{ key: "extend:video", rules: SOURCE_VIDEO }]
    case "genjutsu":
      return [
        { key: "genjutsu:video", rules: genjutsuVideoRules(model as GenjutsuSub) },
        { key: "genjutsu:img", rules: genjutsuImageRules(model as GenjutsuSub) },
      ]
    case "cinema":
      return [
        { key: "cinema:img", rules: IMG(30) },
        { key: "cinema:vid", rules: VID(10) },
      ]
    case "image":
      return [{ key: "image:refs", rules: IMG(10) }]
    default:
      return []
  }
}

export function pasteTargetFor(modeId: string, model: string, kind: MediaKind) {
  return slotsFor(modeId, model).find((s) => s.rules.kinds.includes(kind)) ?? null
}

/** Avisos que dependem do sub-modo atual (ex.: trocou pra Object swap depois de subir vídeo pequeno). */
function GenjutsuChecks({ sub }: { sub: GenjutsuSub }) {
  const [video] = useSlot("genjutsu:video")
  const images = useSlot("genjutsu:img")
  const msgs: string[] = []
  if (sub === "Object swap" && video?.meta.width && video.meta.height && video.meta.width * video.meta.height < 409_600) {
    msgs.push(`Object swap pede ≥ 409.600 px por frame; este vídeo tem ${video.meta.width}×${video.meta.height}.`)
  }
  if (sub === "Restyle" && images.length > 5) msgs.push(`Restyle aceita até 5 imagens; tire ${images.length - 5} antes de gerar.`)
  if (!msgs.length) return null
  return (
    <div className="flex items-start gap-2 rounded-[14px] border border-danger/40 bg-danger/8 px-3 py-2 text-[13px] text-text">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" />
      <span>{msgs.join(" ")}</span>
    </div>
  )
}

export function MediaInputs({
  modeId,
  model,
  presetId,
  onPreset,
}: {
  modeId: string
  model: string
  presetId: string | null
  onPreset: (id: string, name: string) => void
}) {
  switch (modeId) {
    case "i2v":
      return <FramePair first="i2v:first" last="i2v:last" rules={IMG(1)} />

    case "ref":
      return (
        <MediaTabs
          tabs={[
            { id: "img", label: "Imagens", icon: Images, slot: "ref:img", rules: IMG(30), empty: { title: "Imagens de referência", hint: "até 30 · jpeg, png, webp, gif" } },
            { id: "vid", label: "Vídeos", icon: Video, slot: "ref:vid", rules: VID(10), empty: { title: "Vídeos de referência", hint: "até 10 · mp4 · 30 s somados" } },
            { id: "aud", label: "Áudios", icon: AudioLines, slot: "ref:aud", rules: AUD(10), empty: { title: "Áudios de referência", hint: "até 10 · wav · 30 s somados" } },
          ]}
        />
      )

    case "edit":
    case "extend":
      return (
        <VideoSlot
          slot={`${modeId}:video`}
          rules={SOURCE_VIDEO}
          label="Vídeo de origem"
          title={modeId === "edit" ? "Envie o vídeo que vai ser editado" : "Envie o vídeo que vai continuar"}
          hint="mp4 · até 200 MB · acima de 30 s é cortado"
        />
      )

    case "genjutsu": {
      const sub = model as GenjutsuSub
      return (
        <div className="flex flex-col gap-3">
          <div className="grid gap-3 md:grid-cols-2">
            <VideoSlot
              slot="genjutsu:video"
              rules={genjutsuVideoRules(sub)}
              label="Vídeo de referência"
              title={sub === "Restyle" ? "Envie o vídeo que vai ganhar o estilo" : "Envie o vídeo para extrair o movimento"}
              hint={sub === "Object swap" ? "4 a 30 s · mp4 · mín. 640×640" : sub === "Restyle" ? "4 a 30 s · mp4 · até 200 MB · mantém o áudio" : "4 a 30 s · mp4"}
            />
            <MediaGrid
              slot="genjutsu:img"
              rules={genjutsuImageRules(sub)}
              label={sub === "Restyle" ? "Personagens (opcional)" : "Personagens, produtos ou roupas"}
              empty={{
                icons: [Smile, Shirt, Box],
                title: sub === "Restyle" ? "Adicione personagens (opcional)" : "Adicione personagens, produtos ou roupas",
                hint: sub === "Restyle" ? "até 5 imagens" : "até 8 imagens",
              }}
            />
          </div>
          {sub === "Restyle" && (
            <div>
              <div className="mb-2 flex items-baseline justify-between">
                <span className="label">Estilo</span>
                <span className="font-mono text-[11px] text-text-3">{presetId ? "selecionado" : "escolha um"}</span>
              </div>
              <RestylePresets value={presetId} onChange={onPreset} />
            </div>
          )}
          <GenjutsuChecks sub={sub} />
        </div>
      )
    }

    case "cinema":
      return (
        <MediaTabs
          tabs={[
            { id: "img", label: "Imagens", icon: Images, slot: "cinema:img", rules: IMG(30), empty: { title: "Imagens de referência", hint: "cite no prompt como <<<image_1>>>" } },
            { id: "vid", label: "Vídeos", icon: Video, slot: "cinema:vid", rules: VID(10), empty: { title: "Vídeos de referência", hint: "cite no prompt como <<<video_1>>>" } },
          ]}
        />
      )

    case "image":
      return (
        <MediaGrid
          slot="image:refs"
          rules={IMG(10)}
          label="Referências"
          empty={{ icons: [Images], title: "Imagens de referência (opcional)", hint: "até 10 · jpeg, png, webp" }}
          compact
        />
      )

    default:
      return null
  }
}
