# HENNRI /GEN — regras do projeto

Painel pessoal (um usuário, Henrique) pra gerar vídeo e imagem pela Higgsfield API.
**`BRIEFING.md` é a fonte de verdade do produto.** Se a documentação da Higgsfield
(https://docs.higgsfield.ai/docs/llms.txt) contradisser o briefing, a documentação vence — avise o Henrique do conflito.

Sempre responder e escrever em português do Brasil.

## Regras inegociáveis

- `HF_CREDENTIALS` (`id:secret`) só como secret do Worker (`npx wrangler secret put HF_CREDENTIALS`) e no `.dev.vars` local. Nunca no front, no git, em resposta da API ou em log. O `npm run build` roda `scripts/check-dist.mjs`, que falha se a credencial aparecer no `dist/`.
- **Nunca disparar uma geração paga sem o Henrique pedir.** Testes reais em 480p e 4–5 s. Estimativa (`POST /estimate/<endpoint>`) não cobra e pode ser usada livremente.
- Toda submissão leva `Idempotency-Key` = id do job (gerado antes do envio). Estimativa de custo antes de todo envio; se a estimativa falhar, o job não sai.
- Não trocar modelo, endpoint ou ambiente em silêncio; erro aparece na tela.
- Stack fixa (não trocar sem perguntar): Vite + React + TS + Tailwind + shadcn no front; Hono num único Cloudflare Worker servindo API e assets; D1; R2; Queues; Cron; Cloudflare Access na frente de gen.hennri.com.
- Commits pequenos, mensagens em português. **Deploy só com confirmação explícita.**
- Ao fim de cada fase, rodar o checklist de testes do briefing e reportar o que passou.

## Arquitetura

- `src/worker/` — Hono com `basePath("/api")`. Só `/api/*` passa pelo Worker (`run_worker_first`); o resto é o build do Vite servido pelo binding `ASSETS`.
  - `middleware/access.ts` — exige JWT do Cloudflare Access (`Cf-Access-Jwt-Assertion`) em `/api/*`, menos `/api/webhooks/*`. Falha fechada se `ACCESS_TEAM_DOMAIN`/`ACCESS_AUD` estiverem vazios. `DEV_BYPASS_ACCESS=1` só no `.dev.vars`.
  - `lib/higgsfield.ts` — cliente da API via `fetch` (auth `Authorization: Key id:secret`, base `https://api.higgsfield.ai`). Erros viram `HiggsfieldError` com status e `X-Correlation-ID`.
  - `routes/health.ts` — `GET /api/health`: D1, R2 e uma estimativa grátis no SOUL V2 pra provar a chave.
- `src/web/` — front React (alias `@/`). `src/shared/` — código comum (alias `@shared/`), onde vai morar `models/registry.ts`.
- `migrations/` — SQL do D1 numerado. `npm run db:migrate:local` / `db:migrate:remote`.
- `workers_dev` e `preview_urls` ficam **desligados**: só gen.hennri.com (atrás do Access) responde.

## Fatos da API (confirmados na doc em 13/10/2026)

- Status: `queued` → `in_progress` → `completed` | `failed` | `nsfw` | `canceled`. Cancelar só em `queued` (202; depois 400).
- Webhook (`?hf_webhook=<https>`) só dispara em `completed`, `failed` e `nsfw` — cancelamento não gera webhook. Pode duplicar; deduplicar por `request_id` + status. Não confiar no corpo: revalidar no `status_url`.
- Concorrência estourada = 400 com "Maximum number of concurrent requests"; sem `Retry-After`.
- Erros: 401 credencial, 403 saldo insuficiente, 404 modelo/request inexistente, 422 validação ou Idempotency-Key reusada com parâmetros diferentes, 423 modelo bloqueado, 503 modelo fora do ar.
- Reenvio com a mesma Idempotency-Key devolve recibo com `status: queued` mesmo se já terminou — ler o `status_url`.
- Não há endpoint de saldo nem custo real cobrado na resposta do job.
- **Estimativa nem sempre é número.** Pro SOUL V2 volta `{ credits, usd }`; pro Seedance 2.5 volta `{ type: "description", pricing_description }` com a tabela em texto (13/10/2026: ~US$ 0,2056/s 480p, 0,4622/s 720p, 1,1372/s 1080p, áudio não muda o preço). O cálculo do custo precisa tratar os dois formatos.
- Chave local: `& .\scripts\set-hf-key.ps1` grava `HF_CREDENTIALS` no `.dev.vars` sem exibir o valor.
- SDK `@higgsfield/client@0.2.6` (v2) só expõe `subscribe` e reenvia o POST sem Idempotency-Key — não usar pra submissão (decisão pendente com o Henrique).

## Desenvolvimento local

- `npm run dev` — Vite em http://localhost:5181 (proxy `/api` → wrangler dev em :8788).
- Webhook não chega em localhost: usar polling, ou túnel cloudflared pra testar webhook.
- Copiar `.dev.vars.example` → `.dev.vars` e preencher `HF_CREDENTIALS`.

## Identidade visual

Fundo `#09090B`, texto cream `#E8E0D5`, branco e cinzas. Sem cor de acento (nada de verde). Vermelho só pra erro/estouro de limite. Fontes Fixture / Fixture Condensed / Fixture Ultra em `public/fonts` (as mesmas do /MAKER). Botões pill, números grandes, muito respiro. Tema escuro único; mobile-first na tela Criar e na fila.
