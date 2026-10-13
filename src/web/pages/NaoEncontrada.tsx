import { ArrowLeft, Sparkles } from "lucide-react"
import { Link, useLocation } from "react-router-dom"
import { LogoSimbolo } from "@/brand/Logo"
import { GlassCard } from "@/components/Glass"

const FUTURAS: Record<string, string> = {
}

export function NaoEncontrada() {
  const { pathname } = useLocation()
  const futura = FUTURAS[pathname]
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <GlassCard className="flex w-full max-w-[520px] flex-col items-center p-8 text-center">
        <LogoSimbolo className="size-12 text-text-3" />
        <p className="label mt-6">{futura ? "Em breve" : "404"}</p>
        <h1 className="display-title mt-2 text-page text-text">{futura ? "Ainda não existe" : "Página não encontrada"}</h1>
        <p className="mt-3 text-[15px] text-text-2">
          {futura ?? (
            <>
              Nada mora em <code className="rounded-md bg-surface px-1.5 py-0.5 font-mono text-[13px] text-text">{pathname}</code>.
            </>
          )}
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-2">
          <Link to="/" className="glass-2 flex h-10 items-center gap-2 rounded-full px-4 text-sm text-text transition-colors hover:border-line-2">
            <ArrowLeft className="size-4" /> Início
          </Link>
          <Link to="/criar" className="flex h-10 items-center gap-2 rounded-full bg-accent px-4 text-sm font-medium text-accent-ink">
            <Sparkles className="size-4" /> Criar
          </Link>
        </div>
      </GlassCard>
    </div>
  )
}
