# Briefing — MISE.IA (site pessoal com Higgsfield API)

13 de out. de 2026 · @Henrique

> **Marca:** o produto foi renomeado de HENNRI /GEN para **MISE.IA** em 13/10/2026. Logos oficiais em `public/brand/` (assinatura, símbolo e wordmark, branco e preto). O domínio continua gen.hennri.com e o repositório continua hennri-gen.

## Visão geral

O MISE.IA é um painel pessoal, de um único usuário (Henrique), para gerar vídeos e imagens pela Higgsfield API pagando por geração, sem depender da interface do higgsfield.ai. O foco é o fluxo de produção de ads e motion para iGaming: muitas variações rápidas, referência de imagem, controle de custo por job.

### O que o site faz

- Gera vídeo (texto→vídeo e imagem→vídeo) e imagem com os modelos priorizados, a partir de uma tela única de criação.
- Mostra o custo estimado antes de cada geração e o gasto acumulado do dia e do mês.
- Acompanha a fila de jobs em tempo real e salva cada resultado com o prompt, o modelo e os parâmetros usados.
- Guarda presets de prompt e de parâmetros por projeto (cliente, campanha).
- Permite reaproveitar um resultado: usar um frame como referência, repetir com outra seed, trocar o modelo.

### O que o site não faz (fora do escopo)

- Não tem cadastro público, planos, cobrança nem múltiplos usuários.
- Não edita vídeo (corte, legenda, color) — isso continua no Premiere/After Effects.
- Não escreve o prompt técnico de imagem por conta própria; o campo de prompt é livre.

## Como a Higgsfield API funciona

A API é um produto separado do plano do higgsfield.ai: tem conta, chave e saldo próprios em dólar, e o plano do site não dá acesso nem desconto. Toda geração é assíncrona — envia, recebe um `request_id`, acompanha o status e baixa o resultado. (Help Center, docs)

### Conta e cobrança

| Item | Valor |
|---|---|
| Console | console.higgsfield.ai (também chamado Open Higgsfield) |
| Base da API | https://api.higgsfield.ai |
| Recarga mínima | US$ 5, saldo pré-pago em dólar |
| Validade do saldo | 1 ano a partir da recarga |
| Saldo zerado | novas requisições ficam esperando; não fica negativo; existe recarga automática opcional |
| Geração que falha | não é cobrada, o valor volta ao saldo |
| Estimativa de custo | existe um endpoint que retorna o custo antes de rodar |
| Concorrência | criar a chave libera 20 requisições simultâneas; o limite cresce com o volume de recarga |
| Arquivos gerados | ficam no servidor deles por no mínimo 7 dias — precisa copiar pro nosso storage |
| Uso comercial | liberado (ads, cliente, produto) |

### Autenticação

Cabeçalho `Authorization: Key ${HF_API_KEY_ID}:${HF_API_KEY_SECRET}`. A chave aparece uma única vez na criação; se perder, gera outra. Ela só pode existir no servidor — o SDK TypeScript v2 bloqueia uso no navegador justamente pra não vazar credencial.

### Ciclo de uma geração

1. `POST https://api.higgsfield.ai/<endpoint-do-modelo>` com o JSON do modelo e o cabeçalho `Idempotency-Key` (evita job duplicado se der timeout e a gente reenviar).
2. A resposta volta na hora: `status: queued`, `request_id`, `status_url`, `cancel_url`. Usar essas URLs como vierem, sem montar na mão.
3. Acompanhar por webhook (parâmetro de query `hf_webhook=<url https>`) e manter polling no `status_url` como plano B.
4. No `completed`, baixar `video.url` ou `images[].url` e subir pro nosso storage.

### Status possíveis

| Status | Final? | O que fazer no site |
|---|---|---|
| queued | não | mostrar "na fila" e liberar botão de cancelar |
| in_progress | não | mostrar "gerando"; não dá mais pra cancelar |
| completed | sim | baixar, salvar e mostrar na galeria |
| failed | sim | mostrar o error; avisar que o valor voltou |
| nsfw | sim | marcar como bloqueado pela moderação |
| canceled | sim | marcar como cancelado |

Cancelar: `POST /requests/{id}/cancel` só funciona enquanto está `queued` (retorna 202); depois disso retorna 400.

### Webhook

