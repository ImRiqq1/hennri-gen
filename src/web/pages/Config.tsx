import { Check, ExternalLink, Loader2 } from "lucide-react"
import { useState, type ReactNode } from "react"
import { chime, readAlertPrefs, saveAlertPrefs } from "@/components/JobsProvider"
import { Eyebrow, GlassCard } from "@/components/Glass"
import { useToast } from "@/components/Toaster"
import { ASPECTS } from "@/lib/modes"
import { api, notifyStudio, useStudio, type Settings } from "@/lib/studio"
import { cn } from "@/lib/utils"

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 border-b border-line py-4 last:border-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0">
        <p className="text-sm font-medium text-text">{label}</p>
        {hint && <p className="mt-0.5 text-[13px] text-text-3">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function Money({ value, onChange, id, step = 1 }: { value: number; onChange: (n: number) => void; id: string; step?: number }) {
  return (
    <label htmlFor={id} className="flex h-10 w-[170px] items-center gap-2 rounded-full border border-line-2 bg-surface px-3.5 focus-within:border-text-3">
      <span className="font-mono text-xs text-text-3">US$</span>
      <input
        id={id}
        type="number"
        min={0}
        step={step}
        value={Number.isFinite(value) ? value : ""}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full bg-transparent text-right text-sm text-text tabular outline-none"
      />
    </label>
  )
}

function Seg<T extends string>({ options, value, onChange, label }: { options: readonly T[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1 rounded-full bg-surface p-1">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          role="radio"
          aria-checked={o === value}
          onClick={() => onChange(o)}
          className={cn("rounded-full px-3 py-1.5 text-sm tabular transition-colors", o === value ? "bg-invert text-invert-ink" : "text-text-2 hover:text-text")}
        >
          {o}
        </button>
      ))}
    </div>
  )
}

export function Config() {
  const { data } = useStudio(api.settings)
  if (!data) {
    return (
      <div className="flex flex-col gap-3">
        <span className="skeleton h-11 w-64 rounded-2xl" />
        <span className="skeleton h-[480px] rounded-[24px]" />
      </div>
    )
  }
  return <ConfigForm initial={data} />
}

