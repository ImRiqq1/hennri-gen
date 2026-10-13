import { createContext, useContext, type ReactNode } from "react"
import type { JobView } from "@shared/generation"
import { useToast } from "@/components/Toaster"
import { useLiveJobs } from "@/lib/jobs"
import { cn } from "@/lib/utils"

// Um único polling de jobs pro site todo: a fila do Criar lê daqui, e o aviso de
// "terminou" (toast + som + notificação do navegador) funciona em qualquer página.

const JobsCtx = createContext<JobView[] | null>(null)
export const useJobs = () => useContext(JobsCtx)

const PREFS_KEY = "mise:avisos"
export type AlertPrefs = { sound: boolean; notify: boolean }

export function readAlertPrefs(): AlertPrefs {
  try {
    return { sound: true, notify: false, ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}") }
  } catch {
    return { sound: true, notify: false }
  }
}
export function saveAlertPrefs(p: AlertPrefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p))
  } catch {
    // sem storage: vale só nesta sessão
  }
}

let audioCtx: AudioContext | null = null
/** Som curto sintetizado (sem arquivo): dois toques subindo = pronto; um grave = falhou. */
export function chime(ok: boolean) {
  try {
    audioCtx ??= new AudioContext()
    const ctx = audioCtx
    const notes = ok ? [880, 1318.5] : [330]
    notes.forEach((f, i) => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = "sine"
      o.frequency.value = f
      const t = ctx.currentTime + i * 0.11
      g.gain.setValueAtTime(0, t)
      g.gain.linearRampToValueAtTime(0.12, t + 0.01)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35)
      o.connect(g).connect(ctx.destination)
      o.start(t)
      o.stop(t + 0.4)
    })
  } catch {
    // navegador sem áudio: só o toast
  }
}

export function JobsProvider({ children }: { children: ReactNode }) {
  const toast = useToast()
  const jobs = useLiveJobs((j) => {
    const ok = j.status === "saved"
    const prefs = readAlertPrefs()
    if (j.status === "canceled") return
    toast(ok ? { title: "Pronto", detail: `${j.model_id} salvo na galeria.`, tone: "success" } : { title: "Não gerou", detail: j.error ?? "Falhou (não cobrado).", tone: "error" })
    if (prefs.sound) chime(ok)
    // notificação do sistema só faz sentido com a aba em segundo plano
    if (prefs.notify && document.visibilityState !== "visible" && "Notification" in window && Notification.permission === "granted") {
      const n = new Notification(ok ? "MISE.IA — pronto" : "MISE.IA — não gerou", {
        body: ok ? `${j.model_id}${j.prompt ? ` · ${j.prompt.slice(0, 80)}` : ""}` : (j.error ?? "Falhou (não cobrado)."),
        icon: "/favicon.svg",
        tag: j.id,
      })
      n.onclick = () => {
        window.focus()
        window.location.assign("/galeria")
      }
    }
  })
  return <JobsCtx.Provider value={jobs}>{children}</JobsCtx.Provider>
}

/** Ponto no ícone/aba quando tem job rodando. */
export function LiveDot({ className }: { className?: string }) {
  const jobs = useJobs()
  const live = jobs?.some((j) => ["waiting_slot", "submitting", "queued", "in_progress", "completed", "saving"].includes(j.status))
  if (!live) return null
  return <span className={cn("absolute size-2 animate-pulse-soft rounded-full bg-accent", className)} aria-label="jobs em andamento" />
}
