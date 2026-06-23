'use client'

import { useEffect, useRef, useState } from 'react'
import * as BABYLON from '@babylonjs/core'
import PerformanceOverlay from '@/components/test/PerformanceOverlay'
import Loader3D from '@/components/ui/Loader3D'

const JITTER_SAMPLE_SIZE = 120
const TARGET_FRAME_MS    = 16.667

const metricsCalculator = {
  samples: new Float32Array(JITTER_SAMPLE_SIZE),
  index: 0, filled: 0, warmup: 0,
  push(delta: number) {
    if (this.warmup < 10) { this.warmup++; return }
    const ms = delta * 1000
    this.samples[this.index] = ms
    this.index  = (this.index + 1) % JITTER_SAMPLE_SIZE
    this.filled = Math.min(this.filled + 1, JITTER_SAMPLE_SIZE)
  },
  mean() {
    if (this.filled < 1) return 0
    let sum = 0; for (let i = 0; i < this.filled; i++) sum += this.samples[i]
    return sum / this.filled
  },
  jitter() {
    if (this.filled < 2) return 0
    const m = this.mean()
    let v = 0; for (let i = 0; i < this.filled; i++) v += Math.pow(this.samples[i] - m, 2)
    return Math.sqrt(v / this.filled)
  },
  reset() { this.index = 0; this.filled = 0; this.warmup = 0 },
}

function HUD({ fps, cpuMs, frameMs, vramMB, jitterMs, frameBudget }: {
  fps: number; cpuMs: number; frameMs: number; vramMB: number; jitterMs: number; frameBudget: number
}) {
  const budgetColor = frameBudget < 50 ? 'text-emerald-400' : frameBudget < 85 ? 'text-yellow-400' : 'text-red-400'
  const jitterColor = jitterMs < 2    ? 'text-emerald-400' : jitterMs < 5    ? 'text-yellow-400' : 'text-red-400'

  const Card = ({ label, value, unit, color }: any) => (
    <div className={`bg-black/80 backdrop-blur border border-${color}-500/30 px-3 py-2 rounded-xl`}>
      <p className="text-gray-400 text-[10px] uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-lg font-mono font-black text-${color}-400`}>
        {value}<span className="text-[9px] text-gray-500 ml-0.5">{unit}</span>
      </p>
    </div>
  )

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 min-w-[260px]">
      <div className="bg-black/80 backdrop-blur border border-blue-500/40 px-4 py-2 rounded-xl flex justify-between items-center">
        <p className="text-gray-400 text-[10px] uppercase tracking-widest">Frame Budget</p>
        <p className={`text-xl font-mono font-black ${budgetColor}`}>
          {frameBudget.toFixed(1)}<span className="text-xs text-gray-500 ml-1">%</span>
        </p>
      </div>
      <div className="bg-black/80 backdrop-blur border border-yellow-500/40 px-4 py-2 rounded-xl flex justify-between items-center">
        <p className="text-gray-400 text-[10px] uppercase tracking-widest">Jitter — steady state</p>
        <p className={`text-xl font-mono font-black ${jitterColor}`}>
          {jitterMs.toFixed(2)}<span className="text-xs text-gray-500 ml-1">ms</span>
        </p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Card label="FPS"        value={fps}                unit="fps" color="green"  />
        <Card label="CPU"        value={cpuMs.toFixed(2)}   unit="ms"  color="blue"   />
        <Card label="Frame Time" value={frameMs.toFixed(2)} unit="ms"  color="slate"  />
        <Card label="VRAM"       value={vramMB.toFixed(1)}  unit="MB"  color="purple" />
        <Card label="Passes PP"  value="5"                  unit=""    color="orange" />
      </div>
    </div>
  )
}

