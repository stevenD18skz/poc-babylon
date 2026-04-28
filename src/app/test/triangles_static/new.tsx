'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Engine, Scene, ArcRotateCamera, Vector3,
  Color3, Color4, HemisphericLight,
  MeshBuilder, StandardMaterial, Matrix,
} from '@babylonjs/core'
import PerformanceOverlay from '@/components/test/PerformanceOverlay'
import DebugTools from '@/components/DebugTools'

// ─────────────────────────────────────────────
// PARÁMETROS DEL TEST (idénticos al estático de R3F)
// ─────────────────────────────────────────────
// Geometría: cono diámetro 0.4, altura 0.4, 8 segmentos (~16 tris)
// Instancias: thinInstances → 1 draw call (≡ InstancedMesh de Three.js)
// Animación: NINGUNA
// Iluminación: HemisphericLight intensity=1 (≡ ambientLight intensity=1)
// Fondo: #050505
// Cámara: radio 34.6 desde origen, fov 50° (≡ position=[20,20,20] fov=50)
// ─────────────────────────────────────────────

const JITTER_SAMPLE = 60
const jitterBuf = new Float32Array(JITTER_SAMPLE)
let jIdx = 0, jFilled = 0

function pushMs(ms: number) {
  jitterBuf[jIdx] = ms
  jIdx = (jIdx + 1) % JITTER_SAMPLE
  jFilled = Math.min(jFilled + 1, JITTER_SAMPLE)
}

function computeMetrics() {
  if (jFilled < 2) return { frameTime: 0, jitter: 0 }
  let sum = 0
  for (let i = 0; i < jFilled; i++) sum += jitterBuf[i]
  const mean = sum / jFilled
  let v = 0
  for (let i = 0; i < jFilled; i++) { const d = jitterBuf[i] - mean; v += d * d }
  return {
    frameTime: Math.round(mean * 100) / 100,
    jitter: Math.round(Math.sqrt(v / jFilled) * 100) / 100,
  }
}

function PerfMetricsHUD({ metrics }: { metrics: any }) {
  const jc = metrics.jitter < 1 ? 'text-emerald-400' : metrics.jitter < 3 ? 'text-yellow-400' : 'text-red-400'
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 min-w-[170px]">
      <div className="bg-black/80 backdrop-blur-xl border border-slate-500/40 px-4 py-3 rounded-xl">
        <p className="text-gray-400 text-xs uppercase tracking-widest mb-1">Frame Time</p>
        <p className="text-2xl font-mono font-black text-slate-300">{metrics.frameTime.toFixed(2)}<span className="text-xs text-gray-500 ml-1">ms</span></p>
      </div>
      <div className="bg-black/80 backdrop-blur-xl border border-orange-500/40 px-4 py-3 rounded-xl">
        <p className="text-gray-400 text-xs uppercase tracking-widest mb-1">Jitter</p>
        <p className={`text-2xl font-mono font-black ${jc}`}>{metrics.jitter.toFixed(2)}<span className="text-xs text-gray-500 ml-1">ms</span></p>
      </div>
      <div className="bg-black/80 backdrop-blur-xl border border-blue-500/40 px-4 py-3 rounded-xl">
        <p className="text-gray-400 text-xs uppercase tracking-widest mb-1">Load Time</p>
        <p className="text-2xl font-mono font-black text-blue-400">{metrics.loadTime.toFixed(1)}<span className="text-xs text-gray-500 ml-1">ms</span></p>
      </div>
    </div>
  )
}

