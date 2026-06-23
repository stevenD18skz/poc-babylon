'use client'

import { useEffect, useRef, useState } from 'react'
import * as BABYLON from '@babylonjs/core'
import PerformanceOverlay from '@/components/test/PerformanceOverlay'
import Loader3D from '@/components/ui/Loader3D'

// ─── MÉTRICAS ────────────────────────────────────────────────────────────────
const JITTER_SAMPLE_SIZE = 60

interface AnimMetrics {
  jitter: number
  frameBudget: number
  frameTime: number
  onePercentLow: number
  maxFrameTime: number
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
    if (this.filled < 2) return { jitter: 0, frameBudget: 0, frameTime: 0, onePercentLow: 0, maxFrameTime: 0 }
    const n = this.filled
    let sum = 0
    let max = 0
    for (let i = 0; i < n; i++) {
      sum += this.samples[i]
      if (this.samples[i] > max) max = this.samples[i]
    }
    const mean = sum / n
    let variance = 0
    for (let i = 0; i < n; i++) {
      const diff = this.samples[i] - mean
      variance += diff * diff
    }
    const jitter = Math.sqrt(variance / n)
    const frameBudget = (mean / 16.667) * 100
    const sorted = this.samples.slice(0, n).sort((a, b) => b - a)
    const onePercentCount = Math.max(1, Math.floor(n * 0.01))
    let worstSum = 0
    for (let i = 0; i < onePercentCount; i++) worstSum += sorted[i]
    const worstMean = worstSum / onePercentCount
    const onePercentLow = worstMean > 0 ? Math.round(1000 / worstMean) : 0
    return {
      jitter: Math.round(jitter * 100) / 100,
      frameBudget: Math.round(frameBudget * 10) / 10,
      frameTime: Math.round(mean * 100) / 100,
      onePercentLow,
      maxFrameTime: Math.round(max * 100) / 100,
    }
  },
}

