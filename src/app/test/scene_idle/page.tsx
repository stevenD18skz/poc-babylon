'use client'

import { useEffect, useRef } from 'react'
import {
  Engine,
  Scene,
  ArcRotateCamera,
  Vector3,
  Color4,
  CubeTexture,
} from '@babylonjs/core'
import PerformanceOverlay from '@/components/test/PerformanceOverlay'
import DebugTools from '@/components/DebugTools'

// ─────────────────────────────────────────────
// PARÁMETROS DEL TEST (idénticos al idle de R3F)
// ─────────────────────────────────────────────
// Geometría: ninguna
// Cámara: ArcRotateCamera con control de usuario
// Environment: HDR (equivalente a <Environment preset="studio" />)
// Sombras: no
// Lo que mides: costo operativo base del motor Babylon en reposo
// ─────────────────────────────────────────────

export default function SceneIdleBabylon() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!canvasRef.current) return

    const engine = new Engine(canvasRef.current, true)
    const scene = new Scene(engine)

    // Fondo idéntico al R3F (#050505)
    scene.clearColor = new Color4(0.02, 0.02, 0.02, 1)

    // Cámara equivalente a position={[0, 5, 10]}, fov=50
    const camera = new ArcRotateCamera('cam', -Math.PI / 2, Math.PI / 3, 15, Vector3.Zero(), scene)
    camera.attachControl(canvasRef.current, true)
    camera.fov = 0.872 // 50° en radianes

    // Environment HDR — equivalente a <Environment preset="studio" />
    const hdrTexture = CubeTexture.CreateFromPrefilteredData(
      'https://assets.babylonjs.com/environments/environmentSpecular.env',
      scene
    )
    scene.environmentTexture = hdrTexture
    scene.environmentIntensity = 1.0

    engine.runRenderLoop(() => scene.render())

    const onResize = () => engine.resize()
    window.addEventListener('resize', onResize)

    return () => {
      window.removeEventListener('resize', onResize)
      scene.dispose()
      engine.dispose()
    }
  }, [])

  return (
    <main className="relative w-full h-screen bg-[#050505] overflow-hidden">
      <PerformanceOverlay title="Escena Idle — Babylon (Baseline)" input={false} />
      
      <canvas ref={canvasRef} className="block w-full h-full outline-none touch-none" />
    </main>
  )
}