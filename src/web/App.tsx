import { AnimatePresence, motion, MotionConfig } from "motion/react"
import { lazy, Suspense } from "react"
import { Route, Routes, useLocation } from "react-router-dom"
import { Shell } from "@/components/Shell"
import { Toaster } from "@/components/Toaster"
import { ThemeProvider } from "@/theme/theme"

// Cada página vira um pedaço de JS separado: a Início não baixa o código de upload do Criar.
const Inicio = lazy(() => import("@/pages/Inicio").then((m) => ({ default: m.Inicio })))
const Criar = lazy(() => import("@/pages/Criar").then((m) => ({ default: m.Criar })))
const Galeria = lazy(() => import("@/pages/Galeria").then((m) => ({ default: m.Galeria })))
const NaoEncontrada = lazy(() => import("@/pages/NaoEncontrada").then((m) => ({ default: m.NaoEncontrada })))

function PageSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="Carregando">
      <span className="skeleton h-4 w-24 rounded-full" />
      <span className="skeleton h-11 w-72 rounded-2xl" />
      <span className="skeleton mt-3 h-[420px] w-full rounded-[24px]" />
    </div>
  )
}
export default function App() {
  const location = useLocation()
  return (
    <ThemeProvider>
      <MotionConfig reducedMotion="user">
        <Toaster>
          <Shell>
            {/* Troca de página: fade + deslize curto (saída mais rápida que a entrada). */}
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0, transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] } }}
                exit={{ opacity: 0, y: -4, transition: { duration: 0.12 } }}
              >
                <Suspense fallback={<PageSkeleton />}>
                  <Routes location={location}>
                    <Route path="/" element={<Inicio />} />
                    <Route path="/criar" element={<Criar />} />
                    <Route path="/galeria" element={<Galeria />} />
                    <Route path="*" element={<NaoEncontrada />} />
                  </Routes>
                </Suspense>
              </motion.div>
            </AnimatePresence>
          </Shell>
        </Toaster>
      </MotionConfig>
    </ThemeProvider>
  )
}