// ─── HUD ─────────────────────────────────────────────────────────────────────
function AnimMetricsHUD({
  metrics,
  engineMetrics,
  count,
}: {
  metrics: AnimMetrics
  engineMetrics: any
  count: number
}) {
  const jitterColor =
    metrics.jitter < 1 ? 'text-emerald-400' : metrics.jitter < 3 ? 'text-yellow-400' : 'text-red-400'
  const budgetColor =
    metrics.frameBudget < 50 ? 'text-emerald-400' : metrics.frameBudget < 80 ? 'text-yellow-400' : 'text-red-400'

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
      <div className="grid grid-cols-2 gap-2 mb-2">
        <div className="bg-black/80 backdrop-blur-xl border border-blue-500/40 px-4 py-3 rounded-xl">
          <p className="text-gray-400 text-xs uppercase tracking-widest mb-1">Frame Budget</p>
          <p className={`text-2xl font-mono font-black ${budgetColor}`}>
            {metrics.frameBudget.toFixed(1)}
            <span className="text-xs text-gray-500 ml-1">%</span>
          </p>
          <p className="text-gray-600 text-[10px]">de 16.67ms (60fps)</p>
        </div>
        <div className="bg-black/80 backdrop-blur-xl border border-violet-500/40 px-4 py-3 rounded-xl">
          <p className="text-gray-400 text-xs uppercase tracking-widest mb-1">Render Callbacks</p>
          <p className="text-2xl font-mono font-black text-violet-400">{count + 1}</p>
          <p className="text-gray-600 text-[10px]">Observables equiv. a useFrame</p>
        </div>
      </div>
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

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
export default function AnimationStressBabylonTest() {
  const [count, setCount] = useState(16000)
  const [isLoading, setIsLoading] = useState(true)
  const [metrics, setMetrics] = useState<AnimMetrics>({
    jitter: 0,
    frameBudget: 0,
    frameTime: 0,
    onePercentLow: 0,
    maxFrameTime: 0,
  })
  const [engineMetrics, setEngineMetrics] = useState<any>({
    fps: 0,
    cpuTime: 0,
    gpuTime: 0,
    drawCalls: 0,
    triangles: 0,
    ram: 0,
    vram: 0,
  })

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<BABYLON.Scene | null>(null)
  const engineRef = useRef<BABYLON.Engine | null>(null)
  const engineInstRef = useRef<BABYLON.EngineInstrumentation | null>(null)
  const sceneInstRef = useRef<BABYLON.SceneInstrumentation | null>(null)
  const activeEntitiesRef = useRef<{
    mesh: BABYLON.Mesh
    mat: BABYLON.Material
    obs: BABYLON.Observer<BABYLON.Scene>
  }[]>([])
  const baseGeoRef = useRef<BABYLON.Mesh | null>(null)

  // ─── 1. Init Motor ──────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // ✅ FIX PRINCIPAL: forzar tamaño del canvas antes de crear el engine
    canvas.width = canvas.clientWidth || window.innerWidth
    canvas.height = canvas.clientHeight || window.innerHeight

    const engine = new BABYLON.Engine(canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
      adaptToDeviceRatio: true,
    })
    const scene = new BABYLON.Scene(engine)
    scene.clearColor = new BABYLON.Color4(0.02, 0.02, 0.02, 1)

    sceneRef.current = scene
    engineRef.current = engine

    // Instrumentación
    const sceneInst = new BABYLON.SceneInstrumentation(scene)
    const engineInst = new BABYLON.EngineInstrumentation(engine)
    sceneInst.captureFrameTime = true
    sceneInst.captureDrawCalls = true
    engineInst.captureGPUFrameTime = true
    sceneInstRef.current = sceneInst
    engineInstRef.current = engineInst

    // ── Cámara FIJA ──────────────────────────────────────────────────────────
    const camera = new BABYLON.ArcRotateCamera(
      'camera',
      -Math.PI / 2,
      Math.PI / 3,
      29.15,
      BABYLON.Vector3.Zero(),
      scene,
    )
    camera.setPosition(new BABYLON.Vector3(0, 15, 25))
    camera.fov = 50 * (Math.PI / 180)
    // Sin attachControl → estática

    // ── Iluminación ──────────────────────────────────────────────────────────
    const ambient = new BABYLON.HemisphericLight('ambient', new BABYLON.Vector3(0, 1, 0), scene)
    ambient.intensity = 1.2
    ambient.groundColor = new BABYLON.Color3(0.2, 0.2, 0.3)

    const pLight = new BABYLON.PointLight('point', new BABYLON.Vector3(0, 10, 5), scene)
    pLight.intensity = 3.0
    pLight.diffuse = new BABYLON.Color3(1, 1, 1)

    const pLight2 = new BABYLON.PointLight('point2', new BABYLON.Vector3(-10, 5, -5), scene)
    pLight2.intensity = 1.5
    pLight2.diffuse = new BABYLON.Color3(0.4, 0.6, 1.0)

    // ── Métricas + console log ────────────────────────────────────────────────
    let frameCount = 0
    let lastTime = performance.now()
    let lastLogTime = performance.now()

    const collectorObs = scene.onBeforeRenderObservable.add(() => {
      const now = performance.now()
      const delta = (now - lastTime) / 1000
      lastTime = now

      metricsCalculator.push(delta)
      frameCount++

      if (frameCount === 1) setIsLoading(false)

      if (frameCount % 10 === 0) {
        const computed = metricsCalculator.compute()
        setMetrics(computed)

        const memoryInfo = (performance as any).memory
        const ramMB = memoryInfo ? Math.round(memoryInfo.usedJSHeapSize / 1048576) : 0
        const gpuTimeMs =
          engineInst.gpuFrameTimeCounter?.current
            ? (engineInst.gpuFrameTimeCounter.current * 0.000001).toFixed(2)
            : 'N/A'
        const vramEst =
          (scene.getActiveIndices() * 4 + scene.getActiveIndices() * 8 * 4) / 1048576

        setEngineMetrics({
          fps: Math.round(engine.getFps()),
          cpuTime: sceneInst.frameTimeCounter.current.toFixed(2),
          gpuTime: gpuTimeMs,
          drawCalls: sceneInst.drawCallsCounter.current,
          triangles: scene.getActiveIndices() / 3,
          ram: ramMB,
          vram: vramEst.toFixed(2),
        })
      }

      // ── Console log cada 5s ───────────────────────────────────────────────
      if (now - lastLogTime >= 5000) {
        lastLogTime = now

        const fps = engine.getFps()
        const computed = metricsCalculator.compute()
        const { frameTime, onePercentLow, frameBudget } = computed

        const gpuMs =
          engineInst.gpuFrameTimeCounter?.current
            ? engineInst.gpuFrameTimeCounter.current * 0.000001
            : 0
        const cpuMs = Math.max(0, frameTime - gpuMs)

        const memoryInfo = (performance as any).memory
        const ramMBLog = memoryInfo ? (memoryInfo.usedJSHeapSize / 1048576).toFixed(1) : 'N/A'

        console.group(
          `%c[Babylon Anim Stress Test] ${new Date().toLocaleTimeString()}`,
          'color:#6366f1;font-weight:700;font-size:12px',
        )
        console.log(`%cEntidades           %c${activeEntitiesRef.current.length}`, 'color:#94a3b8', 'color:#f1f5f9;font-weight:600')
        console.log(`%cMotor               %cBabylon.js`,                           'color:#94a3b8', 'color:#f1f5f9;font-weight:600')
        console.log(`%cFPS                 %c${fps.toFixed(1)}`,                    'color:#94a3b8', 'color:#f1f5f9;font-weight:600')
        console.log(`%c1%% Low (FPS)       %c${onePercentLow}`,                     'color:#94a3b8', 'color:#f1f5f9;font-weight:600')
        console.log(`%cCPU (ms)            %c${cpuMs.toFixed(2)}`,                  'color:#94a3b8', 'color:#f1f5f9;font-weight:600')
        console.log(`%cFrame Time (ms)     %c${frameTime.toFixed(2)}`,              'color:#94a3b8', 'color:#f1f5f9;font-weight:600')
        console.log(`%cFrame Budget (%%)   %c${frameBudget.toFixed(1)}`,            'color:#94a3b8', 'color:#f1f5f9;font-weight:600')
        console.log(`%cRAM (MB)            %c${ramMBLog}`,                          'color:#94a3b8', 'color:#f1f5f9;font-weight:600')
        console.groupEnd()
      }
    })

    engine.runRenderLoop(() => scene.render())

    const handleResize = () => {
      canvas.width = canvas.clientWidth
      canvas.height = canvas.clientHeight
      engine.resize()
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      scene.onBeforeRenderObservable.remove(collectorObs)
      engine.dispose()
    }
  }, [])

  // ─── 2. Entidades dinámicas ────────────────────────────────────────────────
  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return

    setIsLoading(true)

    activeEntitiesRef.current.forEach((ent) => {
      scene.onBeforeRenderObservable.remove(ent.obs)
      ent.mesh.dispose()
      ent.mat.dispose()
    })
    activeEntitiesRef.current = []

    if (baseGeoRef.current) {
      baseGeoRef.current.dispose()
      baseGeoRef.current = null
    }

    const baseGeo = BABYLON.MeshBuilder.CreateIcoSphere(
      'baseGeo',
      { radius: 0.3, subdivisions: 2 },
      scene,
    )
    baseGeo.isVisible = false
    baseGeoRef.current = baseGeo

    for (let i = 0; i < count; i++) {
      const theta = (i / count) * Math.PI * 8
      const ring = Math.floor(i / 50)
      const r = 3 + ring * 1.2

      const baseX = Math.cos(theta) * r
      const baseY = 0
      const baseZ = Math.sin(theta) * r
      const phase = (i / count) * Math.PI * 2

      const hue = (phase / (Math.PI * 2)) * 360

      const mat = new BABYLON.StandardMaterial(`mat-${i}`, scene)
      mat.diffuseColor = BABYLON.Color3.FromHSV(hue, 0.8, 0.9)
      mat.emissiveColor = BABYLON.Color3.FromHSV(hue, 0.9, 0.5) // ✅ más brillante
      mat.specularColor = new BABYLON.Color3(0.6, 0.6, 0.6)
      mat.specularPower = 32

      const mesh = baseGeo.clone(`sphere-${i}`)
      mesh.isVisible = true
      mesh.position.set(baseX, baseY, baseZ)
      mesh.material = mat
      mesh.makeGeometryUnique()

      // ✅ FIX: sin rotationQuaternion → rotation.x/z funciona
      mesh.rotationQuaternion = null

      const obs = scene.onBeforeRenderObservable.add(() => {
        const t = performance.now() * 0.001 + phase
        mesh.position.y = baseY + Math.sin(t * 2) * 1.5
        const scale = 0.8 + Math.sin(t * 3) * 0.3
        mesh.scaling.setAll(scale)
        mesh.rotation.x = t * 0.5
        mesh.rotation.z = t * 0.3
      })

      activeEntitiesRef.current.push({ mesh, mat, obs })
    }
  }, [count])

  return (
    <main className="relative w-full h-screen bg-[#050505] overflow-hidden">
      <PerformanceOverlay
        title={`Babylon: ${count} Observables Indep.`}
        input={true}
        count={count}
        setCount={setCount}
        inputConfig={{ unit: 'normal', type: 'values', values: [64, 256, 1000, 4000, 16000] }}
      />

      <AnimMetricsHUD metrics={metrics} engineMetrics={engineMetrics} count={count} />

      <div className="absolute inset-0 pointer-events-none z-10">
        {isLoading && <Loader3D />}
      </div>

      <canvas ref={canvasRef} className="w-full h-full outline-none block" />
    </main>
  )
}