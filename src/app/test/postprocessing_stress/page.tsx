'use client'

import { useEffect, useRef, useState } from 'react'
import * as BABYLON from '@babylonjs/core'
import PerformanceOverlay from '@/components/test/PerformanceOverlay'

// ─── GUARD DE MÓDULO ──────────────────────────────────────────────────────────
let _engine: BABYLON.Engine | null = null
let _scene:  BABYLON.Scene  | null = null

// ─── MÉTRICAS ─────────────────────────────────────────────────────────────────
const SAMPLE_SIZE = 120
const FRAME_BUDGET_MS = 10.0 // 100hz = 10ms por frame

const deltaCalc = {
  samples: new Float32Array(SAMPLE_SIZE),
  index: 0,
  filled: 0,
  push(ms: number) {
    this.samples[this.index] = ms
    this.index  = (this.index + 1) % SAMPLE_SIZE
    this.filled = Math.min(this.filled + 1, SAMPLE_SIZE)
  },
  mean() {
    if (this.filled < 1) return 0
    let sum = 0
    for (let i = 0; i < this.filled; i++) sum += this.samples[i]
    return sum / this.filled
  },
  jitter() {
    if (this.filled < 2) return 0
    const m = this.mean()
    let v = 0
    for (let i = 0; i < this.filled; i++) v += (this.samples[i] - m) ** 2
    return Math.sqrt(v / this.filled)
  },
  reset() { this.index = 0; this.filled = 0 },
}

// ─── VRAM ESTIMADA ────────────────────────────────────────────────────────────
function estimateVRAM(scene: BABYLON.Scene, count: number): number {
  // Geometría esfera (32x32): vértices * (pos+normal+uv) * float32 + indices
  const vertexCount  = 33 * 33                   // segments+1 ^2
  const indexCount   = 32 * 32 * 6
  const geometryBytes = (vertexCount * (3 + 3 + 2) * 4) + (indexCount * 2)

  // Instanced buffer: count * mat4 (16 floats)
  const instanceBytes = count * 16 * 4

  // Texturas del environment (estimado IBL night ~6 caras * 256*256 * 4 bytes * mips ~1.33)
  const envBytes = 6 * 256 * 256 * 4 * 1.33

  // Post-process: 5 passes × resolución full (asumimos 1920×1080 × RGBA)
  const ppBytes = 5 * 1920 * 1080 * 4

  const totalMB = (geometryBytes + instanceBytes + envBytes + ppBytes) / 1048576
  return Math.round(totalMB * 10) / 10
}