function ConfigForm({ initial }: { initial: Settings }) {
  const [saved, setSaved] = useState(initial)
  const [form, setForm] = useState<Settings>(initial)
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  const dirty = JSON.stringify(form) !== JSON.stringify(saved)
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setForm((f) => ({ ...f, [k]: v }))
  const problem =
    form.limite_diario_usd > form.limite_mensal_usd
      ? "O limite diário não pode passar do mensal."
      : form.concorrencia_max < 1 || form.concorrencia_max > 20
        ? "Concorrência entre 1 e 20."
        : Object.values(form.desconto_pct ?? {}).some((v) => !(v >= 0 && v <= 95))
          ? "Desconto entre 0 e 95%."
          : null

  async function save() {
    if (problem) return
    setSaving(true)
    try {
      const next = await api.saveSettings(form)
      setForm(next)
      setSaved(next)
      notifyStudio()
      toast({ title: "Configurações salvas", tone: "success" })
    } catch (e) {
      toast({ title: "Não salvou", detail: (e as Error).message, tone: "error" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex max-w-[860px] flex-col gap-4">
      <div>
        <Eyebrow>Estúdio</Eyebrow>
        <h1 className="display-title mt-3 text-page text-text">
          Configurações<span className="text-accent">.</span>
        </h1>
      </div>

      <GlassCard className="px-5 py-1">
        <p className="label pt-4">Gasto</p>
        <Row label="Limite diário" hint="Ao bater, o Gerar trava e mostra quanto falta. Conta o que está na fila.">
          <Money id="lim-dia" value={form.limite_diario_usd} onChange={(n) => set("limite_diario_usd", n)} />
        </Row>
        <Row label="Limite mensal" hint="Mesmo comportamento, somando o mês (fuso de São Paulo).">
          <Money id="lim-mes" value={form.limite_mensal_usd} onChange={(n) => set("limite_mensal_usd", n)} step={10} />
        </Row>
        <Row label="Pedir confirmação acima de" hint="Por envio (todos os takes somados). Ex.: um Restyle de 30 s em 1080p passa de US$ 48.">
          <Money id="confirma" value={form.confirmacao_acima_usd} onChange={(n) => set("confirmacao_acima_usd", n)} step={0.5} />
        </Row>
        <Row label="Cotação do dólar" hint="Só pra mostrar o equivalente em reais.">
          <label className="flex h-10 w-[170px] items-center gap-2 rounded-full border border-line-2 bg-surface px-3.5 focus-within:border-text-3">
            <span className="font-mono text-xs text-text-3">R$</span>
            <input
              type="number"
              min={0.1}
              step={0.01}
              value={form.cotacao_brl}
              onChange={(e) => set("cotacao_brl", Number(e.target.value))}
              aria-label="Cotação do dólar em reais"
              className="w-full bg-transparent text-right text-sm text-text tabular outline-none"
            />
          </label>
        </Row>
      </GlassCard>

      <GlassCard className="px-5 py-1">
        <p className="label pt-4">Desconto da conta na Higgsfield</p>
        <p className="mt-1 text-[13px] text-text-3">
          Pra estes modelos a API só informa a tabela cheia, então o desconto vem daqui. Kling, Wan e MiniMax já chegam com desconto e se atualizam
          sozinhos. Confira em console.higgsfield.ai → preços ("Your current price").
        </p>
        {(
          [
            ["seedance", "Seedance 2.5", "texto, imagem, referências, editar e estender"],
            ["genjutsu", "Genjutsu", "motion transfer, object swap e restyle"],
            ["cinema", "Cinema Studio 4.0", ""],
          ] as const
        ).map(([k, label, hint]) => (
          <Row key={k} label={label} hint={hint || undefined}>
            <label className="flex h-10 w-[120px] items-center gap-2 rounded-full border border-line-2 bg-surface px-3.5 focus-within:border-text-3">
              <input
                type="number"
                min={0}
                max={95}
                step={1}
                value={form.desconto_pct?.[k] ?? 0}
                onChange={(e) => set("desconto_pct", { ...(form.desconto_pct ?? { seedance: 0, genjutsu: 0, cinema: 0 }), [k]: Number(e.target.value) })}
                aria-label={`Desconto ${label} em %`}
                className="w-full bg-transparent text-right text-sm text-text tabular outline-none"
              />
              <span className="font-mono text-xs text-text-3">%</span>
            </label>
          </Row>
        ))}
      </GlassCard>

      <GlassCard className="px-5 py-1">
        <p className="label pt-4">Fila</p>
        <Row label="Concorrência máxima" hint="Quantos jobs rodam ao mesmo tempo na Higgsfield (a conta libera 20). O resto espera vaga.">
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={1}
              max={20}
              value={form.concorrencia_max}
              onChange={(e) => set("concorrencia_max", Number(e.target.value))}
              aria-label="Concorrência máxima"
              className="h-1.5 w-40 cursor-pointer appearance-none rounded-full accent-[var(--accent)]"
              style={{ background: `linear-gradient(90deg, var(--accent) ${((form.concorrencia_max - 1) / 19) * 100}%, var(--line-2) 0)` }}
            />
            <span className="display-num w-8 text-right text-[22px] text-text">{form.concorrencia_max}</span>
          </div>
        </Row>
      </GlassCard>

      <GlassCard className="px-5 py-1">
        <p className="label pt-4">Padrões do Criar</p>
        <Row label="Resolução" hint="Subir resolução é decisão consciente — o padrão é econômico.">
          <Seg label="Resolução padrão" options={["480p", "720p", "1080p"] as const} value={form.padrao_resolucao as "720p"} onChange={(v) => set("padrao_resolucao", v)} />
        </Row>
        <Row label="Proporção">
          <Seg label="Proporção padrão" options={ASPECTS.map((a) => a.id)} value={form.padrao_proporcao as "16:9"} onChange={(v) => set("padrao_proporcao", v)} />
        </Row>
        <Row label="Duração" hint="4 a 30 s.">
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={4}
              max={30}
              value={form.padrao_duracao}
              onChange={(e) => set("padrao_duracao", Number(e.target.value))}
              aria-label="Duração padrão"
              className="h-1.5 w-40 cursor-pointer appearance-none rounded-full accent-[var(--accent)]"
              style={{ background: `linear-gradient(90deg, var(--accent) ${((form.padrao_duracao - 4) / 26) * 100}%, var(--line-2) 0)` }}
            />
            <span className="display-num w-10 text-right text-[22px] text-text">{form.padrao_duracao}s</span>
          </div>
        </Row>
        <Row label="Áudio" hint="O som entra na edição; ligar muda o preço em alguns modelos.">
          <Seg label="Áudio padrão" options={["desligado", "ligado"] as const} value={form.padrao_audio ? "ligado" : "desligado"} onChange={(v) => set("padrao_audio", v === "ligado")} />
        </Row>
      </GlassCard>

      <AlertsCard />

      <GlassCard className="flex flex-wrap items-center justify-between gap-3 p-4">
        <a href="https://console.higgsfield.ai" target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-text-2 hover:text-text">
          <ExternalLink className="size-4" /> Saldo e cobrança no console da Higgsfield
        </a>
        <div className="flex items-center gap-3">
          {problem && <span className="text-sm text-danger">{problem}</span>}
          <button
            type="button"
            disabled={!dirty || saving || !!problem}
            onClick={() => void save()}
            className="flex h-10 items-center gap-2 rounded-full bg-accent px-5 text-sm font-medium text-accent-ink transition-opacity disabled:opacity-40"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            {dirty ? "Salvar" : "Salvo"}
          </button>
        </div>
      </GlassCard>
    </div>
  )
}

/** Avisos ficam no navegador (cada aparelho decide), não no banco. */
function AlertsCard() {
  const [prefs, setPrefs] = useState(readAlertPrefs)
  const [perm, setPerm] = useState(() => ("Notification" in window ? Notification.permission : "unsupported"))
  const toast = useToast()
  const update = (p: typeof prefs) => {
    setPrefs(p)
    saveAlertPrefs(p)
  }
  async function toggleNotify(on: boolean) {
    if (on && perm !== "granted") {
      if (!("Notification" in window)) return toast({ title: "Este navegador não tem notificações", tone: "error" })
      const r = await Notification.requestPermission()
      setPerm(r)
      if (r !== "granted") return toast({ title: "Permissão negada", detail: "Libere as notificações do site nas configurações do navegador.", tone: "error" })
    }
    update({ ...prefs, notify: on })
  }
  return (
    <GlassCard className="px-5 py-1">
      <p className="label pt-4">Avisos neste navegador</p>
      <Row label="Som quando um job termina" hint="Dois toques = pronto; um grave = não gerou.">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => chime(true)} className="text-xs text-text-3 hover:text-text">
            testar
          </button>
          <Seg label="Som" options={["desligado", "ligado"] as const} value={prefs.sound ? "ligado" : "desligado"} onChange={(v) => update({ ...prefs, sound: v === "ligado" })} />
        </div>
      </Row>
      <Row
        label="Notificação do sistema"
        hint={perm === "denied" ? "Bloqueada no navegador — libere nas configurações do site." : "Aparece quando a aba está em segundo plano; clicar abre a Galeria."}
      >
        <Seg label="Notificação" options={["desligado", "ligado"] as const} value={prefs.notify && perm === "granted" ? "ligado" : "desligado"} onChange={(v) => void toggleNotify(v === "ligado")} />
      </Row>
    </GlassCard>
  )
}
