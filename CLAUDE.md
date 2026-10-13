# MISE.IA — regras do projeto

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

**Decisão do Henrique em 13/10/2026 — substitui o "tema escuro único / sem acento" do briefing:** visual high-tech estilo Apple, vidro fosco, suave e interativo, com **modo claro e escuro** (interruptor sol/lua, padrão escuro) e **cor de destaque ajustável** (laranja padrão, lima, azul, mono). Referências: dashboards com cards de canto recortado + botão ↗, pills segmentadas, números enormes, timeline de nós.

- Tokens em `src/web/index.css`: `data-theme` (dark/light) × `data-accent`. Usar sempre as classes semânticas (`bg-surface`, `text-text-2`, `bg-accent`, `bg-invert`…), nunca cor fixa.
- `.glass` / `.glass-2` = vidro (backdrop-filter). **Nunca deixar `filter`, `opacity < 1` ou `mask` num ancestral de um vidro depois da animação** — isola o backdrop-filter. Por isso o `GlassCard` termina a entrada com `filter: none` e o recorte (`corner`) fica num filho.
- O `body` não tem fundo (fica no `<html>`), senão cobre o `<Ambient>` de z-index negativo.
- Tema salvo em `localStorage` (`hennri-gen:tema`), aplicado por script inline no `index.html` antes do paint. Troca de tema com revelação circular (View Transitions).
- **Fontes (13/10/2026):** Geist (`@fontsource-variable/geist`) em tudo; números grandes com `.display-num` (peso 300, apertado), títulos com `.display-title`, rótulos/atalhos em Geist Mono (`.label`, `.kbd`). A marca é a logo oficial MISE.IA em SVG (`public/brand/`, inline via `src/web/brand/Logo.tsx` com `currentColor`); favicon = símbolo. Nada de "Henrique" na marca (a saudação pode). Vermelho (`--danger`) só pra erro e estouro de limite.
- **Sem manchas de luz desfocadas no fundo** (o Henrique achou feio): fundo = grade fina + grão. Painéis são sólidos (`.glass`/`.glass-2`); vidro com blur só no que flutua (`.float`: dock, popovers, paleta).
- **Atalhos:** lista única em `src/web/lib/shortcuts.ts` (alimenta paleta ⌘K e ajuda ?). Globais no `CommandCenter`; os da tela Criar no `Composer`/`Criar`. Atalho de uma tecla ignora campos de texto (`isTyping`) e overlays abertos (`overlayOpen()`, via `data-overlay` no `<html>` — não procurar `[role=dialog]`, o que está saindo continua no DOM).
- Rotas: `/` Início, `/criar?modo=<id>` (modo na URL).
- Motion: biblioteca `motion` (`motion/react`), easing `[0.16, 1, 0.3, 1]`, `MotionConfig reducedMotion="user"`.

## Geração (fase 2 — 13/10/2026)

- `POST /api/jobs` cria 1 job por take. Ordem obrigatória: `buildRequest` (src/shared/generation.ts) → `estimateFor` (sem estimativa o job não sai) → limites diário/mensal contando gasto **+ jobs pendentes** → confirmação acima de `confirmacao_acima_usd` (409 `needsConfirm`, o front reenvia com `confirmed: true`).
- `dispatch` ocupa as vagas de `concorrencia_max` (reserva atômica `UPDATE ... WHERE status='waiting_slot'`). 400 "concurrent" da Higgsfield devolve o job pra `waiting_slot`. 5xx/rede deixa em `submitting` e o refresh reenvia com a MESMA Idempotency-Key (= id do job) e o mesmo `request_body_json`.
- Polling: `GET /api/jobs?active=1` consulta o `status_url` de cada job vivo (no máx. 1×/3 s por job). `completed` → `saveOutput` copia pro R2 (`jobs/<id>.<ext>`) via `waitUntil` → `saved`. `GET /api/files/jobs/...` serve do R2 com Range.
- A credencial só vai pra URLs de `api.higgsfield.ai` (`assertHfUrl` confere status_url/cancel_url).
- Estimativa (`src/shared/pricing.ts`): Seedance/Genjutsu/Cinema devolvem texto → `parseRates` + fórmula; Kling/SOUL devolvem `usd` exato; senão tabela local marcada "estimado".
- Uploads: `POST /api/uploads` só pede a URL presignada (S3 da Higgsfield aceita PUT do navegador, CORS liberado); o arquivo vai direto do navegador com progresso (`src/web/lib/media.ts`).

## Fase 3 (13/10/2026)

