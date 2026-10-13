# MISE.IA

Estúdio pessoal para gerar vídeo e imagem pela Higgsfield API, com controle de custo por job.
Produto descrito em [BRIEFING.md](BRIEFING.md); regras de desenvolvimento em [CLAUDE.md](CLAUDE.md).

## Stack

Vite + React + TypeScript + Tailwind + shadcn no front; Hono num Cloudflare Worker servindo API e
assets; D1, R2, Queues e Cron; Cloudflare Access na frente de `gen.hennri.com`.

## Rodar local

```bash
npm install
cp .dev.vars.example .dev.vars        # depois grave a chave: & .\scripts\set-hf-key.ps1
npm run db:migrate:local
npm run dev                           # http://localhost:5181
```

## Marca

Logos oficiais em `public/brand/` (assinatura, símbolo e wordmark, em branco e preto).
