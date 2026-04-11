'use client'

import Link from 'next/link'

export default function PerformanceOverlay({ title }: { title: string }) {
  return (
    <div className="fixed top-0 left-0 w-full p-6 flex justify-between items-start pointer-events-none z-50">
      <div className="bg-black/80 backdrop-blur-xl border border-white/10 p-6 rounded-2xl pointer-events-auto shadow-2xl ring-1 ring-white/5">
        <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <h3 className="text-blue-400 font-bold uppercase tracking-widest text-[10px]">Modo de Prueba Babylon.js</h3>
        </div>
        <h2 className="text-2xl font-black text-white">{title}</h2>
        <p className="text-gray-400 text-xs mt-2 max-w-[250px]">
          Usa el panel de métricas de debug (esquina superior izquierda) para evaluar el rendimiento. Abre el Inspector de Babylon desde los controles Leva.
        </p>
      </div>

      <div className="pointer-events-auto">
        <Link href="/test" className="group bg-white/5 hover:bg-white/10 backdrop-blur-md text-white border border-white/10 px-6 py-3 rounded-full font-bold transition-all text-[10px] uppercase tracking-widest flex items-center gap-2">
          Volver al Panel
        </Link>
      </div>
    </div>
  )
}
