// Garante que a credencial da Higgsfield não vazou pro build do front.
// Roda no fim do `npm run build`. Falha o build se achar algo.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"

const DIST = "dist"
const needles = ["HF_CREDENTIALS", "api.higgsfield.ai", "Authorization: Key"]

// Se houver credencial local, procura também os próprios valores (id e secret).
for (const file of [".dev.vars", ".dev.vars.local"]) {
  if (!existsSync(file)) continue
  const m = readFileSync(file, "utf8").match(/^HF_CREDENTIALS\s*=\s*"?([^"\r\n]+)"?/m)
  if (m) needles.push(...m[1].split(":").filter((s) => s.length >= 8))
}

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) yield* walk(p)
    else yield p
  }
}

const hits = []
for (const file of walk(DIST)) {
  if (/\.(ttf|woff2?|png|jpe?g|webp|gif|mp4)$/i.test(file)) continue
  const text = readFileSync(file, "utf8")
  needles.forEach((n, i) => {
    // Nunca imprime o valor do segredo — só qual regra bateu.
    if (text.includes(n)) hits.push(`${file}: regra #${i}${i < 3 ? ` (${n})` : " (valor da credencial)"}`)
  })
}

if (hits.length) {
  console.error("✗ check-dist: possível vazamento de credencial no build do front:")
  for (const h of hits) console.error("  " + h)
  process.exit(1)
}
console.log(`✓ check-dist: nenhuma credencial no ${DIST}/`)