- **Webhook** `POST /api/webhooks/higgsfield?token=…` (fora do Access): token comparado em tempo constante (`WEBHOOK_TOKEN`, secret). O corpo só identifica o job pelo `request_id`; o estado vem de `refreshJob(force)` no `status_url`. Desconhecido/duplicado → 200 sem efeito; envelope inválido → 400; token errado → 401. O envio inclui `?hf_webhook=` só quando `PUBLIC_URL` + `WEBHOOK_TOKEN` existem (no dev `PUBLIC_URL` fica vazio no `.dev.vars`).
- **Queue** `hennri-gen-save` (binding `SAVE_QUEUE`): `completed` → mensagem → consumer chama `saveOutput`; se continuar `completed` (falhou), `retry` em 30 s. Sem binding, cai no `waitUntil`.
- **Cron** `* * * * *` → `recoverAll`: revisa jobs vivos sem consulta há 20 s, reenvia `submitting`, refaz cópias paradas e ocupa vagas. No dev: `curl "localhost:8788/cdn-cgi/handler/scheduled?cron=*+*+*+*+*"` (o `/__scheduled` é engolido pelos assets).
- **Galeria** `/galeria`: filtros (status, modo, favoritos, busca no prompt), paginação por cursor (`before`), detalhe com refazer igual (`POST /api/jobs/:id/redo`, passa pelos limites), refazer editando (`sessionStorage` → `takePrefill` no Composer), usar como referência (baixa do R2 e sobe de novo pra Higgsfield) e continuar cena (último frame via `<video>`+canvas → `i2v:first`).
- O painel do navegador do app não desmonta páginas na animação de saída (AnimatePresence): teste navegação entre páginas no Chrome headless (CDP), não no painel.

## Fase 4 (13/10/2026)

- Rotas em `src/worker/routes/studio.ts`: `GET/PUT /api/settings` (Zod; diário ≤ mensal), `/api/projects` (o "sem-projeto" não arquiva), `/api/presets` (prompt base com `{{variáveis}}`), `GET /api/costs?days=7|30|90` (dia/semana/mês no fuso de SP, série diária, por modelo e por projeto — só jobs completed/saving/saved).
- Jobs guardam `project_id` (projeto ativo, senão "sem-projeto") e `preset_id` (preset do MISE.IA usado). No pedido: `projectId`/`templateId` — não confundir com `presetId`, que é o estilo do Restyle.
- O Composer recebe `settings/projects/presets` já carregados (o Criar mostra skeleton antes) e usa os padrões da Config. `templateVars`/`fillTemplate` em `src/web/lib/studio.ts`; mudanças disparam `STUDIO_CHANGED`.
- Páginas: `/presets` (G P), `/custos` (G U), `/config` (G ,). Custos tem alternativa em tabela.

## Fase 5 (13/10/2026)

- **Registro de modelos** `src/shared/models.ts` (`MODEL_SPECS[modo][modelo]`): endpoint, duração min/máx, resoluções (e se vão no corpo), proporções, áudio, prompt obrigatório. O Composer, a estimativa (`endpointFor`) e o envio (`buildRequest`) leem daqui. Modelo novo = entrada no registro + `case` no `buildRequest`.
- Pegadinhas do schema: Kling 3.0 std/pro/4k não têm `resolution` e o áudio é `sound: "on"|"off"` (3–15 s); Turbo tem `resolution` e não tem áudio nem último frame; Kling O3 usa `mode: std|pro|4k` (= 720p/1080p/4K) e `first_frame_url`/`last_frame_url`; MiniMax H3 é sempre 2K (5–15 s); Wan 3.0 aceita 2–30 s.
- A estimativa monta o corpo com `estimateRequest` (= `buildRequest` com mídia de mentira) — nunca diverge do envio. Kling/Wan/MiniMax devolvem `usd` exato. Se a Higgsfield recusar (ex.: 409 "temporarily unavailable" no O3 4K em 13/10), cai na tabela e o `basis` mostra o motivo.
- **Linhagem**: `parent_job_id` + `parent_relation` (refeito, editado, estendido, continuação, referência, genjutsu — migration 0003). A Galeria grava a origem via `setOrigin`/`prefillFrom(job, relação)`; `GET /api/jobs/:id/lineage` devolve ancestrais e descendentes.
- **Comparar**: Galeria → Comparar → 2 a 4 vídeos prontos; o primeiro manda no tempo e os outros são ressincronizados se derrapam > 0,15 s.
- **Avisos**: `JobsProvider` (no Shell) faz o polling único de jobs pro site todo e avisa ao terminar (toast + som sintetizado + notificação do sistema com a aba oculta). Preferências por navegador em `localStorage` `mise:avisos`, editáveis em Config. Com a aba oculta o polling pausa (o cron do servidor continua).
