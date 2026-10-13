// Modos da tela Criar (BRIEFING.md → "Telas e funcionalidades"). Na fase 2 isto passa a
// derivar do registro de modelos em src/shared/models/registry.ts (schemas da doc).

export type RefLimit = { kind: "imagem" | "vídeo" | "áudio"; max: number; label: string }

export type ModeDef = {
  id: string
  label: string
  short: string
  models: { name: string; tier: 1 | 2 }[]
  refs: RefLimit[]
  duration: boolean
  aspect: boolean
  audio: boolean
  resolutions: string[]
  placeholder: string
}

const VIDEO_RES = ["480p", "720p", "1080p"]

export const MODES: ModeDef[] = [
  {
    id: "t2v",
    label: "Texto → vídeo",
    short: "Texto",
    models: [{ name: "Seedance 2.5", tier: 1 }, { name: "Kling 3.0", tier: 2 }],
    refs: [],
    duration: true,
    aspect: true,
    audio: true,
    resolutions: VIDEO_RES,
    placeholder: "Descreva a cena: assunto, ação, câmera, luz…",
  },
  {
    id: "i2v",
    label: "Imagem → vídeo",
    short: "Imagem",
    models: [{ name: "Seedance 2.5", tier: 1 }, { name: "Kling 3.0", tier: 2 }],
    refs: [{ kind: "imagem", max: 2, label: "1º e último frame" }],
    duration: true,
    aspect: false,
    audio: true,
    resolutions: VIDEO_RES,
    placeholder: "O que acontece a partir do primeiro frame (opcional)…",
  },
  {
    id: "ref",
    label: "Referências",
    short: "Refs",
    models: [{ name: "Seedance 2.5", tier: 1 }],
    refs: [
      { kind: "imagem", max: 30, label: "imagens" },
      { kind: "vídeo", max: 10, label: "vídeos" },
      { kind: "áudio", max: 10, label: "áudios" },
    ],
    duration: true,
    aspect: true,
    audio: true,
    resolutions: VIDEO_RES,
    placeholder: "Cite as referências na cena: a pessoa da imagem 1 entra pela esquerda…",
  },
  {
    id: "edit",
    label: "Editar vídeo",
    short: "Editar",
    models: [{ name: "Seedance 2.5", tier: 1 }],
    refs: [{ kind: "vídeo", max: 1, label: "vídeo de origem" }],
    duration: false,
    aspect: true,
    audio: true,
    resolutions: VIDEO_RES,
    placeholder: "O que mudar no vídeo: troque o fundo por…",
  },
  {
    id: "extend",
    label: "Estender",
    short: "Estender",
    models: [{ name: "Seedance 2.5", tier: 1 }],
    refs: [{ kind: "vídeo", max: 1, label: "vídeo a estender" }],
    duration: true,
    aspect: true,
    audio: true,
    resolutions: VIDEO_RES,
    placeholder: "Como a cena continua…",
  },
  {
    id: "genjutsu",
    label: "Genjutsu",
    short: "Genjutsu",
    models: [
      { name: "Motion transfer", tier: 1 },
      { name: "Object swap", tier: 1 },
      { name: "Restyle", tier: 1 },
    ],
    refs: [
      { kind: "vídeo", max: 1, label: "vídeo de origem" },
      { kind: "imagem", max: 8, label: "imagens" },
    ],
    duration: false,
    aspect: false,
    audio: false,
    resolutions: VIDEO_RES,
    placeholder: "Opcional: detalhe a troca de personagem, objeto ou estilo…",
  },
  {
    id: "cinema",
    label: "Cinema Studio",
    short: "Cinema",
    models: [{ name: "Cinema Studio 4.0", tier: 1 }],
    refs: [
      { kind: "imagem", max: 30, label: "imagens" },
      { kind: "vídeo", max: 10, label: "vídeos" },
    ],
    duration: true,
    aspect: true,
    audio: false,
    resolutions: ["480p", "720p"],
    placeholder: "Dirija a cena. Use <<<image_1>>> pra citar referências…",
  },
  {
    id: "image",
    label: "Imagem",
    short: "Imagem",
    models: [
      { name: "SOUL V2", tier: 1 },
      { name: "Grok Image 2.0", tier: 1 },
      { name: "Qwen Image 3", tier: 2 },
    ],
    refs: [{ kind: "imagem", max: 10, label: "referências" }],
    duration: false,
    aspect: true,
    audio: false,
    resolutions: ["1K", "2K"],
    placeholder: "Frame inicial ou referência para um vídeo…",
  },
]

export const ASPECTS = [
  { id: "9:16", w: 9, h: 16 },
  { id: "16:9", w: 16, h: 9 },
  { id: "1:1", w: 1, h: 1 },
  { id: "4:3", w: 4, h: 3 },
  { id: "3:4", w: 3, h: 4 },
  { id: "21:9", w: 21, h: 9 },
] as const

export const CINEMA_CONTROLS = ["Câmera", "Ritmo", "Gênero", "Época", "Luz", "Lente", "Paleta"]
