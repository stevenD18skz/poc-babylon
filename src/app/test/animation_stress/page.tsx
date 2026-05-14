'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import * as BABYLON from '@babylonjs/core'
import PerformanceOverlay from '@/components/test/PerformanceOverlay'
import DebugTools from '@/components/DebugTools'
import Loader3D from '@/components/ui/Loader3D'

// ─── MÉTRICAS Y CÁLCULOS ─────────────────────────────────────────────────────
const JITTER_SAMPLE_SIZE = 60

interface AnimMetrics {
  jitter: number
  frameBudget: number
  frameTime: number
}

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
  compute(): AnimMetrics {
    if (this.filled < 2) return { jitter: 0, frameBudget: 0, frameTime: 0 }
    const n = this.filled
    let sum = 0
    for (let i = 0; i < n; i++) sum += this.samples[i]
    const mean = sum / n
    let variance = 0
    for (let i = 0; i < n; i++) {
      const diff = this.samples[i] - mean
      variance += diff * diff
    }
    const jitter = Math.sqrt(variance / n)
    const frameBudget = (mean / 16.667) * 100
    return {
      jitter: Math.round(jitter * 100) / 100,
      frameBudget: Math.round(frameBudget * 10) / 10,
      frameTime: Math.round(mean * 100) / 100,
    }
  },
}

// ─── HUD EXTENDIDO CON TODAS LAS MÉTRICAS ────────────────────────────────────
function AnimMetricsHUD({ metrics, engineMetrics, count }: { metrics: AnimMetrics; engineMetrics: any; count: number }) {
  const jitterColor = metrics.jitter < 1 ? 'text-emerald-400' : metrics.jitter < 3 ? 'text-yellow-400' : 'text-red-400'
  const budgetColor = metrics.frameBudget < 50 ? 'text-emerald-400' : metrics.frameBudget < 80 ? 'text-yellow-400' : 'text-red-400'

  const MetricCard = ({ label, value, unit, color }: any) => (
    <div className="bg-black/80 backdrop-blur-xl border border-slate-500/30 px-3 py-2 rounded-xl flex flex-col justify-between">
      <p className="text-gray-400 text-[10px] uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-lg font-mono font-black ${color}`}>
        {value} <span className="text-[9px] text-gray-500 ml-0.5">{unit}</span>
      </p>
    </div>
  )

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 min-w-[300px]">
      
      {/* Sección Específica de este Test */}
      <div className="grid grid-cols-2 gap-2 mb-2">
        <div className="bg-black/80 backdrop-blur-xl border border-blue-500/40 px-4 py-3 rounded-xl">
          <p className="text-gray-400 text-xs uppercase tracking-widest mb-1">Frame Budget</p>
          <p className={`text-2xl font-mono font-black ${budgetColor}`}>
            {metrics.frameBudget.toFixed(1)}<span className="text-xs text-gray-500 ml-1">%</span>
          </p>
          <p className="text-gray-600 text-[10px]">de 16.67ms (60fps)</p>
        </div>
        
        <div className="bg-black/80 backdrop-blur-xl border border-violet-500/40 px-4 py-3 rounded-xl">
          <p className="text-gray-400 text-xs uppercase tracking-widest mb-1">Render Callbacks</p>
          <p className="text-2xl font-mono font-black text-violet-400">
            {count + 1}
          </p>
          <p className="text-gray-600 text-[10px]">Observables equivalentes a useFrame</p>
        </div>
      </div>

      {/* Grid General de Métricas de Sistema */}
      <div className="grid grid-cols-3 gap-2">
        <MetricCard label="Frame Time" value={metrics.frameTime.toFixed(2)} unit="ms" color="text-slate-200" />
        <MetricCard label="Jitter" value={metrics.jitter.toFixed(2)} unit="ms" color={jitterColor} />
        <MetricCard label="FPS" value={engineMetrics.fps} unit="fps" color="text-green-400" />
        
        <MetricCard label="CPU (Script)" value={engineMetrics.cpuTime} unit="ms" color="text-blue-400" />
        <MetricCard label="GPU (Render)" value={engineMetrics.gpuTime} unit="ms" color="text-pink-400" />
        <MetricCard label="Draw Calls" value={engineMetrics.drawCalls} unit="" color="text-yellow-400" />
        
        <MetricCard label="Triángulos" value={engineMetrics.triangles?.toLocaleString()} unit="" color="text-purple-400" />
        <MetricCard label="RAM" value={engineMetrics.ram} unit="MB" color="text-cyan-400" />
        <MetricCard label="VRAM (Aprox)" value={engineMetrics.vram} unit="MB" color="text-orange-400" />
      </div>

    </div>
  )
}

