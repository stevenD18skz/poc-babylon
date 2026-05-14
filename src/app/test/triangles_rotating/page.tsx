'use client'

import { useEffect, useRef, useState, useMemo } from 'react'
import * as BABYLON from '@babylonjs/core'
import PerformanceOverlay from '@/components/test/PerformanceOverlay'
import DebugTools from '@/components/DebugTools'
import Loader3D from '@/components/ui/Loader3D'

// ─── MÉTRICAS (Idénticas al test de R3F) ──────────────────────────────────────
const JITTER_SAMPLE_SIZE = 60
const metricsCalculator = {
  samples: new Float32Array(JITTER_SAMPLE_SIZE),
  index: 0,
  filled: 0,
  push(delta: number) {
    const ms = delta * 1000
    this.samples[this.index] = ms
    this.index = (this.index + 1) % JITTER_SAMPLE_SIZE
    this.filled = Math.min(this.filled + 1, JITTER_SAMPLE_SIZE)
  },
  compute() {
    if (this.filled < 2) return { jitter: 0, frameTime: 0 }
    let sum = 0
    for (let i = 0; i < this.filled; i++) sum += this.samples[i]
    const mean = sum / this.filled
    let variance = 0
    for (let i = 0; i < this.filled; i++) {
      const diff = this.samples[i] - mean
      variance += diff * diff
    }
    return {
      jitter: Math.round(Math.sqrt(variance / this.filled) * 100) / 100,
      frameTime: Math.round(mean * 100) / 100,
    }
  },
}

function PerfMetricsHUD({ metrics }: { metrics: any }) {
  const jitterColor =
    metrics.jitter < 1 ? 'text-emerald-400' :
    metrics.jitter < 3 ? 'text-yellow-400' :
    'text-red-400'

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 min-w-[170px]">
      <div className="bg-black/80 backdrop-blur-xl border border-slate-500/40 px-4 py-3 rounded-xl">
        <p className="text-gray-400 text-xs uppercase tracking-widest mb-1">Frame Time</p>
        <p className="text-2xl font-mono font-black text-slate-300">
          {metrics.frameTime.toFixed(2)}<span className="text-xs text-gray-500 ml-1">ms</span>
        </p>
      </div>
      <div className="bg-black/80 backdrop-blur-xl border border-orange-500/40 px-4 py-3 rounded-xl">
        <p className="text-gray-400 text-xs uppercase tracking-widest mb-1">Jitter</p>
        <p className={`text-2xl font-mono font-black ${jitterColor}`}>
          {metrics.jitter.toFixed(2)}<span className="text-xs text-gray-500 ml-1">ms</span>
        </p>
      </div>
      <div className="bg-black/80 backdrop-blur-xl border border-blue-500/40 px-4 py-3 rounded-xl">
        <p className="text-gray-400 text-xs uppercase tracking-widest mb-1">Load Time</p>
        <p className="text-2xl font-mono font-black text-blue-400">
          {metrics.loadTime.toFixed(1)}<span className="text-xs text-gray-500 ml-1">ms</span>
        </p>
      </div>
    </div>
  )
}