export default function TrianglesStaticBabylon() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<Engine | null>(null)
  const sceneRef = useRef<Scene | null>(null)
  const [count, setCount] = useState(32000)
  const [metrics, setMetrics] = useState({ frameTime: 0, jitter: 0, loadTime: 0 })
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!canvasRef.current) return

    sceneRef.current?.dispose()
    engineRef.current?.dispose()
    setReady(false)
    jIdx = 0; jFilled = 0

    const engine = new Engine(canvasRef.current, true)
    const scene = new Scene(engine)
    engineRef.current = engine
    sceneRef.current = scene

    scene.clearColor = new Color4(0.02, 0.02, 0.02, 1)

    // ✅ radio=34.6 ≈ distancia euclidiana de (20,20,20) al origen
    const camera = new ArcRotateCamera('cam', Math.PI / 4, Math.PI / 4, 34.6, Vector3.Zero(), scene)
    camera.fov = 0.872 // 50° en radianes
    camera.attachControl(canvasRef.current, true)

    // ✅ HemisphericLight ≡ ambientLight de Three.js
    const light = new HemisphericLight('amb', new Vector3(0, 1, 0), scene)
    light.intensity = 1.0
    light.diffuse = Color3.White()
    light.specular = Color3.Black()
    light.groundColor = Color3.White()

    // ✅ Geometría idéntica a R3F: coneGeometry args=[0.2, 0.4, 8]
    // diameterBottom = radio * 2 = 0.4
    const cone = MeshBuilder.CreateCylinder('cone', {
      diameterTop: 0,
      diameterBottom: 0.4,
      height: 0.4,
      tessellation: 8,
    }, scene)
    cone.material = new StandardMaterial('mat', scene)

    // ✅ thinInstances = InstancedMesh de Three.js → 1 draw call
    const t0 = performance.now()
    const buf = new Float32Array(count * 16)
    const m = Matrix.Identity()

    for (let i = 0; i < count; i++) {
      const radius = 10 + Math.random() * 15  // mismo rango que R3F
      const theta = Math.random() * Math.PI * 2
      const phi = Math.random() * Math.PI

      // Misma distribución esférica que R3F
      Matrix.RotationYawPitchRollToRef(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        m
      )
      m.setTranslationFromFloats(
        radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.sin(phi) * Math.sin(theta),
        radius * Math.cos(phi)
      )
      m.copyToArray(buf, i * 16)
    }

    // false = estático, no se actualiza por frame
    cone.thinInstanceSetBuffer('matrix', buf, 16, false)
    const loadTime = performance.now() - t0

    let fc = 0
    let lastT = performance.now()

    scene.onBeforeRenderObservable.add(() => {
      const now = performance.now()
      pushMs(now - lastT)
      lastT = now
      fc++
      if (fc % 10 === 0) setMetrics({ ...computeMetrics(), loadTime })
    })

    engine.runRenderLoop(() => scene.render())
    setReady(true)

    const onResize = () => engine.resize()
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      scene.dispose()
      engine.dispose()
    }
  }, [count])

  return (
    <main className="relative w-full h-screen bg-[#050505] overflow-hidden">
      <PerformanceOverlay
        title={`${count} Triángulos Estáticos — Babylon`}
        input={true}
        count={count}
        setCount={setCount}
      />

      <PerfMetricsHUD metrics={metrics} />

      {ready && sceneRef.current && engineRef.current && (
        <DebugTools
          title="Triángulos Estáticos"
          entityCount={count}
          scene={sceneRef.current}
          engine={engineRef.current}
        />
      )}

      <canvas ref={canvasRef} className="block w-full h-full outline-none touch-none" />

      <div className="absolute bottom-6 left-6 bg-black/70 p-4 rounded-lg border border-cyan-500 text-white text-xs max-w-xs">
        <h3 className="font-bold text-cyan-400 mb-2">Especificaciones del test</h3>
        <ul className="space-y-1 text-gray-300">
          <li>• Instancias: {count.toLocaleString()}</li>
          <li>• Geometría: cono d=0.4, h=0.4, 8 seg (~16 tris)</li>
          <li>• Triángulos totales: ~{(count * 16).toLocaleString()}</li>
          <li>• Draw calls: 1 (thinInstances)</li>
          <li>• Animación: ninguna (GPU puro)</li>
          <li>• Iluminación: HemisphericLight × 1</li>
        </ul>
      </div>
    </main>
  )
}