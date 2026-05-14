'use client'

import { useEffect, useRef, useState, useMemo } from 'react'
import * as BABYLON from '@babylonjs/core'
import PerformanceOverlay from '@/components/test/PerformanceOverlay'
import DebugTools from '@/components/DebugTools'
import Loader3D from '@/components/ui/Loader3D'

// ─── MÉTRICAS Y CÁLCULOS ─────────────────────────────────────────────────────
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
    if (this.filled < 2) return { jitter: 0, frameBudget: 0, frameTime: 0 }
    const n = this.filled
    let sum = 0; for (let i = 0; i < n; i++) sum += this.samples[i]
    const mean = sum / n
    let variance = 0; for (let i = 0; i < n; i++) variance += Math.pow(this.samples[i] - mean, 2)
    const jitter = Math.sqrt(variance / n)
    const frameBudget = (mean / 16.667) * 100
    return {
      jitter: Math.round(jitter * 100) / 100,
      frameBudget: Math.round(frameBudget * 10) / 10,
      frameTime: Math.round(mean * 100) / 100
    }
  },
}

// ─── HUD COMPLETO (Sistemas + Draw Calls) ────────────────────────────────────
function CombinedDrawCallsHUD({ 
  metrics, engineMetrics, count 
}: { 
  metrics: any; engineMetrics: any; count: number 
}) {
  const drawColor = engineMetrics.drawCalls < 200 ? 'text-emerald-400' : engineMetrics.drawCalls < 600 ? 'text-yellow-400' : 'text-red-400'
  const jitterColor = metrics.jitter < 2 ? 'text-emerald-400' : metrics.jitter < 5 ? 'text-yellow-400' : 'text-red-400'
  const budgetColor = metrics.frameBudget < 50 ? 'text-emerald-400' : metrics.frameBudget < 85 ? 'text-yellow-400' : 'text-red-400'

  const MetricCard = ({ label, value, unit, color }: any) => (
    <div className={`bg-black/80 backdrop-blur border border-${color}-500/30 px-3 py-2 rounded-xl flex flex-col justify-between`}>
      <p className="text-gray-400 text-[10px] uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-lg font-mono font-black text-${color}-400`}>
        {value} <span className="text-[9px] text-gray-500 ml-0.5">{unit}</span>
      </p>
    </div>
  )

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 min-w-[280px]">
      
      {/* Draw Calls: La métrica principal */}
      <div className="bg-black/80 backdrop-blur border border-cyan-500/40 px-4 py-3 rounded-xl">
        <p className="text-gray-400 text-xs uppercase tracking-widest mb-1">Draw Calls</p>
        <p className={`text-2xl font-mono font-black ${drawColor}`}>
          {engineMetrics.drawCalls}
        </p>
        <p className="text-gray-600 text-[10px]">1 por objeto (sin instancing ni batching)</p>
      </div>

      {/* Frame Time y Estabilidad */}
      <div className="grid grid-cols-2 gap-2 mb-1">
        <div className="bg-black/80 backdrop-blur border border-slate-500/40 px-3 py-2 rounded-xl">
          <p className="text-gray-400 text-[10px] uppercase tracking-widest mb-1">Frame Time</p>
          <p className="text-xl font-mono font-black text-slate-300">
            {metrics.frameTime.toFixed(2)}<span className="text-xs text-gray-500 ml-1">ms</span>
          </p>
        </div>
        <div className="bg-black/80 backdrop-blur border border-orange-500/40 px-3 py-2 rounded-xl">
          <p className="text-gray-400 text-[10px] uppercase tracking-widest mb-1">Jitter</p>
          <p className={`text-xl font-mono font-black ${jitterColor}`}>
            {metrics.jitter.toFixed(2)}<span className="text-xs text-gray-500 ml-1">ms</span>
          </p>
        </div>
      </div>

      <div className="bg-black/80 backdrop-blur border border-blue-500/40 px-4 py-2 rounded-xl mb-1 flex justify-between items-center">
        <p className="text-gray-400 text-[10px] uppercase tracking-widest">Frame Budget</p>
        <p className={`text-xl font-mono font-black ${budgetColor}`}>
          {metrics.frameBudget.toFixed(1)}<span className="text-xs text-gray-500 ml-1">%</span>
        </p>
      </div>

      {/* Comparación Instancing */}
      <div className="bg-black/80 backdrop-blur border border-violet-500/40 px-4 py-3 rounded-xl mb-1">
        <p className="text-gray-400 text-[10px] uppercase tracking-widest mb-2">Instancing vs Único</p>
        <div className="flex justify-between text-[11px] mb-1">
          <span className="text-gray-400">Con instancing</span>
          <span className="text-emerald-400 font-mono font-bold">~5 DC</span>
        </div>
        <div className="flex justify-between text-[11px]">
          <span className="text-gray-400">Sin instancing</span>
          <span className="text-red-400 font-mono font-bold">{count} DC</span>
        </div>
      </div>

      {/* Métricas Generales del Motor */}
      <div className="grid grid-cols-3 gap-2">
        <MetricCard label="FPS" value={engineMetrics.fps} unit="fps" color="green" />
        <MetricCard label="CPU" value={engineMetrics.cpuTime} unit="ms" color="blue" />
        <MetricCard label="RAM" value={engineMetrics.ram} unit="MB" color="cyan" />
        <MetricCard label="Triángulos" value={engineMetrics.triangles?.toLocaleString()} unit="" color="purple" />
        <MetricCard label="VRAM (Est)" value={engineMetrics.vram} unit="MB" color="orange" />
        {/* Espacio en blanco para cuadrar el grid */}
        <div className="bg-transparent"></div>
      </div>

    </div>
  )
}

