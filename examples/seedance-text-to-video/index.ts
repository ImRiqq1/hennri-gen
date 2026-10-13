// Exemplo isolado: Seedance 2.5 texto→vídeo pelo SDK oficial (@higgsfield/client/v2).
// GERA COBRANÇA. Rodar com:
//   node --env-file=.dev.vars examples/seedance-text-to-video/index.ts
//
// A credencial vem de HF_CREDENTIALS (id:secret) no .dev.vars (o mesmo arquivo do wrangler dev, ignorado pelo git), carregada pelo próprio
// Node. Este script nunca imprime a credencial nem objetos de erro inteiros (o erro do
// axios carrega os headers da requisição, incluindo o Authorization).

import { randomUUID } from "node:crypto"
import { config, higgsfield } from "@higgsfield/client/v2"

const ENDPOINT = "bytedance/seedance-2.5/text-to-video"

const input = {
  prompt: "A cinematic scene at sunset",
  duration: 5,
  resolution: "720p",
  aspect_ratio: "16:9",
  // Ligado a pedido do Henrique neste exemplo (o padrão do site continua sendo desligado).
  generate_audio: true,
}

const credentials = process.env.HF_CREDENTIALS?.trim()
if (!credentials || !credentials.includes(":")) {
  console.error("HF_CREDENTIALS ausente ou fora do formato id:secret no .dev.vars.")
  process.exit(2)
}

// O SDK reenvia o POST em caso de erro de rede/5xx. Com uma Idempotency-Key fixa por
// execução, um reenvio devolve o mesmo request em vez de criar (e cobrar) outro.
const idempotencyKey = randomUUID()

config({
  credentials,
  headers: { "Idempotency-Key": idempotencyKey },
  pollInterval: 3000,
  // Vídeo demora; o padrão do SDK (5 min) pode ser curto.
  maxPollTime: 15 * 60 * 1000,
})

console.log(`Enviando ${ENDPOINT} (Idempotency-Key ${idempotencyKey})…`)
const started = Date.now()

try {
  const result = await higgsfield.subscribe(ENDPOINT, { input, withPolling: true })
  const secs = Math.round((Date.now() - started) / 1000)

  if (result.status === "completed" && result.video?.url) {
    console.log(`✓ completed em ${secs}s · request_id ${result.request_id}`)
    console.log(result.video.url)
    process.exit(0)
  }

  // failed / nsfw / completed sem vídeo — não é sucesso.
  const motivo =
    result.status === "nsfw"
      ? "bloqueado pela moderação (nsfw) — não cobrado"
      : result.status === "failed"
        ? `falhou: ${result.error ?? "sem detalhe"} — não cobrado`
        : `status ${result.status} sem URL de vídeo`
  console.error(`✗ ${motivo} · request_id ${result.request_id}`)
  process.exit(1)
} catch (err) {
  // Só nome, mensagem e status — nunca o objeto inteiro.
  const e = err as { name?: string; message?: string; statusCode?: number; status?: number }
  const status = e.statusCode ?? e.status
  console.error(`✗ ${e.name ?? "Erro"}${status ? ` (${status})` : ""}: ${e.message ?? "sem mensagem"}`)
  if (e.name === "TimeoutError") {
    // O polling do SDK só para em completed/failed/nsfw; um request cancelado cai aqui.
    console.error("  O polling estourou o tempo — o request pode ter sido cancelado ou ainda estar rodando.")
  }
  process.exit(1)
}
