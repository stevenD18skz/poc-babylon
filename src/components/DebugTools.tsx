'use client'

import { useEffect, useRef, useCallback } from 'react'
import {
  Scene,
  Engine,
  SceneInstrumentation,
  Mesh,
  AbstractMesh,
} from '@babylonjs/core'

// ---------------------------------------------------------------------------
// Contar triángulos activos (SmartArray tiene .forEach, no .reduce)
// ---------------------------------------------------------------------------
function countTriangles(scene: Scene): number {
  let total = 0
  const active = scene.getActiveMeshes()
  active.forEach((m: AbstractMesh) => {
    if (m instanceof Mesh && m.geometry) {
      const idx = m.geometry.getIndices()
      if (idx) total += Math.floor(idx.length / 3)
    }
  })
  return total
}

// ---------------------------------------------------------------------------
// Estimar VRAM (geometrías + texturas)
// ---------------------------------------------------------------------------
function estimateVRAM(scene: Scene): number {
  let bytes = 0
  const seenGeo = new Set<string>()
  const seenTex = new Set<string>()

  scene.meshes.forEach((mesh) => {
    if (!(mesh instanceof Mesh)) return
    const geo = mesh.geometry
    if (geo && !seenGeo.has(geo.id)) {
      seenGeo.add(geo.id)
      geo.getVerticesDataKinds().forEach((kind) => {
        const data = geo.getVerticesData(kind)
        if (data) bytes += data.length * 4
      })
      const idx = geo.getIndices()
      if (idx) bytes += idx.length * 4
    }
    mesh.material?.getActiveTextures().forEach((tex) => {
      if (!seenTex.has(tex.uid)) {
        seenTex.add(tex.uid)
        const s = tex.getSize()
        let tb = (s?.width ?? 0) * (s?.height ?? 0) * 4
        if ((tex as any).generateMipMaps) tb *= 1.33
        bytes += tb
      }
    })
  })

  return bytes / (1024 * 1024)
}

// ---------------------------------------------------------------------------
// Componente: solo un botón "Exportar CSV"
// ---------------------------------------------------------------------------
interface DebugToolsProps {
  scene: Scene
  engine: Engine
  title?: string
  entityCount?: number
}

export default function DebugTools({ scene, engine, title, entityCount }: DebugToolsProps) {
  const siRef = useRef<SceneInstrumentation | null>(null)

  // Crear instrumentación al montar
  useEffect(() => {
    const si = new SceneInstrumentation(scene)
    si.captureFrameTime = true
    si.captureDrawCalls = true
    siRef.current = si

    return () => {
      si.dispose()
      siRef.current = null
    }
  }, [scene])

  // Función de exportación
  const handleExportCSV = useCallback(() => {
    const si = siRef.current

    const fpsAvg = engine.getFps().toFixed(2)
    const cpuMs = si
      ? si.frameTimeCounter.lastSecAverage.toFixed(2)
      : '0.00'
    const gpuMs = '0.00'
    const drawCalls = si ? si.drawCallsCounter.current : 0
    const triangles = countTriangles(scene)
    const geometries = scene.geometries.length
    const textures = scene.textures.length
    const shaders = Object.keys((engine as any)._compiledEffects ?? {}).length
    const memMB = (performance as any).memory
      ? ((performance as any).memory.usedJSHeapSize / 1048576).toFixed(2)
      : '0.00'
    const vramMB = estimateVRAM(scene).toFixed(2)

    // Construir el contenido CSV
    const lines: string[] = []

    if (entityCount !== undefined) {
      lines.push(`${entityCount.toLocaleString()} entidades`)
      lines.push('')
    }

    lines.push(
      'Escena,FPS Promedio,GPU (ms),CPU (ms),Draw Calls,Triangulos,Geometrias,Texturas,Shaders,Lineas,Puntos,Memoria RAM (MB),VRAM Estimada (MB)'
    )
    lines.push(
      `Metricas Actuales,${fpsAvg},${gpuMs},${cpuMs},${drawCalls},${triangles},${geometries},${textures},${shaders},0,0,${memMB},${vramMB}`
    )

    const csvText = lines.join('\n')

    // Descargar usando Blob
    const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `metricas_escena_${title ?? 'babylon'}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }, [scene, engine, title, entityCount])

  return (
    <button
      onClick={handleExportCSV}
      style={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        zIndex: 9999,
        padding: '8px 16px',
        background: '#1a1a2e',
        color: '#00ff88',
        border: '1px solid #00ff8855',
        borderRadius: 6,
        fontFamily: "'Courier New', monospace",
        fontSize: 12,
        cursor: 'pointer',
        backdropFilter: 'blur(6px)',
      }}
    >
      📊 Exportar CSV
    </button>
  )
}
