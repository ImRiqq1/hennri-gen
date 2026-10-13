import { useCallback, useEffect, useState } from "react"
import { getHealth, type Check, type Health } from "@/lib/api"
import { cn } from "@/lib/utils"

const CHECK_LABELS: Record<keyof Health["checks"], string> = {
  higgsfield: "Higgsfield API",
  db: "Banco D1",
  files: "Arquivos R2",
}

const FASES = [
  { n: 1, nome: "Base no ar", desc: "Worker, D1, R2, chave e login" },
  { n: 2, nome: "Primeiro vídeo", desc: "Seedance 2.5, upload, estimativa, player" },
  { n: 3, nome: "Fila de verdade", desc: "Webhook, cron, variações, galeria" },
  { n: 4, nome: "Controle", desc: "Limites, custos, projetos, presets" },
  { n: 5, nome: "Expansão", desc: "Kling, Wan, imagem, comparar, IDV final" },
]

type State = { kind: "loading" } | { kind: "ok"; health: Health; at: Date } | { kind: "error"; message: string }

export function Home() {
  const [state, setState] = useState<State>({ kind: "loading" })

  const fetchHealth = useCallback(async () => {
    try {
      setState({ kind: "ok", health: await getHealth(), at: new Date() })
    } catch (e) {
      setState({ kind: "error", message: (e as Error).message })
    }
  }, [])

  const load = () => {
    setState({ kind: "loading" })
    void fetchHealth()
  }

  useEffect(() => {
    void fetchHealth()
  }, [fetchHealth])

  const allOk = state.kind === "ok" && state.health.ok

  return (
    <div className="space-y-14 sm:space-y-20">
      <section className="space-y-5">
        <p className="text-xs uppercase tracking-[0.2em] text-cream/50">Fase 1 · base no ar</p>
        <h1 className="font-condensed text-[13vw] uppercase leading-[0.9] text-paper sm:text-7xl md:text-8xl">
          Vídeo e imagem
          <br />
          <span className="text-cream/40">pela Higgsfield API.</span>
        </h1>
        <p className="max-w-xl text-base text-cream/70 sm:text-lg">
          A tela de criação chega na fase 2. Por enquanto, este painel confirma que o Worker, o banco, o
          storage e a chave da API estão de pé.
        </p>
      </section>

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xs uppercase tracking-[0.2em] text-cream/50">Health check</h2>
            <p className="mt-2 font-condensed text-4xl uppercase text-paper sm:text-5xl">
              {state.kind === "loading" ? "Checando…" : allOk ? "Tudo ok" : "Pendências"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={state.kind === "loading"}
            className="rounded-full border px-4 py-2 text-sm text-cream transition-colors hover:border-cream/40 hover:text-paper disabled:opacity-40"
          >
            Checar de novo
          </button>
        </div>

        {state.kind === "error" ? (
          <p className="border border-alert/40 bg-alert/10 p-4 text-sm text-paper">
            Não consegui falar com o Worker: {state.message}
          </p>
        ) : (
          <ul className="divide-y border-y">
            {(Object.keys(CHECK_LABELS) as (keyof Health["checks"])[]).map((key) => (
              <CheckRow
                key={key}
                label={CHECK_LABELS[key]}
                check={state.kind === "ok" ? state.health.checks[key] : null}
              />
            ))}
          </ul>
        )}

        {state.kind === "ok" && (
          <p className="text-xs text-cream/40">
            Última checagem {state.at.toLocaleTimeString("pt-BR")} · a estimativa de teste não gera nada
            nem cobra.
          </p>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-xs uppercase tracking-[0.2em] text-cream/50">Roteiro</h2>
        <ol className="grid gap-px border bg-border sm:grid-cols-5">
          {FASES.map((f) => (
            <li key={f.n} className={cn("bg-ink p-4", f.n === 1 ? "text-paper" : "text-cream/40")}>
              <span className="font-ultra text-3xl">{f.n}</span>
              <p className="mt-3 text-sm font-semibold uppercase tracking-wide">{f.nome}</p>
              <p className="mt-1 text-xs leading-relaxed opacity-70">{f.desc}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}

function CheckRow({ label, check }: { label: string; check: Check | null }) {
  return (
    <li className="flex flex-col gap-1 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className={cn(
            "size-2 rounded-full",
            !check && "animate-pulse-soft bg-cream/60",
            check?.ok && "bg-paper",
            check && !check.ok && "bg-alert",
          )}
        />
        <span className="text-base text-paper">{label}</span>
      </div>
      <span className={cn("pl-5 text-sm sm:pl-0 sm:text-right", check && !check.ok ? "text-alert" : "text-cream/60")}>
        {check ? check.detail : "…"}
      </span>
    </li>
  )
}
