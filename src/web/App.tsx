import { Route, Routes } from "react-router-dom"
import { Shell } from "@/components/Shell"
import { Home } from "@/pages/Home"

export default function App() {
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="*" element={<p className="text-cream/60">Página não encontrada.</p>} />
      </Routes>
    </Shell>
  )
}
