import { MotionConfig } from "motion/react"
import { Route, Routes } from "react-router-dom"
import { Shell } from "@/components/Shell"
import { Criar } from "@/pages/Criar"
import { Inicio } from "@/pages/Inicio"
import { ThemeProvider } from "@/theme/theme"

export default function App() {
  return (
    <ThemeProvider>
      <MotionConfig reducedMotion="user">
        <Shell>
          <Routes>
            <Route path="/" element={<Inicio />} />
            <Route path="/criar" element={<Criar />} />
            <Route path="*" element={<p className="text-text-2">Página não encontrada.</p>} />
          </Routes>
        </Shell>
      </MotionConfig>
    </ThemeProvider>
  )
}