- A URL precisa ser pública em HTTPS e responder em até 10 segundos.
- O corpo vem como `{ request_id, status, error, payload }`, com o vídeo em `payload.video.url` e imagens em `payload.images[].url`.
- Falha de rede ou 5xx é reenviada por até 2 horas; 4xx não é reenviado.
- Pode chegar duplicado: deduplicar por `request_id` + `status` e sempre responder 2xx pra duplicata válida.
- Rodando local (localhost), o webhook não chega — usar polling no desenvolvimento ou um túnel (ex.: cloudflared).

### Upload de referências (imagem, vídeo, áudio)

1. `POST /files/generate-upload-url` com `{"content_type":"image/jpeg"}` → recebe `upload_url`, `public_url` e `upload_headers`.
2. `PUT` do arquivo no `upload_url` com todos os `upload_headers` (sem mandar a chave da API pra esse endereço). O link de upload expira em 1 hora.
3. Passar o `public_url` no campo do modelo (`image_url`, `video_url`, `image_urls`, `audio_url`).

Formatos aceitos: jpeg, jpg, png, webp, gif, wav, mp4.

### Limite de concorrência

Quando estoura, a API devolve 400 com mensagem do tipo "Maximum number of concurrent requests (N) has been reached" e não manda `Retry-After`. O backend precisa de uma fila própria com semáforo: só envia um job novo quando um anterior termina.

### SDKs oficiais (só no servidor)

- Node/TypeScript: `npm install @higgsfield/client`, import de `@higgsfield/client/v2`, variável `HF_CREDENTIALS="id:secret"`. Usar `submit` (controle manual) no worker, não `subscribe`.
- Python: `pip install higgsfield-client`, variável `HF_KEY`.

## Modelos prioritários

O site nasce com Seedance 2.5, Genjutsu e Cinema Studio 4.0 na frente, Kling 3.0 como segunda linha e um grupo enxuto de imagem. O catálogo da API tem 84 entradas (67 de vídeo, 17 de imagem) e não é igual ao do site: Nano Banana, GPT Image 2, Seedream 5, Veo 3.1 e Sora 2 aparecem no higgsfield.ai, mas não estão na API. (catálogo)

Preço de referência: os valores abaixo são "a partir de" e mudam com resolução, áudio e promoção. O site deve buscar o custo no endpoint de estimativa da API antes de cada job, nunca usar tabela fixa no código.

### Nível 1 — aba principal

**Seedance 2.5 (ByteDance)** — o carro-chefe. A partir de US$ 0,0738/s. (docs)

| Modo | Endpoint | Entradas principais |
|---|---|---|
| Texto → vídeo | `bytedance/seedance-2.5/text-to-video` | prompt |
| Imagem → vídeo | `bytedance/seedance-2.5/image-to-video` | `image_url` (obrigatório, primeiro frame), `end_image_url` (último frame, opcional), prompt opcional |
| Referência → vídeo | `bytedance/seedance-2.5/reference-to-video` | `image_urls` (até 30), `video_urls` (até 10), `audio_urls` (até 10), no máximo 50 itens |
| Editar vídeo | `bytedance/seedance-2.5/video-edit` | `video_url` + prompt obrigatórios, refs opcionais; não mandar `duration` |
| Estender vídeo | `bytedance/seedance-2.5/video-extend` | conferir o schema na página do endpoint |

Parâmetros comuns: `duration` 4–30 s (padrão 5), `resolution` 480p / 720p / 1080p (padrão 720p), `aspect_ratio` 16:9, 4:3, 1:1, 3:4, 9:16, 21:9 (padrão 16:9; no image-to-video o enquadramento segue a imagem), `bitrate_mode` standard / high (padrão high), `generate_audio` (padrão true — o site deve vir com áudio desligado por padrão, já que o som entra na edição e muda o preço).

**Higgsfield Genjutsu** — vídeo→vídeo: mantém o movimento e a câmera do clipe original e troca personagem, objeto ou estilo. (docs)

| Modo | Endpoint | Entradas | Observações |
|---|---|---|---|
| Motion transfer | `higgsfield/genjutsu/motion-transfer/v1.0` | `video_url` + `image_urls` (1–8), prompt opcional | vídeo de 4 s no mínimo; acima de 30 s é cortado |
| Object swap | `higgsfield/genjutsu/object-swap/v1.0` | `video_url` + `image_urls` (1–8), prompt opcional | vídeo com no mínimo 409.600 px por frame (ex.: 640×640) |
| Restyle | `higgsfield/genjutsu/restyle/v1.0` | `video_url` + `preset_id` (UUID), `image_urls` até 5 opcionais | vídeo até 200 MiB; mantém o áudio original |