// ─── COMPONENTE PRINCIPAL Y ENTORNO BABYLON ───────────────────────────────────
export default function BabylonTrianglesRotatingTest() {
  const [count, setCount] = useState(1024000)
  const [metrics, setMetrics] = useState({ jitter: 0, frameTime: 0, loadTime: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [babylonState, setBabylonState] = useState<{
    engine: BABYLON.Engine | null
    scene: BABYLON.Scene | null
  }>({ engine: null, scene: null })
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!canvasRef.current) return

    setIsLoading(true)
    const engine = new BABYLON.Engine(canvasRef.current, true, { preserveDrawingBuffer: true, stencil: true })
    const scene = new BABYLON.Scene(engine)
    scene.clearColor = new BABYLON.Color4(0.02, 0.02, 0.02, 1) // bg-[#050505] aprox

    setBabylonState({ engine, scene })

    // ✅ Misma posición y FOV de cámara
    const camera = new BABYLON.ArcRotateCamera("camera", -Math.PI / 4, Math.PI / 3, 34.64, BABYLON.Vector3.Zero(), scene)
    camera.setPosition(new BABYLON.Vector3(20, 20, 20))
    camera.fov = 50 * (Math.PI / 180)
    camera.attachControl(canvasRef.current, true)

    new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene).intensity = 1

    // ✅ radio 0.2 (diameter 0.4), altura 0.4, 8 segmentos
    const cone = BABYLON.MeshBuilder.CreateCylinder("cone", { 
      diameterTop: 0, 
      diameterBottom: 0.4, 
      height: 0.4, 
      tessellation: 8 
    }, scene)

    // Usar PBR para mayor fidelidad visual con R3F
    const material = new BABYLON.PBRMaterial("material", scene)
    material.metallic = 0
    material.roughness = 0.5
    cone.material = material

    // ─── INICIALIZACIÓN DE INSTANCIAS (Thin Instances) ───
    const matrixBuffer = new Float32Array(count * 16)
    const colorBuffer = new Float32Array(count * 4)
    const particles = new Array(count)

    const scale = new BABYLON.Vector3(1, 1, 1)
    const pos = new BABYLON.Vector3()
    const rotQuat = new BABYLON.Quaternion()
    const tempMat = new BABYLON.Matrix()

    for (let i = 0; i < count; i++) {
      const radius = 10 + Math.random() * 40
      const theta = Math.random() * Math.PI * 2
      const phi = Math.random() * Math.PI

      const x = radius * Math.sin(phi) * Math.cos(theta)
      const y = radius * Math.sin(phi) * Math.sin(theta)
      const z = radius * Math.cos(phi)
      const rotationSpeed = (Math.random() - 0.5) * 2

      particles[i] = { x, y, z, rotationSpeed }

      // Equivalente aproximado de HSL a Color4
      const hue = Math.random() * 70 + 150
      const color = BABYLON.Color3.FromHSV(hue, 0.8, 0.8)
      colorBuffer[i * 4 + 0] = color.r
      colorBuffer[i * 4 + 1] = color.g
      colorBuffer[i * 4 + 2] = color.b
      colorBuffer[i * 4 + 3] = 1.0

      // Matriz inicial
      pos.set(x, y, z)
      BABYLON.Quaternion.RotationYawPitchRollToRef(
        Math.random() * Math.PI, 
        Math.random() * Math.PI, 
        Math.random() * Math.PI, 
        rotQuat
      )
      BABYLON.Matrix.ComposeToRef(scale, rotQuat, pos, tempMat)
      tempMat.copyToArray(matrixBuffer, i * 16)
    }

    cone.thinInstanceSetBuffer("matrix", matrixBuffer, 16, false)
    cone.thinInstanceSetBuffer("color", colorBuffer, 4, false)

    // ─── LÓGICA DE ACTUALIZACIÓN Y MÉTRICAS ───
    let frameCount = 0
    let startTime = performance.now()
    let loadTime = 0
    let lastTime = performance.now()
    const startAnimTime = performance.now()

    scene.onBeforeRenderObservable.add(() => {
      const now = performance.now()
      const delta = (now - lastTime) / 1000
      lastTime = now

      // Tracking de Métricas
      metricsCalculator.push(delta)
      frameCount++
      
      if (frameCount === 1) {
        loadTime = performance.now() - startTime
        setIsLoading(false)
      }
      
      if (frameCount % 10 === 0) {
        setMetrics({ ...metricsCalculator.compute(), loadTime })
      }

      // Animación CPU: Actualizar matriz de N instancias
      const t = (now - startAnimTime) * 0.001
      
      for (let i = 0; i < count; i++) {
        const p = particles[i]
        
        pos.set(p.x, p.y, p.z)
        const rx = t * p.rotationSpeed
        const ry = t * (p.rotationSpeed / 2)
        const rz = t * (p.rotationSpeed * 0.8)

        BABYLON.Quaternion.RotationYawPitchRollToRef(ry, rx, rz, rotQuat)
        BABYLON.Matrix.ComposeToRef(scale, rotQuat, pos, tempMat)
        tempMat.copyToArray(matrixBuffer, i * 16)
      }

      // Subir el buffer actualizado a la GPU
      cone.thinInstanceBufferUpdated("matrix")
    })

    engine.runRenderLoop(() => {
      scene.render()
    })

    const handleResize = () => engine.resize()
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      engine.dispose()
      setBabylonState({ engine: null, scene: null })
    }
  }, [count])

  return (
    <main className="relative w-full h-screen bg-[#050505] overflow-hidden">
      <PerformanceOverlay
        title={`${count} Triángulos Rotando (Babylon)`}
        input={true}
        count={count}
        setCount={setCount}
        engine={babylonState.engine}
        scene={babylonState.scene}
      />
      <PerfMetricsHUD metrics={metrics} />

      {/* Interfaz sobre el canvas */}
      <div className="absolute inset-0 pointer-events-none z-10">
        {babylonState.scene && babylonState.engine && (
          <DebugTools 
            title="Triángulos Rotando Babylon" 
            entityCount={count} 
            scene={babylonState.scene}
            engine={babylonState.engine}
          />
        )}
        {isLoading && <Loader3D />}
      </div>

      <canvas 
        ref={canvasRef} 
        className="w-full h-full outline-none block" 
      />
    </main>
  )
}