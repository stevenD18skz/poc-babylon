'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import type { Engine, Scene } from '@babylonjs/core'

interface PerformanceOverlayProps {
  title: string
  input?: boolean
  count?: number
  setCount?: (count: number) => void
  unit?: 'thousands' | 'normal'
  engine?: Engine | null
  scene?: Scene | null
}

export default function PerformanceOverlay({
  title,
  input,
  count,
  setCount,
  unit = 'thousands',
  engine,
  scene,
}: PerformanceOverlayProps) {
  const isThousands = unit === 'thousands'
  const multiplier = isThousands ? 1000 : 1
  const unitLabel = isThousands ? 'TRIS' : 'OBJ'

  useEffect(() => {
    if (!engine || !scene) return

    const metricsInterval = setInterval(() => {
      // FPS Promedio
      const fpsAvg = engine.getFps().toFixed(2)

      // GPU (ms/frame)
      const gpuMs = engine.getDeltaTime().toFixed(3)

      // CPU (ms/frame)
      const cpuMs = engine.getDeltaTime().toFixed(3)

      // RAM (MB)
      const ramMb =
        (
          ((performance as any).memory?.usedJSHeapSize || 0) /
          1048576
        ).toFixed(2)

      // VRAM Estimada (MB) — aproximación basada en texturas del engine
      let vramValue = 0
      if (scene.textures) {
        for (const texture of scene.textures) {
          if (texture.getBaseSize) {
            const size = texture.getBaseSize()
            // Aproximación: 4 bytes por pixel (RGBA)
            vramValue += (size.width * size.height * 4) / 1048576
          }
        }
      }
      const vramMb = vramValue.toFixed(2)

      // Draw Calls — Babylon almacena esto en _drawCalls
      const drawCalls = (engine as any)._drawCalls || 0

      // Triángulos en escena
      let totalTriangles = 0
      for (const mesh of scene.meshes) {
        if (mesh.geometry) {
          const vertexCount = mesh.geometry.getTotalVertices()
          // Asumiendo que es un índice buffer, dividimos por 3
          const indices = mesh.getIndices?.()
          if (indices) {
            totalTriangles += indices.length / 3
          } else {
            totalTriangles += vertexCount / 3
          }
        }
      }

      // Log consolidado cada 3 segundos
      console.log(
        `%c[PERFORMANCE METRICS]`,
        'color: #00ff00; font-weight: bold; font-size: 12px;',
        {
          'FPS Promedio': parseFloat(fpsAvg),
          'GPU (ms/frame)': parseFloat(gpuMs),
          'CPU (ms/frame)': parseFloat(cpuMs),
          'RAM (MB)': parseFloat(ramMb),
          'VRAM Estimada (MB)': parseFloat(vramMb),
          'Draw Calls': drawCalls,
          'Triángulos en escena': Math.round(totalTriangles),
        }
      )
    }, 3000)

    return () => clearInterval(metricsInterval)
  }, [engine, scene])

  return (
    <div className="fixed top-0 left-0 w-full h-full pointer-events-none z-50 p-6 flex justify-start items-start text-left">
      {/* Panel Único Consolidado en la Izquierda */}
      <div className="bg-black/85 backdrop-blur-2xl border border-white/10 p-1 rounded-3xl pointer-events-auto shadow-[0_20px_50px_rgba(0,0,0,0.5)] ring-1 ring-white/10 w-80 overflow-hidden flex flex-col transition-all duration-500 ease-in-out">
        {/* Superior: Botón Volver integrado */}
        <div className="p-2 border-b border-white/5">
          <Link
            href="/test"
            className="group w-full bg-white/5 hover:bg-white/10 text-white/70 hover:text-white px-4 py-3 rounded-4xl font-bold transition-all text-[9px] uppercase tracking-[0.2em] flex items-center justify-center gap-3"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-1"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Volver al Panel
          </Link>
        </div>

        {/* Medio: Información */}
        <div className="px-6 py-3 flex flex-col gap-2">
          <div className="flex items-center justify-start gap-2 mb-1">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_#3b82f6] animate-pulse" />
            <h3 className="text-blue-400 font-bold uppercase tracking-widest text-[8px] opacity-80">
              {engine ? 'BABYLON Engine' : 'R3F Engine'}
            </h3>
          </div>
          <h2 className="text-2xl font-black text-white leading-tight tracking-tight">{title}</h2>
          <p className="text-white/40 text-[10px] leading-relaxed font-medium">
            {engine
              ? 'Monitorización activa en Babylon.JS — Métricas en consola cada 3s'
              : 'Monitorización activa del viewport y carga geométrica.'}
          </p>
        </div>

        {/* Inferior: Controles (si aplica) */}
        {input && count !== undefined && setCount && (
          <div className="bg-white/5 px-6 py-3 border-t border-white/10 flex flex-col gap-4 rounded-3xl">
            <div className="flex justify-between items-center mb-1">
              <label className="text-[12px] uppercase tracking-[0.15em] font-black text-white/50">
                Carga
              </label>
              <span
                suppressHydrationWarning
                className="text-[16px] font-mono text-indigo-400 font-bold bg-indigo-500/15 px-3 py-1 rounded-full border border-indigo-500/30 shadow-inner"
              >
                {count.toLocaleString()} <span className="text-[8px] opacity-70 ml-1">{unitLabel}</span>
              </span>
            </div>

            <div className="relative h-6 flex items-center">
              <input
                type="range"
                min="0"
                max={isThousands ? 12 : 10}
                step="1"
                className="w-full accent-blue-500 cursor-pointer h-1 bg-white/10 rounded-full appearance-none hover:bg-white/20 transition-colors"
                value={Math.log2(count / multiplier)}
                onChange={(e) => setCount(multiplier * Math.pow(2, Number(e.target.value)))}
              />
            </div>

            <div className="flex justify-between text-[8px] text-white/20 font-black uppercase tracking-widest">
              <span>{isThousands ? 'Low (1K)' : 'Low (1)'}</span>
              <span>Centralized State</span>
              <span>{isThousands ? 'Ultra (4M)' : 'High (1K)'}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
