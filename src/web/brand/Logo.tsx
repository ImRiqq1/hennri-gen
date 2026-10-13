import assinaturaRaw from "./assinatura.svg?raw"
import simboloRaw from "./simbolo.svg?raw"
import { cn } from "@/lib/utils"

// Os SVGs oficiais da MISE.IA (public/brand) vêm com fill fixo. Aqui o fill vira
// currentColor, então a logo segue o tema (claro/escuro) pela cor do texto.
// O conteúdo é nosso, estático — seguro pra inline.
function inline(raw: string) {
  return raw
    .replace(/fill="#[0-9A-Fa-f]{6}"/g, 'fill="currentColor"')
    .replace(/\s(width|height)="[^"]*"/g, "")
}

const ASSINATURA = inline(assinaturaRaw)
const SIMBOLO = inline(simboloRaw)

/** Símbolo + barra + MISE.IA. Proporção 1012.66 × 210. */
export function LogoAssinatura({ className }: { className?: string }) {
  return (
    <span
      role="img"
      aria-label="MISE.IA"
      className={cn("block aspect-[1012.66/210] text-text [&>svg]:size-full", className)}
      dangerouslySetInnerHTML={{ __html: ASSINATURA }}
    />
  )
}

/** Só o símbolo (M nos cantos de enquadramento). */
export function LogoSimbolo({ className }: { className?: string }) {
  return (
    <span
      role="img"
      aria-label="MISE.IA"
      className={cn("block aspect-square text-text [&>svg]:size-full", className)}
      dangerouslySetInnerHTML={{ __html: SIMBOLO }}
    />
  )
}
