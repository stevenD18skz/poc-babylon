'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
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
  // Para 1% Low y Max Frame Time
  allFrameTimes: [] as number[],
  push(delta: number) {
    const ms = delta * 1000
    this.samples[this.index] = ms
    this.index = (this.index + 1) % JITTER_SAMPLE_SIZE
    this.filled = Math.min(this.filled + 1, JITTER_SAMPLE_SIZE)
    this.allFrameTimes.push(ms)
    // Mantener solo últimos 600 frames (~10s a 60fps) para no inflar memoria
    if (this.allFrameTimes.length > 600) this.allFrameTimes.shift()
  },
  compute() {
    if (this.filled < 2) return { jitter: 0, frameTime: 0, onePercentLow: 0, maxFrameTime: 0 }
    let sum = 0
    for (let i = 0; i < this.filled; i++) sum += this.samples[i]
    const mean = sum / this.filled
    let variance = 0
    for (let i = 0; i < this.filled; i++) {
      const diff = this.samples[i] - mean
      variance += diff * diff
    }

    // 1% Low FPS: tomar el peor 1% de frame times → convertir a FPS
    const sorted = [...this.allFrameTimes].sort((a, b) => b - a)
    const onePercentIdx = Math.max(0, Math.floor(sorted.length * 0.01))
    const worstFrameTime = sorted[onePercentIdx] || mean
    const onePercentLow = worstFrameTime > 0 ? Math.round(1000 / worstFrameTime) : 0

    // Max frame time
    const maxFrameTime = sorted[0] || 0

    return {
      jitter: Math.round(Math.sqrt(variance / this.filled) * 100) / 100,
      frameTime: Math.round(mean * 100) / 100,
      onePercentLow,
      maxFrameTime: Math.round(maxFrameTime * 100) / 100,
    }
  },
}

// ─── HUD CON TODAS LAS MÉTRICAS SOLICITADAS ──────────────────────────────────
function ExtendedGameHUD({ 
  score, missed, count, intersectionTime, metrics 
}: { 
  score: number; missed: number; count: number; intersectionTime: number; metrics: any 
}) {
  const accuracy = score + missed > 0 ? Math.round((score / (score + missed)) * 100) : 100
  const jitterColor = metrics.jitter < 1 ? 'text-emerald-400' : metrics.jitter < 3 ? 'text-yellow-400' : 'text-red-400'
  const timeColor = intersectionTime < 0.1 ? 'text-emerald-400' : intersectionTime < 0.5 ? 'text-yellow-400' : 'text-red-400'

  const MetricCard = ({ label, value, unit, color }: any) => (
    <div className="bg-black/80 backdrop-blur-xl border border-slate-500/30 px-3 py-2 rounded-xl flex flex-col justify-between">
      <p className="text-gray-400 text-[10px] uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-lg font-mono font-black ${color}`}>
        {value} <span className="text-[9px] text-gray-500 ml-0.5">{unit}</span>
      </p>
    </div>
  )

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 min-w-[280px]">
      {/* Sección del Juego */}
      <div className="grid grid-cols-3 gap-2 mb-2">
        <div className="bg-black/80 backdrop-blur-xl border border-emerald-500/40 px-3 py-2 rounded-xl">
          <p className="text-gray-400 text-xs uppercase tracking-widest mb-1">Score</p>
          <p className="text-2xl font-mono font-black text-emerald-400">{score}</p>
        </div>
        <div className="bg-black/80 backdrop-blur-xl border border-blue-500/40 px-3 py-2 rounded-xl">
          <p className="text-gray-400 text-xs uppercase tracking-widest mb-1">Precisión</p>
          <p className="text-2xl font-mono font-black text-blue-400">{accuracy}%</p>
        </div>
        <div className="bg-black/80 backdrop-blur-xl border border-purple-500/40 px-3 py-2 rounded-xl">
          <p className="text-gray-400 text-xs uppercase tracking-widest mb-1">Targets</p>
          <p className="text-2xl font-mono font-black text-purple-400">{count}</p>
        </div>
      </div>

      {/* Métrica Principal: Raycast */}
      <div className="bg-black/80 backdrop-blur-xl border border-red-500/40 px-4 py-3 rounded-xl mb-2">
        <div className="flex justify-between items-center">
          <p className="text-gray-400 text-xs uppercase tracking-widest">Intersección (Raycast)</p>
          <p className="text-gray-600 text-[10px]">por frame</p>
        </div>
        <p className={`text-3xl font-mono font-black ${timeColor}`}>
          {intersectionTime.toFixed(3)}<span className="text-sm text-gray-500 ml-1">ms</span>
        </p>
      </div>

      {/* Sección de Métricas Extendidas del Motor */}
      <div className="grid grid-cols-2 gap-2">
        <MetricCard label="FPS" value={metrics.fps} unit="fps" color="text-green-400" />
        <MetricCard label="1% Low" value={metrics.onePercentLow} unit="fps" color="text-orange-400" />
        <MetricCard label="Frame Time" value={metrics.frameTime?.toFixed(2) || "0.00"} unit="ms" color="text-slate-200" />
        <MetricCard label="Max Frame" value={metrics.maxFrameTime?.toFixed(2) || "0.00"} unit="ms" color="text-red-400" />
        <MetricCard label="CPU (Script)" value={metrics.cpuTime} unit="ms" color="text-blue-400" />
        <MetricCard label="GPU (Render)" value={metrics.gpuTime} unit="ms" color="text-pink-400" />
        <MetricCard label="Draw Calls" value={metrics.drawCalls} unit="" color="text-yellow-400" />
        <MetricCard label="Triángulos" value={metrics.triangles?.toLocaleString() || "0"} unit="" color="text-purple-400" />
        <MetricCard label="Jitter" value={metrics.jitter?.toFixed(2) || "0.00"} unit="ms" color={jitterColor} />
        <MetricCard label="RAM" value={metrics.ram} unit="MB" color="text-cyan-400" />
      </div>
    </div>
  )
}

