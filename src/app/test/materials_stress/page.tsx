'use client'

import { useEffect, useRef, useState, useMemo } from 'react'
import * as BABYLON from '@babylonjs/core'
import PerformanceOverlay from '@/components/test/PerformanceOverlay'
import DebugTools from '@/components/DebugTools'
import Loader3D from '@/components/ui/Loader3D'

// ─── CONSTANTES Y TIPOS ──────────────────────────────────────────────────────
const SHADER_TYPES = ['Transmission', 'Metal PBR', 'Clearcoat+Sheen'] as const
type ShaderType = typeof SHADER_TYPES[number]

const JITTER_SAMPLE_SIZE = 60

// ─── MÉTRICAS Y CÁLCULOS ─────────────────────────────────────────────────────
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

// ─── HUD COMPLETO (Sistemas + Materiales) ────────────────────────────────────
function CombinedMaterialsHUD({ 
  metrics, engineMetrics, shaderBreakdown 
}: { 
  metrics: any; engineMetrics: any; shaderBreakdown: Record<ShaderType, number> 
}) {
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
      
      {/* Sección Materiales y Tiempos Puros */}
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

      <div className="bg-black/80 backdrop-blur border border-violet-500/40 px-4 py-3 rounded-xl mb-1">
        <p className="text-gray-400 text-[10px] uppercase tracking-widest mb-2">Shader Variants Activos</p>
        {SHADER_TYPES.map((t) => (
          <div key={t} className="flex justify-between text-[11px] mb-1 border-b border-white/5 pb-1 last:border-0 last:pb-0">
            <span className="text-gray-400">{t}</span>
            <span className="text-violet-400 font-mono font-bold">{shaderBreakdown[t]}</span>
          </div>
        ))}
      </div>

      {/* Métricas Generales del Motor */}
      <div className="grid grid-cols-3 gap-2">
        <MetricCard label="FPS" value={engineMetrics.fps} unit="fps" color="green" />
        <MetricCard label="CPU" value={engineMetrics.cpuTime} unit="ms" color="blue" />
        <MetricCard label="GPU" value={engineMetrics.gpuTime} unit="ms" color="pink" />
        <MetricCard label="Draw Calls" value={engineMetrics.drawCalls} unit="" color="yellow" />
        <MetricCard label="Triángulos" value={engineMetrics.triangles?.toLocaleString()} unit="" color="purple" />
        <MetricCard label="RAM" value={engineMetrics.ram} unit="MB" color="cyan" />
        <MetricCard label="VRAM (Est)" value={engineMetrics.vram} unit="MB" color="orange" />
      </div>
    </div>
  )
}