export default function PostProcessingStressBabylonTest() {
  const [count, setCount]         = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [hudState, setHudState]   = useState({
    fps: 0, cpuMs: 0, frameMs: 0, vramMB: 0, jitterMs: 0, frameBudget: 0,
  })

  const canvasRef      = useRef<HTMLCanvasElement>(null)
  const instancesRef   = useRef<BABYLON.InstancedMesh[]>([])
  const baseMeshRef    = useRef<BABYLON.Mesh | null>(null)
  const sceneRef       = useRef<BABYLON.Scene | null>(null)
  const countRef       = useRef(count)

  // Mantener countRef sincronizado para leerlo dentro del observable
  useEffect(() => { countRef.current = count }, [count])

  // ─── Función de rebuild de instancias (no toca el engine) ────────────────
  const rebuildInstances = (scene: BABYLON.Scene, n: number) => {
    setIsLoading(true)
    metricsCalculator.reset()

    instancesRef.current.forEach(inst => inst.dispose())
    instancesRef.current = []
    if (baseMeshRef.current) {
      baseMeshRef.current.material?.dispose()
      baseMeshRef.current.dispose()
      baseMeshRef.current = null
    }

    const base = BABYLON.MeshBuilder.CreateSphere('base', { segments: 32, diameter: 2 }, scene)
    base.isVisible = false
    baseMeshRef.current = base

    const mat = new BABYLON.PBRMaterial('emissive', scene)
    mat.metallic          = 1
    mat.roughness         = 0
    mat.emissiveColor     = BABYLON.Color3.White()
    mat.emissiveIntensity = 3
    base.material         = mat

    for (let i = 0; i < n; i++) {
      const inst = base.createInstance(`s${i}`)
      inst.position.set(
        (Math.random() - 0.5) * 20,
        (Math.random() - 0.5) * 20,
        (Math.random() - 0.5) * 20,
      )
      inst.scaling.setAll(Math.random() * 0.5 + 0.2)
      instancesRef.current.push(inst)
    }

    // Pequeño delay para dejar que el primer frame renderice antes de quitar loader
    setTimeout(() => setIsLoading(false), 100)
  }

  // ─── Init motor UNA sola vez ──────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    canvas.width  = canvas.clientWidth  || window.innerWidth
    canvas.height = canvas.clientHeight || window.innerHeight

    const engine = new BABYLON.Engine(canvas, false, {
      preserveDrawingBuffer: true,
      stencil: true,
      adaptToDeviceRatio: true,
      powerPreference: 'high-performance',
    })

    const scene = new BABYLON.Scene(engine)
    sceneRef.current = scene
    scene.clearColor = new BABYLON.Color4(0.02, 0.02, 0.02, 1)

    const sceneInst  = new BABYLON.SceneInstrumentation(scene)
    const engineInst = new BABYLON.EngineInstrumentation(engine)
    sceneInst.captureFrameTime     = true
    sceneInst.captureDrawCalls     = true
    engineInst.captureGPUFrameTime = true

    // ── Cámara FIJA ──────────────────────────────────────────────────────────
    const camera = new BABYLON.ArcRotateCamera('cam', -Math.PI / 2, Math.PI / 2, 30, BABYLON.Vector3.Zero(), scene)
    camera.fov = 45 * (Math.PI / 180)
    // Sin attachControl → estática

    // ── Entorno ───────────────────────────────────────────────────────────────
    try {
      const envTexture = BABYLON.CubeTexture.CreateFromPrefilteredData(
        'https://assets.babylonjs.com/environments/night.env', scene,
      )
      scene.environmentTexture   = envTexture
      scene.environmentIntensity = 1.0
    } catch (_) {
      // fallback sin env si falla la carga
    }

    // ── Luces ─────────────────────────────────────────────────────────────────
    const ambient = new BABYLON.HemisphericLight('ambient', new BABYLON.Vector3(0, 1, 0), scene)
    ambient.intensity = 0.3

    const pLight = new BABYLON.PointLight('pLight', new BABYLON.Vector3(10, 10, 10), scene)
    pLight.diffuse   = BABYLON.Color3.FromHexString('#3b82f6')
    pLight.intensity = 10

    // ── Suelo ─────────────────────────────────────────────────────────────────
    const ground    = BABYLON.MeshBuilder.CreatePlane('ground', { size: 100 }, scene)
    ground.rotation.x = Math.PI / 2
    ground.position.y = -10
    const groundMat = new BABYLON.StandardMaterial('gmat', scene)
    groundMat.diffuseColor  = new BABYLON.Color3(0.067, 0.067, 0.067)
    ground.material         = groundMat

    // ── Post-procesado (5 passes) ─────────────────────────────────────────────
    // SSAO2 (pass 1)
    try {
      const ssao = new BABYLON.SSAO2RenderingPipeline('ssao', scene, {
        ssaoRatio: 0.5, blurRatio: 0.5,
      })
      ssao.radius        = 0.4
      ssao.totalStrength = 1.2
      ssao.expensiveBlur = false
      scene.postProcessRenderPipelineManager.attachCamerasToRenderPipeline('ssao', camera)
    } catch (_) {}

    // DefaultRenderingPipeline: Bloom + Grain + Vignette + ImageProcessing (passes 2-5)
    try {
      const pipeline = new BABYLON.DefaultRenderingPipeline('pp', true, engine, [camera])
      pipeline.bloomEnabled                   = true
      pipeline.bloomWeight                    = 1.5
      pipeline.bloomThreshold                 = 0.5
      pipeline.bloomScale                     = 0.9
      pipeline.bloomKernel                    = 300
      pipeline.grainEnabled                   = true
      pipeline.grain.intensity                = 12
      pipeline.grain.animated                 = false
      pipeline.imageProcessingEnabled         = true
      pipeline.vignetteEnabled                = true
      pipeline.vignetteWeight                 = 1.1
      pipeline.imageProcessing.contrast       = 1.1
      pipeline.imageProcessing.exposure       = 1.05
    } catch (_) {}

    // ── Primera carga de instancias ───────────────────────────────────────────
    rebuildInstances(scene, countRef.current)

    // ── Render loop ───────────────────────────────────────────────────────────
    let frameCount  = 0
    let lastTime    = performance.now()
    let lastLogTime = performance.now() - 2000

    scene.onBeforeRenderObservable.add(() => {
      const now   = performance.now()
      const delta = (now - lastTime) / 1000
      lastTime    = now

      metricsCalculator.push(delta)
      frameCount++

      if (frameCount % 10 === 0) {
        const meanMs      = metricsCalculator.mean()
        const jitterMs    = metricsCalculator.jitter()
        const frameBudget = (meanMs / TARGET_FRAME_MS) * 100
        const currentFps  = meanMs > 0 ? Math.round(1000 / meanMs) : 0
        const gpuMs       = engineInst.gpuFrameTimeCounter?.current
          ? engineInst.gpuFrameTimeCounter.current * 0.000001 : 0
        const cpuMs       = Math.max(0, sceneInst.frameTimeCounter.current - gpuMs)
        const totalIdx    = scene.getActiveIndices()
        const vramMB      = (totalIdx * 4 + (totalIdx / 3) * 32) / 1048576 + 16

        setHudState({
          fps:         currentFps,
          cpuMs,
          frameMs:     Math.round(meanMs * 100) / 100,
          vramMB,
          jitterMs:    Math.round(jitterMs * 100) / 100,
          frameBudget: Math.round(frameBudget * 10) / 10,
        })
      }

      // Console log cada 2s — mismo formato que R3F
      if (now - lastLogTime >= 2000) {
        lastLogTime = now
        const meanMs      = metricsCalculator.mean()
        const jitterMs    = metricsCalculator.jitter()
        const frameBudget = (meanMs / TARGET_FRAME_MS) * 100
        const currentFps  = meanMs > 0 ? 1000 / meanMs : 0
        const gpuMs       = engineInst.gpuFrameTimeCounter?.current
          ? engineInst.gpuFrameTimeCounter.current * 0.000001 : 0
        const cpuMs       = Math.max(0, sceneInst.frameTimeCounter.current - gpuMs)
        const totalIdx    = scene.getActiveIndices()
        const vramMB      = (totalIdx * 4 + (totalIdx / 3) * 32) / 1048576 + 16

        console.log(
          `%c[Post-Processing] ${instancesRef.current.length.toLocaleString()} Objetos + 5 Passes (SSAO/Bloom/Noise/Vignette/BC)`,
          'color:#10b981;font-weight:bold;font-size:12px',
        )
        console.log(`%cMotor%c Babylon.js`,                                       'color:#94a3b8', 'color:#e2e8f0;font-weight:600')
        console.log(`%cFPS%c ${Math.round(currentFps)}`,                          'color:#94a3b8', 'color:#e2e8f0;font-weight:600')
        console.log(`%cCPU (ms)%c ${cpuMs.toFixed(2)} ms`,                        'color:#94a3b8', 'color:#38bdf8;font-weight:600')
        console.log(`%cFrame Time (ms)%c ${meanMs.toFixed(2)} ms`,                'color:#94a3b8', 'color:#e2e8f0;font-weight:600')
        console.log(`%cVRAM (mb)%c ${vramMB.toFixed(1)} MB`,                      'color:#94a3b8', 'color:#a78bfa;font-weight:600')
        console.log(`%cJitter — steady state (ms)%c ${jitterMs.toFixed(2)} ms`,   'color:#94a3b8', 'color:#fbbf24;font-weight:600')
        console.log(`%cFrame Budget (%)%c ${frameBudget.toFixed(1)}%`,            'color:#94a3b8', 'color:#f43f5e;font-weight:600')
        console.log('--------------------------------------------------')
      }
    })

    engine.runRenderLoop(() => scene.render())

    const handleResize = () => {
      canvas.width  = canvas.clientWidth
      canvas.height = canvas.clientHeight
      engine.resize()
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      engine.dispose()
    }
  }, []) // ← solo una vez

  // ─── Cuando cambia count, solo rebuild instancias ─────────────────────────
  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return
    rebuildInstances(scene, count)
  }, [count])

  return (
    <main className="relative w-full h-screen bg-[#050505] overflow-hidden">
      <PerformanceOverlay
        title={`Babylon Post-Procesado: ${count} Emisores`}
        input={true}
        count={count}
        setCount={setCount}
        inputConfig={{ unit: 'normal', type: 'values', values: [32, 128, 512] }}
      />
      <HUD {...hudState} />
      <div className="absolute inset-0 pointer-events-none z-10">
        {isLoading && <Loader3D />}
      </div>
      <canvas ref={canvasRef} className="w-full h-full outline-none block" />
    </main>
  )
}