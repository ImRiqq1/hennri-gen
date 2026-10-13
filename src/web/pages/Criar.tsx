import { motion } from "motion/react"
import { useState } from "react"
import { Composer, ModeTabs } from "@/components/studio/Composer"
import { GalleryPeek } from "@/components/studio/GalleryPeek"
import { Roadmap } from "@/components/studio/Roadmap"
import { QueueCard, SpendCard, SystemCard } from "@/components/studio/SideCards"
import { getStats } from "@/lib/api"
import { usePoll } from "@/lib/usePoll"

const ease = [0.16, 1, 0.3, 1] as const

export function Criar() {
  const [modeId, setModeId] = useState("t2v")
  const [stats] = usePoll(getStats, 15_000)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="overflow-hidden">
          <motion.h1
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            transition={{ duration: 0.8, ease }}
            className="font-condensed text-[clamp(44px,8vw,88px)] uppercase leading-[0.86] text-text"
          >
            Criar<span className="text-accent">.</span>
          </motion.h1>
        </div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease, delay: 0.1 }}
          className="min-w-0"
        >
          <ModeTabs value={modeId} onChange={setModeId} />
        </motion.div>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Composer modeId={modeId} />
          <div className="hidden lg:block">
            <GalleryPeek stats={stats} />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <QueueCard stats={stats} />
          <SpendCard stats={stats} />
          <div className="sm:col-span-2 lg:col-span-1">
            <SystemCard />
          </div>
        </div>
      </div>

      <div className="lg:hidden">
        <GalleryPeek stats={stats} />
      </div>
      <Roadmap />
    </div>
  )
}