`resolution` 480p / 720p / 1080p em todos. A duração de saída segue o vídeo de origem. O Restyle cobra por segundo de origem arredondado pra cima (aprox. US$ 0,318 em 480p, 0,681 em 720p, 1,632 em 1080p) e os estilos vêm de `GET /models/higgsfield/genjutsu/restyle/v1.0/presets` — o site lista esses presets com a imagem de preview. Motion transfer e object swap: preço no console.

**Cinema Studio 4.0** (`higgsfield/cinema-studio/4.0`) — gerador "diretor" com controles de câmera prontos. Entradas: prompt obrigatório, refs de imagem/vídeo/áudio (mesmos limites do Seedance), `duration` 4–30 s, `resolution` 480p ou 720p, `aspect_ratio`. Controles opcionais em lista fechada: `camera_movement` (33 opções, ex.: whip-pan, crush-zoom, bullet-time, snorricam, drone-orbit), `pacing` (chaotic, dynamic, calm, single-shot), `genre`, `era`, `light`, `camera_model`, `camera_lens`, `camera_aperture`, `color_palette` (50 paletas). Campo omitido = o modelo escolhe; o valor "auto" não é aceito. No prompt dá pra citar referências com `<<<image_1>>>`, `<<<video_1>>>`. (docs)

### Nível 2 — aba "mais modelos"

| Modelo | Por que ter | Endpoints |
|---|---|---|
| Kling 3.0 | alternativa forte ao Seedance; tem 4K | `kling-video/v3.0/{std,pro,4k}/{text,image}-to-video` e `kling-video/v3.0-turbo/{text,image}-to-video` |
| Kling 3.0 Motion Control | aplica o movimento de um vídeo numa imagem | ver página do modelo |
| Kling O3 | primeiro/último frame e referências de imagem e vídeo | ver página do modelo |
| Wan 3.0 Prime | texto, frames ou referências multimodais | ver página do modelo |
| MiniMax H3 | texto, frames ou referências | ver página do modelo |

Preços de partida publicados em setembro: Kling 3.0 US$ 0,112/s, MiniMax H3 US$ 0,13/s, Wan 3.0 US$ 0,20/s (blog da Higgsfield). Em 23/09 o Kling 3.0 estava em promoção a US$ 0,042/s.

### Imagem

Modelos de imagem disponíveis na API, pra gerar frame inicial ou referência sem sair do site: SOUL V2 (`higgsfield-ai/soul/v2/standard`), SOUL Cinema, Marketing Studio Image, Grok Image 2.0 (até 10 referências, gera e edita), Qwen Image 3 (edita 1–3 referências), Ideogram 4.0, Recraft V4.1 Pro (2K) e Z-Image Turbo. SOUL V2 e Soul Cinema partem de US$ 0,0032 por imagem.

### Como o código trata os modelos

- Um registro de modelos (`models/registry.ts`) com uma entrada por endpoint: id, nome, tipo, nível, schema de entrada (Zod) e quais campos aparecem no formulário.
- O formulário é montado a partir desse schema, então adicionar modelo novo = adicionar uma entrada, sem mexer na tela.
- Os schemas são copiados das páginas da documentação de cada endpoint (cada página tem o JSON Schema completo); o openapi.json deles é só complementar.
- Nada de trocar modelo ou endpoint em silêncio: se um endpoint sumir ou der 404, o site mostra o erro.

## Stack e arquitetura

Tudo roda num único Cloudflare Worker, na mesma stack do HENNRI /MAKER e na mesma conta Cloudflare onde já estão o DNS do hennri.com e o party.hennri.com. O Worker tem URL pública, então o webhook da Higgsfield chega direto em produção.

O navegador nunca fala com a Higgsfield: pede ao Worker, que estima, envia e recebe o webhook; a Queue copia o vídeo pro R2 e o Cron recupera o que ficou parado.

