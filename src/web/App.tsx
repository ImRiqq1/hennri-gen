import { AnimatePresence, motion, MotionConfig } from "motion/react"
import { Route, Routes, useLocation } from "react-router-dom"
import { Shell } from "@/components/Shell"
import { Toaster } from "@/components/Toaster"
import { Criar } from "@/pages/Criar"
import { Inicio } from "@/pages/Inicio"
import { NaoEncontrada } from "@/pages/NaoEncontrada"
import { ThemeProvider } from "@/theme/theme"

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
                <Routes location={location}>
                  <Route path="/" element={<Inicio />} />
                  <Route path="/criar" element={<Criar />} />
                  <Route path="*" element={<NaoEncontrada />} />
                </Routes>
              </motion.div>
            </AnimatePresence>
          </Shell>
        </Toaster>
      </MotionConfig>
    </ThemeProvider>
  )
}