// ─── COMPONENTE PRINCIPAL BABYLON ────────────────────────────────────────────
export default function MaterialsStressBabylonTest() {
  const [count, setCount] = useState(128)
  const [isLoading, setIsLoading] = useState(true)
  
  const [metrics, setMetrics] = useState<any>({ jitter: 0, frameBudget: 0, frameTime: 0 })
  const [engineMetrics, setEngineMetrics] = useState<any>({ fps: 0, cpuTime: 0, gpuTime: 0, drawCalls: 0, triangles: 0, ram: 0, vram: 0 })

  const canvasRef = useRef<HTMLCanvasElement>(null)
  
  const sceneRef = useRef<BABYLON.Scene | null>(null)
  const engineRef = useRef<BABYLON.Engine | null>(null)
  const instancesRef = useRef<{ mesh: BABYLON.Mesh, mat: BABYLON.Material }[]>([])

  const shaderBreakdown = useMemo<Record<ShaderType, number>>(() => ({
    'Transmission': Math.ceil(count / 3),
    'Metal PBR': Math.floor(count / 3),
    'Clearcoat+Sheen': Math.floor(count / 3),
  }), [count])

  // 1. Inicialización de Motor y Entorno
  useEffect(() => {
    if (!canvasRef.current) return

    const engine = new BABYLON.Engine(canvasRef.current, true, { preserveDrawingBuffer: true, stencil: true, antialias: true })
    engineRef.current = engine

    const scene = new BABYLON.Scene(engine)
    scene.clearColor = new BABYLON.Color4(0.02, 0.02, 0.02, 1)
    sceneRef.current = scene

    // Instrumentación
    const sceneInst = new BABYLON.SceneInstrumentation(scene)
    const engineInst = new BABYLON.EngineInstrumentation(engine)
    sceneInst.captureFrameTime = true
    sceneInst.captureDrawCalls = true
    engineInst.captureGPUFrameTime = true

    // Cámara (Equivalente a position: [0, 0, 40], fov: 45)
    const camera = new BABYLON.ArcRotateCamera("camera", -Math.PI / 2, Math.PI / 2, 40, BABYLON.Vector3.Zero(), scene)
    camera.fov = 45 * (Math.PI / 180)
    camera.attachControl(canvasRef.current, true)

    // Entorno HDRI (Preset Studio nativo de Babylon - Necesario para reflejos PBR y transmisión)
    const envTexture = BABYLON.CubeTexture.CreateFromPrefilteredData("https://assets.babylonjs.com/environments/studio.env", scene)
    scene.environmentTexture = envTexture
    scene.environmentIntensity = 1.0

    // Nodo central para rotación global
    const rootNode = new BABYLON.TransformNode("root", scene)

    // Render Loop
    let frameCount = 0
    let lastTime = performance.now()
    const startAnimTime = performance.now()

    scene.onBeforeRenderObservable.add(() => {
      const now = performance.now()
      const delta = (now - lastTime) / 1000
      lastTime = now

      metricsCalculator.push(delta)
      frameCount++

      if (frameCount === 1) setIsLoading(false)

      // Rotación del grupo (Equivalente al useFrame del groupRef en R3F)
      const t = (now - startAnimTime) * 0.001
      rootNode.rotation.y = t * 0.05

      // Actualizar Métricas
      if (frameCount % 10 === 0) {
        setMetrics(metricsCalculator.compute())
        
        const memoryInfo = (performance as any).memory
        const ramMB = memoryInfo ? Math.round(memoryInfo.usedJSHeapSize / 1048576) : 0
        const gpuTimeMs = engineInst.gpuFrameTimeCounter?.current ? (engineInst.gpuFrameTimeCounter.current * 0.000001).toFixed(2) : "N/A"
        
        // VRAM Estimada: Geometría base + Textura Env (aprox 16MB) + Shaders/Materiales (aprox 1MB por variante compila)
        const vramEst = ((scene.getActiveIndices() * 4) + (scene.getActiveVertices() * 32)) / 1048576 + 16 + (count * 0.5)

        setEngineMetrics({
          fps: Math.round(engine.getFps()),
          cpuTime: sceneInst.frameTimeCounter.current.toFixed(2),
          gpuTime: gpuTimeMs,
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

  // 2. Generación Dinámica de Materiales y Geometrías
  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return

    setIsLoading(true)

    // Limpiar instancias anteriores (para forzar nueva compilación y medir costo real)
    instancesRef.current.forEach(inst => {
      inst.mesh.dispose()
      inst.mat.dispose()
    })
    instancesRef.current = []

    const rootNode = scene.getNodeByName("root") as BABYLON.TransformNode

    // Geometrías precalculadas base (Equivalente al useMemo de R3F)
    const baseTorusKnot = BABYLON.MeshBuilder.CreateTorusKnot("baseTK", { radius: 1, tube: 0.3, radialSegments: 128, tubularSegments: 32 }, scene)
    const baseSphere = BABYLON.MeshBuilder.CreateSphere("baseSp", { segments: 64, diameter: 2 }, scene)
    baseTorusKnot.isVisible = false
    baseSphere.isVisible = false

    // Generar N variantes
    for (let i = 0; i < count; i++) {
      const type = i % 3
      const isTorus = i % 2 === 0
      
      const mesh = isTorus ? baseTorusKnot.clone(`tk-${i}`) : baseSphere.clone(`sp-${i}`)
      mesh.isVisible = true
      mesh.parent = rootNode

      // Posición, rotación y escala aleatoria
      mesh.position.set((Math.random() - 0.5) * 25, (Math.random() - 0.5) * 25, (Math.random() - 0.5) * 25)
      mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI)
      const scale = Math.random() * 1.5 + 0.5
      mesh.scaling.setAll(scale)

      const hue = (i / count) * 360
      const color = BABYLON.Color3.FromHSV(hue, 0.7, 0.5)

      // ─── CREACIÓN DE MATERIALES (Forzando compilación PBR compleja) ───
      const pbr = new BABYLON.PBRMaterial(`mat-${i}`, scene)
      pbr.albedoColor = color

      if (type === 0) {
        // TIPO 0: TRANSMISSION (El más pesado)
        pbr.metallic = 0
        pbr.roughness = 0.1
        pbr.subSurface.isRefractionEnabled = true
        pbr.subSurface.indexOfRefraction = 1.2
        pbr.subSurface.tintColor = color
        // Babylon >v6 soporta aberración cromática
        pbr.subSurface.useDispersion = true 
        pbr.subSurface.dispersion = 0.05
      } 
      else if (type === 1) {
        // TIPO 1: METAL PBR
        pbr.metallic = 1.0
        pbr.roughness = 0.05
        pbr.clearCoat.isEnabled = true
        pbr.clearCoat.roughness = 0.1
      } 
      else if (type === 2) {
        // TIPO 2: CLEARCOAT + SHEEN
        pbr.metallic = 0.1
        pbr.roughness = 0.4
        pbr.clearCoat.isEnabled = true
        pbr.clearCoat.roughness = 0.1
        pbr.sheen.isEnabled = true
        pbr.sheen.roughness = 0.5
        pbr.sheen.color = BABYLON.Color3.White()
      }

      mesh.material = pbr
      instancesRef.current.push({ mesh, mat: pbr })
    }

  }, [count])

  return (
    <main className="relative w-full h-screen bg-[#050505] overflow-hidden">
      
      <PerformanceOverlay
        title={`Babylon PBR: ${count} Shaders`}
        input={true}
        count={count}
        setCount={setCount}
        inputConfig={{ unit: 'normal', type: 'values', values: [8, 16, 32, 64, 128] }}
      />

      <CombinedMaterialsHUD 
        metrics={metrics} 
        engineMetrics={engineMetrics} 
        shaderBreakdown={shaderBreakdown} 
      />

      <div className="absolute inset-0 pointer-events-none z-10">
        <DebugTools title="PBR / Transmission Stress (Babylon)" entityCount={count} />
        {isLoading && <Loader3D />}
      </div>

      <canvas 
        ref={canvasRef} 
        className="w-full h-full outline-none block" 
      />
    </main>
  )
}