| Camada | Escolha | Motivo |
|---|---|---|
| Front | Vite + React + TypeScript + Tailwind + shadcn | mesma base do /MAKER, reaproveita componentes |
| Back | Hono num Cloudflare Worker (serve API e front) | um deploy só, URL pública pro webhook |
| Banco | Cloudflare D1 | jobs, presets, projetos, gastos |
| Arquivos | Cloudflare R2 | sem taxa de saída, bom pra vídeo; guarda tudo além dos 7 dias da Higgsfield |
| Tarefas em segundo plano | Cloudflare Queues | copiar o resultado pro R2 fora da requisição |
| Recuperação | Cron Trigger a cada minuto | consulta jobs parados e libera a fila interna se um webhook se perder |
| Login | Cloudflare Access | só o e-mail do Henrique entra |
| SDK | `@higgsfield/client/v2` no Worker | autenticação, envio, status e upload prontos |
| Domínio | gen.hennri.com | segue live. e party. |

No desenvolvimento local (`wrangler dev`) o webhook não alcança o computador: usar só polling, ou um túnel cloudflared quando for testar o webhook.

## Telas e funcionalidades

São cinco telas, com a fila sempre visível. Tudo precisa funcionar no celular, porque gerar pelo telefone é um uso real.

### 1. Criar (rota `/`) — a tela principal

- Seletor de modo no topo: Texto→vídeo, Imagem→vídeo, Referências, Editar vídeo, Estender vídeo, Genjutsu (motion transfer, object swap, restyle), Cinema Studio, Imagem.
- Seletor de modelo filtrado pelo modo; os de nível 1 aparecem primeiro.
- Campo de prompt grande, com contador de caracteres e histórico dos últimos prompts (setas pra cima/baixo).
- Slots de referência: arrastar e soltar, colar do clipboard (Ctrl+V de imagem), escolher da galeria ou de um job anterior. Mostra o limite do modo (ex.: 0/30 imagens, 0/10 vídeos) e avisa antes de enviar se passar.
- Parâmetros gerados a partir do schema do modelo: duração (slider 4–30 s), resolução, proporção (com botões 9:16, 16:9, 1:1, 4:3, 3:4, 21:9 e miniatura do enquadramento), áudio (desligado por padrão), bitrate.
- No Cinema Studio, os controles de câmera, ritmo, gênero, lente e paleta aparecem como chips com "automático" pré-selecionado.
- No Genjutsu Restyle, grade com os presets e a imagem de preview de cada um.
- Variações: gerar de 1 a 4 jobs iguais de uma vez (útil pra escolher o melhor take).
- Custo estimado ao vivo: "US$ 0,74 × 3 variações = US$ 2,21 (≈ R$ X)", atualizado a cada mudança de parâmetro.
- Botão Gerar com atalho Ctrl/Cmd+Enter; seletor de projeto e de preset ao lado.

### 2. Fila (painel lateral fixo no desktop, gaveta no celular)

- Um card por job: miniatura da referência, modelo, status, tempo decorrido, custo estimado.
- Cancelar enquanto estiver queued; depois disso o botão some.
- Jobs aguardando vaga de concorrência aparecem como "aguardando vaga" (fila interna, ainda não enviados).
- Notificação do navegador e som curto quando um job termina.

### 3. Galeria (`/galeria`)

- Grade de vídeos que tocam ao passar o mouse (sem som), filtros por modelo, modo, projeto, data, favoritos e status.
- Detalhe do job: player, prompt, todos os parâmetros, referências usadas, custo, duração da geração.
- Ações rápidas: baixar, copiar prompt, favoritar, refazer igual, refazer editando, usar como referência, abrir no Genjutsu, estender com Seedance 2.5.
- "Continuar cena": captura o último frame do vídeo no navegador (via `<video>` + canvas) e abre o Imagem→vídeo com ele como primeiro frame.
- Comparar 2 a 4 vídeos lado a lado, tocando sincronizados.
- Linhagem: cada job mostra de qual job ele veio (refazer, estender, continuar).

### 4. Presets e projetos (`/presets`)

- Projeto = cliente ou campanha; todo job pertence a um (padrão: "Sem projeto").
- Preset = modelo + modo + parâmetros + prompt base com trechos variáveis (ex.: `{{produto}}`), aplicável em um clique na tela Criar.

### 5. Custos e configurações (`/custos`, `/config`)

- Gasto do dia, da semana e do mês; gasto por modelo e por projeto; custo médio por job aceito.
- Link direto pro saldo e cobrança no console da Higgsfield.
- Configurações: limite diário e mensal em US$, valor acima do qual pede confirmação extra, concorrência máxima, cotação do dólar pra mostrar em reais, padrões (resolução, proporção, áudio).

