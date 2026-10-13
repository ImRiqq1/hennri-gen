import { motion } from "motion/react"
import { useEffect } from "react"
import { useSearchParams } from "react-router-dom"
import { Eyebrow } from "@/components/Glass"
import { Composer, ModeTabs } from "@/components/studio/Composer"
import { GalleryPeek } from "@/components/studio/GalleryPeek"
import { JobQueue } from "@/components/studio/JobQueue"
import { SpendCard, SystemCard } from "@/components/studio/SideCards"
import { useToast } from "@/components/Toaster"
import { useLiveJobs } from "@/lib/jobs"
import { api, useStudio } from "@/lib/studio"
import { getStats } from "@/lib/api"
import { MODES } from "@/lib/modes"
import { isTyping, overlayOpen } from "@/lib/shortcuts"
import { usePoll } from "@/lib/usePoll"

const ease = [0.16, 1, 0.3, 1] as const

export function Criar() {
  // O modo mora na URL (/criar?modo=genjutsu): a paleta, a Home e o histórico apontam pra ele.
  const [params, setParams] = useSearchParams()
  const modeId = MODES.some((m) => m.id === params.get("modo")) ? params.get("modo")! : MODES[0].id
  const setModeId = (id: string) => setParams(id === MODES[0].id ? {} : { modo: id }, { replace: true })
  const [stats, refreshStats] = usePoll(getStats, 15_000)
  const settings = useStudio(api.settings).data
  const projects = useStudio(api.projects).data
  const presets = useStudio(api.presets).data
  const toast = useToast()
  // Fila ao vivo; quando um job termina, avisa e atualiza o gasto.
  const jobs = useLiveJobs((j) => {
    refreshStats()
    if (j.status === "saved") toast({ title: "Pronto", detail: `${j.model_id} salvo na galeria.`, tone: "success" })
    else if (j.status === "failed" || j.status === "nsfw") toast({ title: "Não gerou", detail: j.error ?? "Falhou (não cobrado).", tone: "error" })
  })

  // 1–8 trocam de modo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e) || overlayOpen()) return
      const n = Number(e.key)
      if (Number.isInteger(n) && n >= 1 && n <= MODES.length) {
        setParams(n === 1 ? {} : { modo: MODES[n - 1].id }, { replace: true })
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [setParams])

  const mode = MODES.find((m) => m.id === modeId)!

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-4">
        <div className="min-w-0">
          <Eyebrow>Novo job</Eyebrow>
          <div className="mt-3 overflow-hidden pb-1">
            <motion.h1
              key={modeId}
              initial={{ y: "105%" }}
              animate={{ y: 0 }}
              transition={{ duration: 0.7, ease }}
              className="display-title text-page whitespace-nowrap text-text"
            >
              {mode.label}
              <span className="text-accent">.</span>
            </motion.h1>
          </div>
        </div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease, delay: 0.1 }} className="min-w-0">
          <ModeTabs value={modeId} onChange={setModeId} />
        </motion.div>
      </div>

      <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_300px] 2xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-3">
          {settings && projects && presets ? (
            <Composer modeId={modeId} spend={stats.kind === "ok" ? stats.data.spend : null} settings={settings} projects={projects} presets={presets} />
          ) : (
            <span className="skeleton block h-[560px] rounded-[24px]" aria-busy="true" aria-label="Carregando o Criar" />
          )}
          <GalleryPeek stats={stats} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <JobQueue jobs={jobs} />
          <SpendCard stats={stats} />
          <div className="sm:col-span-2 lg:col-span-1">
            <SystemCard />
          </div>
        </div>
      </div>

    </div>
  )
}
