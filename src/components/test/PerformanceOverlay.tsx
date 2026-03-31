'use client'

import { useEffect, useState } from 'react'
import { subscribe } from '@/app/game/gameState'

interface PerformanceOverlayProps {
  title: string
}

export default function PerformanceOverlay({ title }: PerformanceOverlayProps) {
  const [fps, setFps] = useState(0)

  useEffect(() => {
    const unsubscribe = subscribe((state) => {
      setFps(Math.round(state.fps))
    })
    return unsubscribe
  }, [])

  return (
    <div className="fixed top-8 left-8 z-50 flex flex-col gap-1 pointer-events-none select-none">
      <div className="bg-black/60 backdrop-blur-md px-4 py-2 border border-white/10 rounded-xl shadow-2xl">
        <h1 className="text-white font-black text-xl tracking-tight uppercase italic flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          {title}
        </h1>
      </div>
      
      <div className="bg-black/60 backdrop-blur-md px-4 py-2 border border-white/10 rounded-xl flex items-center gap-3 w-fit">
        <div className={`w-3 h-3 rounded-full ${
          fps > 55 ? 'bg-green-500' : fps > 30 ? 'bg-yellow-500' : 'bg-red-500'
        } shadow-[0_0_10px_currentColor]`} />
        <span className="text-white font-mono text-lg font-bold">
          {fps} <span className="text-[10px] text-zinc-400 font-normal uppercase">FPS</span>
        </span>
      </div>

      <div className="mt-2 text-white/20 text-[10px] font-mono leading-tight max-w-[200px]">
        DIAGNOSTIC MODE: ACTIVE<br />
        SAMPLING: INTERPOLATED (REALTIME)
      </div>
    </div>
  )
}