function Crosshair() {
  return (
    <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-40">
      <div className="relative w-8 h-8">
        <div className="absolute top-1/2 left-0 right-0 h-px bg-white/60 -translate-y-1/2" />
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/60 -translate-x-1/2" />
        <div className="absolute top-1/2 left-1/2 w-1.5 h-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/80" />
      </div>
    </div>
  )
}

// ─── PARÁMETROS DEL TEST ─────────────────────────────────────────────────────
const SPHERE_SEGMENTS = 16
const ARENA_SIZE = 20

// ─── COMPONENTE PRINCIPAL BABYLON ────────────────────────────────────────────
export default function RaycastBabylonTest() {
  const [count, setCount] = useState(5000)
  const [score, setScore] = useState(0)
  const [missed, setMissed] = useState(0)
  const [intersectionTime, setIntersectionTime] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [metrics, setMetrics] = useState<any>({
    jitter: 0, frameTime: 0, fps: 0, cpuTime: 0, gpuTime: 0,
    drawCalls: 0, triangles: 0, ram: 0, onePercentLow: 0, maxFrameTime: 0,
  })

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const targetsRef = useRef<any[]>([])
  const nextId = useRef(0)
  const smoothedIntersectTime = useRef(0)

  const scoreRef = useRef(0)
  const missedRef = useRef(0)

  useEffect(() => {
    scoreRef.current = score
    missedRef.current = missed
  }, [score, missed])

  const spawnTargetData = useCallback((scene: BABYLON.Scene, id: number, sharedGeometry: BABYLON.Mesh) => {
    const theta = Math.random() * Math.PI * 2
    const phi = Math.random() * Math.PI
    const r = 5 + Math.random() * (ARENA_SIZE - 5)

    const x = r * Math.sin(phi) * Math.cos(theta)
    const y = Math.random() * 12 + 1
    const z = r * Math.sin(phi) * Math.sin(theta)

    const vx = (Math.random() - 0.5) * 4
    const vy = (Math.random() - 0.5) * 2
    const vz = (Math.random() - 0.5) * 4

    const baseScale = 0.4 + Math.random() * 0.6

    const mat = new BABYLON.StandardMaterial(`mat-${id}`, scene)
    const hue = Math.random() * 360
    const color = BABYLON.Color3.FromHSV(hue, 0.9, 0.9)
    mat.diffuseColor = color
    mat.emissiveColor = color
    mat.roughness = 0.3

    const mesh = sharedGeometry.clone(`target-${id}`)
    mesh.isVisible = true  // baseSphere tiene isVisible=false; clone lo hereda → forzar visible
    mesh.position.set(x, y, z)
    mesh.scaling.set(baseScale, baseScale, baseScale)
    mesh.material = mat
    mesh.isPickable = true

    return {
      id,
      mesh,
      mat,
      vel: new BABYLON.Vector3(vx, vy, vz),
      baseScale,
      isHovered: false,
    }
  }, [])

  useEffect(() => {
    if (!canvasRef.current) return

    const engine = new BABYLON.Engine(canvasRef.current, true, {
      preserveDrawingBuffer: true,
      stencil: true,
    })
    const scene = new BABYLON.Scene(engine)
    scene.clearColor = new BABYLON.Color4(0.02, 0.02, 0.02, 1)

    const sceneInstrumentation = new BABYLON.SceneInstrumentation(scene)
    const engineInstrumentation = new BABYLON.EngineInstrumentation(engine)
    sceneInstrumentation.captureFrameTime = true
    sceneInstrumentation.captureDrawCalls = true
    engineInstrumentation.captureGPUFrameTime = true

    // ─── CÁMARA FIJA ────────────────────────────────────────────────────────
    // Las esferas flotan entre y=1 y y=13, centro de masa ~y=7
    // Posición: un poco elevada y alejada para ver toda la arena
    const camera = new BABYLON.UniversalCamera(
      'fixedCam',
      new BABYLON.Vector3(0, 18, 38),
      scene,
    )
    // Apuntar al centro de la zona donde flotan las esferas
    camera.setTarget(new BABYLON.Vector3(0, 6, 0))
    camera.fov = 70 * (Math.PI / 180)
    // Sin attachControl: la cámara no responde a ningún input del usuario
    // (no llamar camera.attachControl bajo ninguna circunstancia)

    new BABYLON.HemisphericLight('ambient', new BABYLON.Vector3(0, 1, 0), scene).intensity = 0.4
    const pLight = new BABYLON.PointLight('point', new BABYLON.Vector3(10, 10, 10), scene)
    pLight.intensity = 1.5

    const ground = BABYLON.MeshBuilder.CreateDisc('ground', { radius: ARENA_SIZE, tessellation: 64 }, scene)
    ground.rotation.x = Math.PI / 2
    ground.isPickable = false
    const groundMat = new BABYLON.StandardMaterial('gMat', scene)
    groundMat.diffuseColor = BABYLON.Color3.FromHexString('#0d0d1a')
    groundMat.roughness = 0.8
    ground.material = groundMat

    const ring = BABYLON.MeshBuilder.CreateTorus(
      'ring',
      { diameter: ARENA_SIZE * 2 - 0.3, thickness: 0.15, tessellation: 64 },
      scene,
    )
    ring.position.y = 0.01
    ring.isPickable = false
    const ringMat = new BABYLON.StandardMaterial('rMat', scene)
    ringMat.emissiveColor = BABYLON.Color3.FromHexString('#6366f1')
    ringMat.alpha = 0.5
    ring.material = ringMat

    const baseSphere = BABYLON.MeshBuilder.CreateSphere(
      'base',
      { segments: SPHERE_SEGMENTS, diameter: 2 },
      scene,
    )
    baseSphere.isVisible = false

    for (let i = 0; i < count; i++) {
      targetsRef.current.push(spawnTargetData(scene, nextId.current++, baseSphere))
    }

    setScore(0)
    setMissed(0)

    let frameCount = 0
    let lastTime = performance.now()
    let hoveredMesh: BABYLON.AbstractMesh | null = null

    // ─── VARIABLES PARA CONSOLE LOG ─────────────────────────────────────────
    let lastLogTime = performance.now()

    scene.onBeforeRenderObservable.add(() => {
      const now = performance.now()
      const delta = (now - lastTime) / 1000
      lastTime = now

      metricsCalculator.push(delta)
      frameCount++

      if (frameCount === 1) setIsLoading(false)

      // 1. Raycasting al centro de la pantalla (crosshair)
      const ray = scene.createPickingRay(
        engine.getRenderWidth() / 2,
        engine.getRenderHeight() / 2,
        BABYLON.Matrix.Identity(),
        camera,
      )

      const startRaycast = performance.now()
      const pickResult = scene.pickWithRay(ray, (mesh) => mesh.name.startsWith('target'), false)
      const raycastElapsed = performance.now() - startRaycast

      smoothedIntersectTime.current = smoothedIntersectTime.current * 0.85 + raycastElapsed * 0.15

      hoveredMesh = pickResult?.hit ? pickResult.pickedMesh : null

      // 2. Movimiento y hover visual
      targetsRef.current.forEach((t) => {
        t.mesh.position.addInPlace(t.vel.scale(delta))

        if (Math.abs(t.mesh.position.x) > ARENA_SIZE) t.vel.x *= -1
        if (t.mesh.position.y < 0.5 || t.mesh.position.y > 15) t.vel.y *= -1
        if (Math.abs(t.mesh.position.z) > ARENA_SIZE) t.vel.z *= -1

        t.isHovered = t.mesh === hoveredMesh
        const targetScale = t.isHovered ? t.baseScale * 1.3 : t.baseScale

        // FIX: usar set() en lugar del inexistente setScalar()
        t.mesh.scaling.set(
          BABYLON.Scalar.Lerp(t.mesh.scaling.x, targetScale, 0.2),
          BABYLON.Scalar.Lerp(t.mesh.scaling.y, targetScale, 0.2),
          BABYLON.Scalar.Lerp(t.mesh.scaling.z, targetScale, 0.2),
        )

        const emIntensity = t.isHovered ? 0.8 : 0.1
        t.mat.emissiveColor = t.mat.diffuseColor.scale(emIntensity)
      })

      // 3. Métricas UI (cada 10 frames)
      if (frameCount % 10 === 0) {
        setIntersectionTime(smoothedIntersectTime.current)

        const memoryInfo = (performance as any).memory
        const ramMB = memoryInfo ? Math.round(memoryInfo.usedJSHeapSize / 1048576) : 0
        const gpuTimeMs =
          engineInstrumentation.gpuFrameTimeCounter?.current
            ? (engineInstrumentation.gpuFrameTimeCounter.current * 0.000001).toFixed(2)
            : 'N/A'

        const computed = metricsCalculator.compute()

        setMetrics({
          ...computed,
          fps: Math.round(engine.getFps()),
          cpuTime: sceneInstrumentation.frameTimeCounter.current.toFixed(2),
          gpuTime: gpuTimeMs,
          drawCalls: sceneInstrumentation.drawCallsCounter.current,
          triangles: scene.getActiveIndices() / 3,
          ram: ramMB,
        })
      }

      // 4. Console log cada 5 segundos
      if (now - lastLogTime >= 5000) {
        lastLogTime = now

        const fps = engine.getFps()
        const computed = metricsCalculator.compute()
        const { frameTime, jitter, onePercentLow, maxFrameTime } = computed

        const gpuMs =
          engineInstrumentation.gpuFrameTimeCounter?.current
            ? engineInstrumentation.gpuFrameTimeCounter.current * 0.000001
            : 0
        const cpuMs = Math.max(0, frameTime - gpuMs)

        const memoryInfo = (performance as any).memory
        const ramMBLog = memoryInfo ? (memoryInfo.usedJSHeapSize / 1048576).toFixed(1) : 'N/A'

        console.group(
          `%c[Babylon Raycast Test] ${new Date().toLocaleTimeString()}`,
          'color:#6366f1;font-weight:700;font-size:12px',
        )
        console.log(`%cEntidades           %c${count}`,              'color:#94a3b8', 'color:#f1f5f9;font-weight:600')
        console.log(`%cMotor               %cBabylon.js`,            'color:#94a3b8', 'color:#f1f5f9;font-weight:600')
        console.log(`%cFPS                 %c${fps.toFixed(1)}`,     'color:#94a3b8', 'color:#f1f5f9;font-weight:600')
        console.log(`%c1%% Low (FPS)       %c${onePercentLow}`,      'color:#94a3b8', 'color:#f1f5f9;font-weight:600')
        console.log(`%cCPU (ms)            %c${cpuMs.toFixed(2)}`,   'color:#94a3b8', 'color:#f1f5f9;font-weight:600')
        console.log(`%cFrame Time (ms)     %c${frameTime.toFixed(2)}`,'color:#94a3b8', 'color:#f1f5f9;font-weight:600')
        console.log(`%cMax Frame Time (ms) %c${maxFrameTime.toFixed(2)}`,'color:#94a3b8','color:#f1f5f9;font-weight:600')
        console.log(`%cJitter (ms)         %c${jitter.toFixed(2)}`,  'color:#94a3b8', 'color:#f1f5f9;font-weight:600')
        console.log(
          `%cIntersection (ms)   %c${smoothedIntersectTime.current.toFixed(3)}`,
          'color:#94a3b8',
          'color:#f1f5f9;font-weight:600',
        )
        console.log(`%cRAM (MB)            %c${ramMBLog}`,           'color:#94a3b8', 'color:#f1f5f9;font-weight:600')
        console.groupEnd()
      }
    })

    // 5. Disparo (Click)
    const handlePointerDown = () => {
      if (hoveredMesh) {
        setScore((s) => s + 1)
        const targetIndex = targetsRef.current.findIndex((t) => t.mesh === hoveredMesh)
        if (targetIndex !== -1) {
          const oldT = targetsRef.current[targetIndex]
          oldT.mesh.dispose()
          oldT.mat.dispose()
          targetsRef.current[targetIndex] = spawnTargetData(scene, nextId.current++, baseSphere)
        }
      } else {
        setMissed((m) => m + 1)
      }
    }

    canvasRef.current.addEventListener('pointerdown', handlePointerDown)

    engine.runRenderLoop(() => {
      scene.render()
    })

    const handleResize = () => engine.resize()
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      if (canvasRef.current) canvasRef.current.removeEventListener('pointerdown', handlePointerDown)
      targetsRef.current.forEach((t) => {
        t.mesh.dispose()
        t.mat.dispose()
      })
      targetsRef.current = []
      engine.dispose()
    }
  }, [count, spawnTargetData])

  return (
    <main className="relative w-full h-screen bg-[#050505] overflow-hidden" style={{ cursor: 'crosshair' }}>
      <PerformanceOverlay
        title={`Raycasting Babylon: ${count} Targets`}
        input={true}
        count={count}
        setCount={setCount}
        inputConfig={{ unit: 'normal', type: 'values', values: [50, 200, 500, 1000, 5000] }}
      />

      <ExtendedGameHUD
        score={score}
        missed={missed}
        count={count}
        intersectionTime={intersectionTime}
        metrics={metrics}
      />

      <Crosshair />

      <div className="absolute inset-0 pointer-events-none z-10">
        {isLoading && <Loader3D />}
      </div>

      <canvas
        ref={canvasRef}
        className="w-full h-full outline-none block"
        style={{ touchAction: 'none' }}
      />
    </main>
  )
}