// ─── COMPONENTE PRINCIPAL BABYLON ────────────────────────────────────────────
export default function AnimationStressBabylonTest() {
  const [count, setCount] = useState(16000)
  const [isLoading, setIsLoading] = useState(true)
  const [metrics, setMetrics] = useState<AnimMetrics>({ jitter: 0, frameBudget: 0, frameTime: 0 })
  const [engineMetrics, setEngineMetrics] = useState<any>({ fps: 0, cpuTime: 0, gpuTime: 0, drawCalls: 0, triangles: 0, ram: 0, vram: 0 })
  
  const canvasRef = useRef<HTMLCanvasElement>(null)
  
  const sceneRef = useRef<BABYLON.Scene | null>(null)
  const engineRef = useRef<BABYLON.Engine | null>(null)
  const activeEntitiesRef = useRef<{ mesh: BABYLON.Mesh, mat: BABYLON.Material, obs: BABYLON.Observer<BABYLON.Scene> }[]>([])

  // 1. Inicialización Base del Motor
  useEffect(() => {
    if (!canvasRef.current) return

    const engine = new BABYLON.Engine(canvasRef.current, true, { preserveDrawingBuffer: true, stencil: true })
    const scene = new BABYLON.Scene(engine)
    scene.clearColor = new BABYLON.Color4(0.02, 0.02, 0.02, 1)
    
    sceneRef.current = scene
    engineRef.current = engine

    // Instrumentación para Métricas Nativas
    const sceneInst = new BABYLON.SceneInstrumentation(scene)
    const engineInst = new BABYLON.EngineInstrumentation(engine)
    sceneInst.captureFrameTime = true
    sceneInst.captureDrawCalls = true
    engineInst.captureGPUFrameTime = true

    // Cámara (Position: [0, 15, 25], fov: 50)
    const camera = new BABYLON.ArcRotateCamera("camera", -Math.PI / 2, Math.PI / 3, 29.15, BABYLON.Vector3.Zero(), scene)
    camera.setPosition(new BABYLON.Vector3(0, 15, 25))
    camera.fov = 50 * (Math.PI / 180)
    camera.attachControl(canvasRef.current, true)

    new BABYLON.HemisphericLight("ambient", new BABYLON.Vector3(0, 1, 0), scene).intensity = 0.5
    const pLight = new BABYLON.PointLight("point", new BABYLON.Vector3(10, 10, 10), scene)
    pLight.intensity = 1.5

    // Collector de Métricas (1 Observable central simulando el MetricsCollector de R3F)
    let frameCount = 0
    let lastTime = performance.now()

    const collectorObs = scene.onBeforeRenderObservable.add(() => {
      const now = performance.now()
      const delta = (now - lastTime) / 1000
      lastTime = now

      metricsCalculator.push(delta)
      frameCount++

      if (frameCount === 1) setIsLoading(false)

      if (frameCount % 10 === 0) {
        setMetrics(metricsCalculator.compute())
        
        const memoryInfo = (performance as any).memory
        const ramMB = memoryInfo ? Math.round(memoryInfo.usedJSHeapSize / 1048576) : 0
        const gpuTimeMs = engineInst.gpuFrameTimeCounter?.current ? (engineInst.gpuFrameTimeCounter.current * 0.000001).toFixed(2) : "N/A"
        
        // VRAM aprox de la geometría individual (sin texturas ni sombras pesadas)
        // Cada Icosahedron (1) tiene 20 caras = 60 índices, 12 vértices. 
        // VRAM base muy baja, pero escala con N.
        const vramEst = ((scene.getActiveIndices() * 4) + (scene.getActiveIndices() * 8 * 4)) / 1048576

        setEngineMetrics({
          fps: Math.round(engine.getFps()),
          cpuTime: sceneInst.frameTimeCounter.current.toFixed(2),
          gpuTime: gpuTimeMs,
          drawCalls: sceneInst.drawCallsCounter.current,
          triangles: scene.getActiveIndices() / 3,
          ram: ramMB,
          vram: vramEst.toFixed(2)
        })
      }
    })

    engine.runRenderLoop(() => {
      scene.render()
    })

    const handleResize = () => engine.resize()
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      scene.onBeforeRenderObservable.remove(collectorObs)
      engine.dispose()
    }
  }, []) // Solo se inicializa una vez

  // 2. Gestión de Entidades y Observables Dinámicos
  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return

    setIsLoading(true)

    // Limpieza agresiva de objetos y callbacks del render loop anterior
    activeEntitiesRef.current.forEach(ent => {
      scene.onBeforeRenderObservable.remove(ent.obs)
      ent.mesh.dispose()
      ent.mat.dispose()
    })
    activeEntitiesRef.current = []

    // Geometría compartida para no explotar la RAM (Icosahedron radius 0.3, subdivisions 1)
    const baseGeo = BABYLON.MeshBuilder.CreateIcosahedron("baseGeo", { radius: 0.3, subdivisions: 1 }, scene)
    baseGeo.isVisible = false

    // Poblar escena simulando N componentes <AnimatedSphere />
    for (let i = 0; i < count; i++) {
      const theta = (i / count) * Math.PI * 8
      const ring = Math.floor(i / 50)
      const r = 3 + ring * 1.0
      
      const baseX = Math.cos(theta) * r
      const baseY = 0
      const baseZ = Math.sin(theta) * r
      const phase = (i / count) * Math.PI * 2

      // Material único por esfera (Mide Material Management de Babylon vs Three)
      const hue = (phase / (Math.PI * 2)) * 360
      const color = BABYLON.Color3.FromHSV(hue, 0.7, 0.7) // h, s, v aprox a hsl(..., 70%, 50%)
      const emissive = BABYLON.Color3.FromHSV(hue, 0.7, 0.3)
      
      const mat = new BABYLON.StandardMaterial(`mat-${i}`, scene)
      mat.diffuseColor = color
      mat.emissiveColor = emissive
      mat.roughness = 0.3

      // Mesh único (Genera N draw calls intencionalmente)
      const mesh = baseGeo.clone(`sphere-${i}`)
      mesh.position.set(baseX, baseY, baseZ)
      mesh.material = mat
      mesh.makeGeometryUnique() // Forzar que Babylon los trate como draw calls separados si hace auto-instancing

      // 1 Callback por objeto simulando el useFrame independiente
      const obs = scene.onBeforeRenderObservable.add(() => {
        const t = (performance.now() * 0.001) + phase
        
        mesh.position.y = baseY + Math.sin(t * 2) * 1.5
        
        const scale = 0.8 + Math.sin(t * 3) * 0.3
        mesh.scaling.setAll(scale)
        
        // Convertir rotaciones a Quaternion si se requiere, pero Euler funciona directo aquí
        mesh.rotation.x = t * 0.5
        mesh.rotation.z = t * 0.3
      })

      activeEntitiesRef.current.push({ mesh, mat, obs })
    }

  }, [count]) // Se vuelve a ejecutar cuando cambia la cantidad a evaluar

  return (
    <main className="relative w-full h-screen bg-[#050505] overflow-hidden">
      
      <PerformanceOverlay
        title={`Babylon: ${count} Observables Indep.`}
        input={true}
        count={count}
        setCount={setCount}
        inputConfig={{ unit: 'normal', type: 'values', values: [64, 256, 1000, 4000, 16000] }}
      />

      <AnimMetricsHUD 
        metrics={metrics} 
        engineMetrics={engineMetrics} 
        count={count} 
      />

      <div className="absolute inset-0 pointer-events-none z-10">
        <DebugTools title="Animación CPU y Draw Calls (Babylon)" entityCount={count} />
        {isLoading && <Loader3D />}
      </div>

      <canvas 
        ref={canvasRef} 
        className="w-full h-full outline-none block" 
      />
    </main>
  )
}