## Controle de custo e segurança

A chave da API é dinheiro: ela fica só no servidor, o site inteiro fica atrás de login e nenhum job sai sem passar pela estimativa e pelos limites de gasto.

### Custo

- Estimativa obrigatória: antes de enviar, o backend chama o endpoint de estimativa da API e guarda o valor no job. Se a estimativa falhar, o job não sai.
- Limite diário e mensal em US$, configuráveis. Ao estourar, o botão Gerar trava com a mensagem do quanto falta.
- Confirmação extra acima de um valor por envio (padrão US$ 5). Exemplo do porquê: um Genjutsu Restyle de 30 s em 1080p fica perto de US$ 49.
- Padrões econômicos: 720p, 5 s, áudio desligado, 1 variação. Subir resolução é decisão consciente.
- Concorrência máxima configurável, padrão 4 (a conta libera 20), pra um clique errado em massa não virar conta alta.
- Gasto contabilizado só para completed; failed, nsfw e canceled aparecem com custo zero, já que a Higgsfield devolve o valor.

### Segurança

- Credencial `HF_CREDENTIALS` (formato `id:secret`) como secret do Worker (`wrangler secret put`), nunca em arquivo commitado, nunca enviada ao navegador, nunca em log.
- Login: Cloudflare Access (Zero Trust) na frente de todo o domínio, liberado só pro e-mail do Henrique. Sem tela de login própria.
- Webhook: rota pública `/api/webhooks/higgsfield` (fora do Access) com um token secreto na query. Como a documentação não descreve assinatura, o backend não confia no corpo: ao receber, consulta o `status_url` com a chave e só então atualiza o job.
- `Idempotency-Key` = o id do job no nosso banco, gerado antes do envio. Reenvio por timeout usa a mesma chave e não cria job duplicado.
- Upload: só aceita os tipos que a API aceita (jpeg, png, webp, gif, wav, mp4) e checa tamanho antes de enviar.
- O build do front é verificado pra garantir que a chave não aparece em nenhum arquivo (grep no dist).

### Em aberto (confirmar na documentação ao implementar)

- [ ] Caminho e formato do endpoint de estimativa de custo.
- [ ] Se existe endpoint de saldo da conta, pra mostrar o saldo no site.
- [ ] Se a resposta do job traz o custo real cobrado, pra comparar com a estimativa.
- [ ] Preço por segundo do Genjutsu motion transfer e object swap.

## Modelo de dados e estrutura de pastas

O banco (D1, SQLite) tem cinco tabelas; o job é o centro de tudo e o id dele também é a `Idempotency-Key` enviada à API.

| Tabela | Campos principais |
|---|---|
| jobs | id (uuid), batch_id, parent_job_id, project_id, preset_id, model_id, mode, prompt, params_json, refs_json, status, hf_request_id, hf_status_url, hf_cancel_url, estimated_cost_usd, error, output_source_url, output_r2_key, thumb_r2_key, favorite, created_at, submitted_at, completed_at |
| assets | id, kind (image, video, audio, frame), r2_key, hf_public_url, mime, bytes, width, height, duration_s, source_job_id, created_at |
| projects | id, name, color, archived, created_at |
| presets | id, name, project_id, model_id, mode, params_json, prompt_template, created_at |
| settings | key, value (limites de gasto, concorrência, cotação, padrões) |

Status internos do job: `waiting_slot` (criado, esperando vaga de concorrência) → `submitting` → os status da API (`queued`, `in_progress`, `completed`, `failed`, `nsfw`, `canceled`) → `saving` (copiando pro R2) → `saved`. A galeria só mostra como pronto o que chegou em `saved`.

### Estrutura de pastas