// ─── COMPONENTE PRINCIPAL BABYLON ────────────────────────────────────────────
export default function DrawCallsBabylonTest() {
  const [count, setCount] = useState(4096)
  const [isLoading, setIsLoading] = useState(true)
  
  const [metrics, setMetrics] = useState<any>({ jitter: 0, frameBudget: 0, frameTime: 0 })
  const [engineMetrics, setEngineMetrics] = useState<any>({ fps: 0, cpuTime: 0, drawCalls: 0, triangles: 0, ram: 0, vram: 0 })

  const canvasRef = useRef<HTMLCanvasElement>(null)
  
  const sceneRef = useRef<BABYLON.Scene | null>(null)
  const engineRef = useRef<BABYLON.Engine | null>(null)
  const activeMeshesRef = useRef<{ mesh: BABYLON.Mesh, mat: BABYLON.StandardMaterial }[]>([])

  // 1. Inicialización de Motor
  useEffect(() => {
    if (!canvasRef.current) return

    const engine = new BABYLON.Engine(canvasRef.current, true, { preserveDrawingBuffer: true, stencil: true })
    engineRef.current = engine

    const scene = new BABYLON.Scene(engine)
    scene.clearColor = new BABYLON.Color4(0.02, 0.02, 0.02, 1)
    sceneRef.current = scene

    // Instrumentación nativa
    const sceneInst = new BABYLON.SceneInstrumentation(scene)
    sceneInst.captureFrameTime = true
    sceneInst.captureDrawCalls = true

    // Cámara (Equivalente a position: [0, 10, 40], fov: 50)
    const camera = new BABYLON.ArcRotateCamera("camera", -Math.PI / 2, Math.PI / 2.5, 41.2, BABYLON.Vector3.Zero(), scene)
    camera.setPosition(new BABYLON.Vector3(0, 10, 40))
    camera.fov = 50 * (Math.PI / 180)
    camera.attachControl(canvasRef.current, true)

    // Luces
    new BABYLON.HemisphericLight("ambient", new BABYLON.Vector3(0, 1, 0), scene).intensity = 0.6
    const dirLight1 = new BABYLON.DirectionalLight("dir1", new BABYLON.Vector3(-1, -2, -1), scene)
    dirLight1.position = new BABYLON.Vector3(10, 20, 10)
    dirLight1.intensity = 1.0

    const dirLight2 = new BABYLON.DirectionalLight("dir2", new BABYLON.Vector3(1, 1, 1), scene)
    dirLight2.position = new BABYLON.Vector3(-10, -10, -10)
    dirLight2.diffuse = BABYLON.Color3.FromHexString("#4f46e5")
    dirLight2.intensity = 0.3

    // Render Loop & Recolección de Métricas
    let frameCount = 0
    let lastTime = performance.now()

    scene.onBeforeRenderObservable.add(() => {
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
        
        // VRAM Estimada: Geometría base + N Materiales. Multiplicamos N por un pequeño overhead de shader compilado
        const vramEst = ((scene.getActiveIndices() * 4) + (scene.getActiveVertices() * 32)) / 1048576 + (count * 0.05)

        setEngineMetrics({
          fps: Math.round(engine.getFps()),
          cpuTime: sceneInst.frameTimeCounter.current.toFixed(2),
          drawCalls: sceneInst.drawCallsCounter.current,
          triangles: scene.getActiveIndices() / 3,
          ram: ramMB,
          vram: vramEst.toFixed(1)
        })
      }
    })

    engine.runRenderLoop(() => { scene.render() })

    const handleResize = () => engine.resize()
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      engine.dispose()
    }
  }, [])

  // 2. Generación de Geometrías Únicas y Draw Calls
  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return

    setIsLoading(true)

    // Limpieza total del test anterior
    activeMeshesRef.current.forEach(item => {
      item.mesh.dispose()
      item.mat.dispose()
    })
    activeMeshesRef.current = []

    // 5 Geometrías Base Ocultas
    const baseGeos = [
      BABYLON.MeshBuilder.CreateBox("g0", { size: 1 }, scene),
      BABYLON.MeshBuilder.CreateSphere("g1", { diameter: 1.2, segments: 16 }, scene),
      BABYLON.MeshBuilder.CreateCylinder("g2", { diameterTop: 0, diameterBottom: 1, height: 1.2, tessellation: 8 }, scene),
      BABYLON.MeshBuilder.CreateCylinder("g3", { diameterTop: 0.8, diameterBottom: 0.8, height: 1.2, tessellation: 12 }, scene),
      BABYLON.MeshBuilder.CreateTorus("g4", { diameter: 1, thickness: 0.2, tessellation: 16 }, scene)
    ]
    baseGeos.forEach(g => g.isVisible = false)

    // Instanciar $count objetos, forzando 1 draw call por cada uno
    for (let i = 0; i < count; i++) {
      const geomIndex = i % baseGeos.length
      const mesh = baseGeos[geomIndex].clone(`obj-${i}`)
      mesh.isVisible = true

      mesh.position.set(
        (Math.random() - 0.5) * 30,
        (Math.random() - 0.5) * 20,
        (Math.random() - 0.5) * 30
      )

      mesh.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      )

      const scale = 0.4 + Math.random() * 1.0
      mesh.scaling.setAll(scale)

      // ✅ Material único = No batching = 1 Draw call estricto
      const mat = new BABYLON.StandardMaterial(`mat-${i}`, scene)
      const hue = (i / count) * 360
      mat.diffuseColor = BABYLON.Color3.FromHSV(hue, 0.7, 0.7)
      mat.roughness = 0.3 + (geomIndex / 5) * 0.5
      // Simular metalness con specular en StandardMaterial
      const specVal = 0.1 + (geomIndex / 5) * 0.4
      mat.specularColor = new BABYLON.Color3(specVal, specVal, specVal)

      mesh.material = mat
      
      // Forzar individualidad de la geometría para evitar optimizaciones internas del motor
      mesh.makeGeometryUnique()

      activeMeshesRef.current.push({ mesh, mat })
    }

    // Limpieza de las geometrías base una vez clonadas
    baseGeos.forEach(g => g.dispose())

  }, [count])

  return (
    <main className="relative w-full h-screen bg-[#050505] overflow-hidden">
      
      <PerformanceOverlay
        title={`Draw Calls: ${count} Objetos`}
        input={true}
        count={count}
        setCount={setCount}
        inputConfig={{ unit: 'normal', type: 'values', values: [64, 256, 512, 1024, 4096] }}
      />

      <CombinedDrawCallsHUD 
        metrics={metrics} 
        engineMetrics={engineMetrics} 
        count={count} 
      />

      <div className="absolute inset-0 pointer-events-none z-10">
        <DebugTools title="Draw Calls Stress (Babylon)" entityCount={count} />
        {isLoading && <Loader3D />}
      </div>

      <canvas 
        ref={canvasRef} 
        className="w-full h-full outline-none block" 
      />
    </main>
  )
}