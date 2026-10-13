// Atalhos do HENNRI /GEN — fonte única para o teclado, a paleta (⌘K) e a ajuda (?).

export const IS_MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform)
export const MOD = IS_MAC ? "⌘" : "Ctrl"

/** Eventos de página: a página que se importa escuta (ex.: Criar foca o prompt). */
export const EVENTS = {
  focusPrompt: "hg:focus-prompt",
  generate: "hg:generate",
} as const

/** true enquanto a paleta (⌘K) ou a ajuda (?) estão abertas — o CommandCenter marca o <html>.
 *  Não dá pra procurar [role=dialog]: o diálogo que está saindo continua no DOM durante a animação. */
export function overlayOpen() {
  return document.documentElement.hasAttribute("data-overlay")
}

/** true quando o foco está num campo de texto — atalhos de uma tecla ficam mudos. */
export function isTyping(e: KeyboardEvent) {
  const el = e.target as HTMLElement | null
  if (!el) return false
  const tag = el.tagName
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable
}

export type ShortcutGroup = { title: string; items: { keys: string[]; label: string }[] }

// Cada item de `keys` é uma tecla mostrada num <kbd>; sequências (G depois H) vêm em ordem.
export const SHORTCUTS: ShortcutGroup[] = [
  {
    title: "Geral",
    items: [
      { keys: [MOD, "K"], label: "Paleta de comandos" },
      { keys: ["?"], label: "Mostrar atalhos" },
      { keys: ["T"], label: "Alternar claro / escuro" },
      { keys: ["A"], label: "Trocar cor de destaque" },
      { keys: ["Esc"], label: "Fechar / sair do campo" },
    ],
  },
  {
    title: "Navegação",
    items: [
      { keys: ["G", "H"], label: "Ir para Início" },
      { keys: ["G", "C"], label: "Ir para Criar" },
      { keys: ["N"], label: "Novo job (abre Criar no prompt)" },
    ],
  },
  {
    title: "Criar",
    items: [
      { keys: ["1", "…", "8"], label: "Trocar de modo" },
      { keys: ["/"], label: "Focar o prompt" },
      { keys: ["[", "]"], label: "Duração −1 s / +1 s" },
      { keys: ["−", "+"], label: "Menos / mais takes" },
      { keys: [MOD, "↵"], label: "Gerar" },
    ],
  },
]