// ─── HELPER: construye InstancedMesh equivalente ──────────────────────────────
function buildScene(scene: BABYLON.Scene, count: number) {
  // Limpiar meshes anteriores (excepto luces y cámara)
  scene.meshes
    .filter(m => m.name.startsWith('emitter') || m.name === 'ground')
    .forEach(m => m.dispose())
  scene.materials
    .filter(m => m.name.startsWith('mat-'))
    .forEach(m => m.dispose())

  deltaCalc.reset()

  // ── Material emisivo único (equivalente a meshStandardMaterial emissive) ──
  const mat = new BABYLON.PBRMaterial('mat-emitter', scene)
  mat.roughness        = 0
  mat.metallic         = 1
  mat.emissiveColor    = new BABYLON.Color3(1, 1, 1)
  mat.emissiveIntensity = 3

  // ── InstancedMesh: 1 draw call para todos los emisores ──
  const baseSphere = BABYLON.MeshBuilder.CreateSphere('emitter-base', {
    diameter: 2,
    segments: 32,
  }, scene)
  baseSphere.material  = mat
  baseSphere.isVisible = false // base oculta

  const dummy = new BABYLON.Matrix()

  for (let i = 0; i < count; i++) {
    const inst = baseSphere.createInstance(`emitter-${i}`)
    inst.position.set(
      (Math.random() - 0.5) * 20,
      (Math.random() - 0.5) * 20,
      (Math.random() - 0.5) * 20,
    )
    inst.scaling.setAll(Math.random() * 0.5 + 0.2)
  }

  // ── Suelo equivalente ──
  const ground = BABYLON.MeshBuilder.CreateGround('ground', { width: 100, height: 100 }, scene)
  ground.position.y = -10
  const groundMat = new BABYLON.PBRMaterial('mat-ground', scene)
  groundMat.albedoColor = new BABYLON.Color3(0.067, 0.067, 0.067)
  groundMat.roughness   = 0.5
  groundMat.metallic    = 0
  ground.material       = groundMat
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
export default function PostProcessingBabylonTest() {
  const [count, setCount] = useState(256)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const countRef  = useRef(count)

  useEffect(() => { countRef.current = count }, [count])

  // ─── 1. Init motor ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!canvasRef.current) return

    if (_engine && !_engine.isDisposed) {
      if (_scene) buildScene(_scene, countRef.current)
      return
    }

    const engine = new BABYLON.Engine(canvasRef.current, false, {
      preserveDrawingBuffer: true,
      stencil: true,
      powerPreference: 'high-performance',
    })
    _engine = engine

    const scene = new BABYLON.Scene(engine)
    scene.clearColor = new BABYLON.Color4(0.02, 0.02, 0.02, 1)
    _scene = scene

    // Instrumentación CPU
    const inst = new BABYLON.SceneInstrumentation(scene)
    inst.captureFrameTime = true

    // ── Cámara ──
    const cam = new BABYLON.ArcRotateCamera('cam', -Math.PI / 2, Math.PI / 2.5, 30, BABYLON.Vector3.Zero(), scene)
    cam.setPosition(new BABYLON.Vector3(0, 0, 30))
    cam.fov = 45 * (Math.PI / 180)
    cam.attachControl(canvasRef.current, true)

    // ── Luces equivalentes ──
    const ambient = new BABYLON.HemisphericLight('amb', new BABYLON.Vector3(0, 1, 0), scene)
    ambient.intensity = 0.3

    const point = new BABYLON.PointLight('pt', new BABYLON.Vector3(10, 10, 10), scene)
    point.diffuse   = BABYLON.Color3.FromHexString('#3b82f6')
    point.intensity = 10

    // ── Environment (IBL equivalente a preset="night") ──
    scene.environmentIntensity = 0.5
    const hdrTexture = BABYLON.CubeTexture.CreateFromPrefilteredData(
      'https://assets.babylonjs.com/environments/environmentSpecular.env',
      scene,
    )
    scene.environmentTexture = hdrTexture
    scene.createDefaultSkybox(hdrTexture, true, 1000, 0.1, false)

    // ── Post-process equivalente (5 passes) ──
    // 1. SSAO
    const ssao = new BABYLON.SSAO2RenderingPipeline('ssao', scene, {
      ssaoRatio: 0.5,
      blurRatio:  1,
    })
    ssao.radius            = 0.4
    ssao.totalStrength     = 1.5
    ssao.base              = 0.5
    ssao.minZAspect        = 0.2
    scene.postProcessRenderPipelineManager.attachCamerasToRenderPipeline('ssao', cam)

    // 2-5. Bloom + Noise + Vignette + BrightnessContrast en pipeline estándar
    const pipeline = new BABYLON.DefaultRenderingPipeline('pp', true, scene, [cam])
    // Bloom
    pipeline.bloomEnabled    = true
    pipeline.bloomThreshold  = 0.5
    pipeline.bloomWeight     = 1.5
    pipeline.bloomKernel     = 64
    pipeline.bloomScale      = 0.5
    // Grain (equivalente a Noise)
    pipeline.grainEnabled    = true
    pipeline.grain.intensity = 10
    pipeline.grain.animated  = false
    // Vignette
    pipeline.vignetteEnabled = true
    pipeline.vignetteCurve   = BABYLON.Camera.RIG_MODE_NONE
    pipeline.vignetteWeight  = 2.5
    pipeline.vignetteColor   = new BABYLON.Color4(0, 0, 0, 1)
    // Brightness / Contrast
    pipeline.imageProcessingEnabled    = true
    pipeline.imageProcessing.contrast  = 1.1
    pipeline.imageProcessing.exposure  = 1.05

    // ── Meshes ──
    buildScene(scene, countRef.current)

    // ── Render loop ──
    let frameCount  = 0
    let lastTime    = performance.now()
    let lastLogTime = performance.now() - 9000

    scene.onBeforeRenderObservable.add(() => {
      const now   = performance.now()
      const delta = now - lastTime
      lastTime    = now
      frameCount++

      if (frameCount > 10) deltaCalc.push(delta)

      if (now - lastLogTime >= 10000) {
        lastLogTime = now

        const meanFt      = deltaCalc.mean()
        const fps         = meanFt > 0 ? 1000 / meanFt : engine.getFps()
        const jitter      = deltaCalc.jitter()
        const cpuMs       = inst.frameTimeCounter.current
        const frameBudget = (meanFt / FRAME_BUDGET_MS) * 100
        const vramMB      = estimateVRAM(scene, countRef.current)

        console.groupCollapsed(
          `%c[Post-Processing Babylon] ${new Date().toLocaleTimeString()}  |  ${countRef.current} emisores + 5 passes`,
          'color:#10b981;font-weight:700;font-size:12px',
        )
        console.log(`%cFPS                       %c${fps.toFixed(1)}`,           'color:#94a3b8', 'color:#f1f5f9;font-weight:600')
        console.log(`%cCPU (ms)                  %c${cpuMs.toFixed(2)} ms`,      'color:#94a3b8', 'color:#38bdf8;font-weight:600')
        console.log(`%cFrame Time (ms)           %c${meanFt.toFixed(2)} ms`,     'color:#94a3b8', 'color:#f1f5f9;font-weight:600')
        console.log(`%cVRAM (mb)                 %c${vramMB} MB`,                'color:#94a3b8', 'color:#a78bfa;font-weight:600')
        console.log(`%cJitter — steady state(ms) %c${jitter.toFixed(2)} ms`,     'color:#94a3b8', 'color:#fbbf24;font-weight:600')
        console.log(`%cFrame Budget (%)          %c${frameBudget.toFixed(1)} %`, 'color:#94a3b8', 'color:#f43f5e;font-weight:600')
        console.groupEnd()
      }
    })

    engine.runRenderLoop(() => scene.render())

    const onResize = () => engine.resize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // ─── 2. Rebuild al cambiar count ─────────────────────────────────────────
  useEffect(() => {
    if (!_scene) return
    buildScene(_scene, count)
  }, [count])

  return (
    <main className="relative w-full h-screen bg-[#050505] overflow-hidden">
      <PerformanceOverlay
        title={`Post-Procesado: ${count} Emisores`}
        input={true}
        count={count}
        setCount={setCount}
        inputConfig={{ unit: 'normal', type: 'values', values: [32, 128, 512] }}
      />
      <canvas ref={canvasRef} className="w-full h-full outline-none block" />
    </main>
  )
}