```
hennri-gen/
├── BRIEFING.md              ← este documento, exportado
├── CLAUDE.md                ← regras do projeto pro Claude Code
├── wrangler.jsonc           ← Worker, D1, R2, Queue, cron, assets
├── migrations/              ← SQL do D1, numerado
├── src/
│   ├── shared/
│   │   ├── models/registry.ts   ← um registro por endpoint + schema Zod
│   │   └── types.ts
│   ├── worker/
│   │   ├── index.ts             ← app Hono + handlers de cron e queue
│   │   ├── routes/              ← generate, jobs, uploads, webhooks, presets, costs, settings
│   │   ├── lib/higgsfield.ts    ← cliente da API (submit, status, cancel, estimate, upload)
│   │   ├── lib/dispatcher.ts    ← fila interna e semáforo de concorrência
│   │   ├── lib/save-output.ts   ← copia o resultado pro R2 e gera miniatura
│   │   └── lib/spend.ts         ← limites e somatórios de gasto
│   └── web/
│       ├── pages/               ← Criar, Galeria, Job, Presets, Custos, Config
│       ├── components/          ← ModelForm, RefSlots, QueuePanel, VideoCard, CostBadge…
│       └── lib/                 ← cliente da API interna, captura de frame
└── tests/
```

## Identidade visual da interface

O site se chama MISE.IA e mora em gen.hennri.com, seguindo o padrão de /OS, /LIVE e /MAKER: preto e branco, editorial, e quem tem cor é o vídeo, não a interface.

- Paleta: fundo `#09090B`, texto cream `#E8E0D5`, branco e cinzas. Sem cor de acento; nada de verde.
- Tipografia: família Fixture (Fixture, Condensed, Ultra), a mesma do /MAKER — os arquivos de fonte vêm do bundle do Claude Design desse projeto.
- Componentes: botões pill, badges, números grandes (custo do dia, contagem da fila), muito respiro.
- Status sem cor gritante: "gerando" com um pulso discreto; o vermelho fica reservado pra erro e estouro de limite.
- A galeria é a estrela: os vídeos ocupam o máximo de tela, a interface recua (controles aparecem no hover ou no toque).
- Logo: wordmark nos espaços largos, isotipo nos apertados (aba do navegador, menu do celular). Considerar o rebranding em andamento (® no lugar do ponto).
- Tema escuro único; layout pensado primeiro pro celular na tela Criar e na fila, e pro desktop na galeria.
- Microinterações curtas e rápidas, sem animação lenta de entrada travando o fluxo.

## Fases de entrega e checklist de testes

Cinco fases, cada uma termina com algo usável e só começa a próxima depois do Henrique testar. Gasto de teste: usar 480p e 4–5 s até a fase 3.

1. **Base no ar** — Worker com Hono, D1 com as migrations, bucket R2, secret da chave, Cloudflare Access no gen.hennri.com, rota `/api/health` que confirma que a chave funciona. Pronto quando: abrir o site pede login e o health check responde ok.
2. **Primeiro vídeo** — Seedance 2.5 texto→vídeo e imagem→vídeo, upload de referência, estimativa de custo, envio com Idempotency-Key, polling, cópia pro R2 e player. Pronto quando: um vídeo gerado pelo celular aparece salvo e toca.
3. **Fila de verdade** — webhook com revalidação, cron de recuperação, semáforo de concorrência, variações, cancelar, galeria com filtros e ações, "continuar cena". Todos os modos do Seedance 2.5, Genjutsu (3 modos, com presets do Restyle) e Cinema Studio 4.0.
4. **Controle** — limites de gasto, confirmação extra, tela de custos, projetos, presets com variáveis, configurações.
5. **Expansão e acabamento** — modelos de nível 2 e de imagem, comparar vídeos, linhagem, notificações, IDV final e revisão no celular.

### Checklist de testes (rodar ao fim das fases 2 e 3)

- [ ] A chave não aparece em nenhum arquivo do build do front.
- [ ] Sem login, todas as rotas (menos o webhook) são bloqueadas.
- [ ] Webhook com token errado responde 401 e não altera nada.
- [ ] Webhook duplicado não cria registro nem cópia em dobro.
- [ ] Reenvio após timeout com a mesma Idempotency-Key não gera job duplicado.
- [ ] Ao bater o limite de concorrência, os jobs ficam em waiting_slot e saem sozinhos depois.
- [ ] Job failed e nsfw aparecem com motivo e custo zero.
- [ ] Cancelar funciona em queued e o botão some em in_progress.
- [ ] Vídeo continua tocando depois que o link da Higgsfield expira (servido do R2).
- [ ] Limite diário bloqueia o envio e mostra quanto falta.
- [ ] Com o webhook desligado, o cron recupera todos os jobs pendentes.
- [ ] Tela Criar e fila funcionam no celular (upload pela câmera/galeria do telefone).
