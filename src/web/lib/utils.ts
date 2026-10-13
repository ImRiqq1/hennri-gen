import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

// O tailwind-merge precisa conhecer a escala tipográfica própria (index.css → @theme),
// senão trata `text-metric` como cor e o descarta ao lado de `text-text`.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["page", "metric-xl", "metric", "metric-sm", "card", "body", "micro"] }],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
