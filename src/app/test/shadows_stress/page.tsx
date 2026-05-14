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

// ─── HUD EXTENDIDO CON TODAS LAS MÉTRICAS SOLICITADAS ────────────────────────
function ExtendedMetricsHUD({ metrics, lightCount }: { metrics: any, lightCount: number }) {
  const jitterColor = metrics.jitter < 1 ? 'text-emerald-400' : metrics.jitter < 3 ? 'text-yellow-400' : 'text-red-400'
  
  // En Babylon, un PointLight shadow map es un CubeMap (6 texturas)
  const renderPasses = 1 + (lightCount * 6) 
  // VRAM de Sombras: Luces * 6 caras * 512 * 512 * 4 bytes / 1MB
  const vramShadowsMB = (lightCount * 6 * 512 * 512 * 4 / 1048576).toFixed(1)

  const MetricCard = ({ label, value, unit, color }: any) => (
    <div className="bg-black/80 backdrop-blur-xl border border-slate-500/30 px-3 py-2 rounded-xl flex flex-col justify-between">
      <p className="text-gray-400 text-[10px] uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-lg font-mono font-black ${color}`}>
        {value} <span className="text-[9px] text-gray-500 ml-0.5">{unit}</span>
      </p>
    </div>
  )

  return (
    <div className="fixed bottom-6 right-6 z-50 grid grid-cols-2 gap-2 min-w-[280px]">
      <MetricCard label="FPS" value={metrics.fps} unit="fps" color="text-green-400" />
      <MetricCard label="Frame Time" value={metrics.frameTime.toFixed(2)} unit="ms" color="text-slate-200" />
      <MetricCard label="CPU (Script)" value={metrics.cpuTime} unit="ms" color="text-blue-400" />
      <MetricCard label="GPU (Render)" value={metrics.gpuTime} unit="ms" color="text-pink-400" />
      <MetricCard label="Jitter" value={metrics.jitter.toFixed(2)} unit="ms" color={jitterColor} />
      <MetricCard label="Draw Calls" value={metrics.drawCalls} unit="" color="text-yellow-400" />
      <MetricCard label="Triángulos" value={metrics.triangles.toLocaleString()} unit="" color="text-purple-400" />
      <MetricCard label="RAM" value={metrics.ram} unit="MB" color="text-cyan-400" />
      <MetricCard label="VRAM (Sombras)" value={vramShadowsMB} unit="MB" color="text-orange-400" />
      
      <div className="col-span-2 bg-black/80 backdrop-blur-xl border border-purple-500/40 px-3 py-2 rounded-xl flex justify-between items-center">
        <p className="text-gray-400 text-xs uppercase tracking-wider">Render Passes</p>
        <p className="text-xl font-mono font-black text-purple-400">{renderPasses}<span className="text-xs text-gray-500 ml-1">x</span></p>
      </div>
    </div>
  )
}

// ─── PARÁMETROS DEL TEST ─────────────────────────────────────────────────────
const ARENA = { w: 32, h: 32, d: 32 }
const WALL_THICKNESS = 0.5

// ─── COMPONENTE PRINCIPAL BABYLON ────────────────────────────────────────────
export default function ShadowsStressBabylonTest() {
  const [count, setCount] = useState(64)
  const [lightCount, setLightCount] = useState(1)
  const [isStatic, setIsStatic] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [metrics, setMetrics] = useState({ 
    jitter: 0, frameTime: 0, fps: 0, cpuTime: 0, gpuTime: 0, drawCalls: 0, triangles: 0, ram: 0 
  })
  
  const canvasRef = useRef<HTMLCanvasElement>(null)
  
  const sceneRef = useRef<BABYLON.Scene | null>(null)
  const shadowCastersRef = useRef<BABYLON.Mesh[]>([])
  const activeLightsRef = useRef<any[]>([])

  // 1. Inicialización de Escena y Geometría Estática
  useEffect(() => {
    if (!canvasRef.current) return

    const engine = new BABYLON.Engine(canvasRef.current, true, { preserveDrawingBuffer: true, stencil: true })
    const scene = new BABYLON.Scene(engine)
    scene.clearColor = new BABYLON.Color4(0.02, 0.02, 0.02, 1)
    sceneRef.current = scene

    // Instrumentación para Métricas Avanzadas
    const sceneInstrumentation = new BABYLON.SceneInstrumentation(scene)
    const engineInstrumentation = new BABYLON.EngineInstrumentation(engine)
    sceneInstrumentation.captureFrameTime = true
    sceneInstrumentation.captureDrawCalls = true
    engineInstrumentation.captureGPUFrameTime = true // Depende de la extensión EXT_disjoint_timer_query_webgl2

    // Cámara equivalente a position [0, 60, 0] y fov 60
    const camera = new BABYLON.ArcRotateCamera("camera", -Math.PI / 2, 0.01, 60, BABYLON.Vector3.Zero(), scene)
    camera.fov = 60 * (Math.PI / 180)
    camera.attachControl(canvasRef.current, true)

    new BABYLON.HemisphericLight("ambient", new BABYLON.Vector3(0, 1, 0), scene).intensity = 0.3

    // Materiales PBR
    const wallMat = new BABYLON.PBRMaterial("wallMat", scene)
    wallMat.albedoColor = BABYLON.Color3.FromHexString("#444444")
    wallMat.roughness = 1
    wallMat.metallic = 0.1

    const boxMat = new BABYLON.PBRMaterial("boxMat", scene)
    boxMat.albedoColor = BABYLON.Color3.FromHexString("#94a3b8")
    boxMat.roughness = 0.5
    boxMat.metallic = 0.15

    // Función auxiliar para construir la arena
    const createWall = (name: string, width: number, height: number, depth: number, x: number, y: number, z: number) => {
      const mesh = BABYLON.MeshBuilder.CreateBox(name, { width, height, depth }, scene)
      mesh.position.set(x, y, z)
      mesh.receiveShadows = true
      mesh.material = wallMat
      shadowCastersRef.current.push(mesh)
    }

    createWall("floor", ARENA.w, WALL_THICKNESS, ARENA.d, 0, 0, 0)
    createWall("wallN", ARENA.w, ARENA.h, WALL_THICKNESS, 0, ARENA.h / 2, -ARENA.d / 2)
    createWall("wallS", ARENA.w, ARENA.h, WALL_THICKNESS, 0, ARENA.h / 2, ARENA.d / 2)
    createWall("wallW", WALL_THICKNESS, ARENA.h, ARENA.d, -ARENA.w / 2, ARENA.h / 2, 0)
    createWall("wallE", WALL_THICKNESS, ARENA.h, ARENA.d, ARENA.w / 2, ARENA.h / 2, 0)

    // Cajas Instanciadas Estáticas (Thin Instances)
    const baseBox = BABYLON.MeshBuilder.CreateBox("baseBox", { size: 0.4 }, scene)
    baseBox.material = boxMat
    baseBox.receiveShadows = true
    shadowCastersRef.current.push(baseBox)

    const matrixBuffer = new Float32Array(count * 16)
    const scale = new BABYLON.Vector3()
    const pos = new BABYLON.Vector3()
    const rotQuat = new BABYLON.Quaternion()
    const tempMat = new BABYLON.Matrix()

    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * (ARENA.w - 4)
      const y = Math.random() * (ARENA.h - 1) + 0.5
      const z = (Math.random() - 0.5) * (ARENA.d - 4)
      const rx = Math.random() * Math.PI
      const ry = Math.random() * Math.PI
      const s = 0.5 + Math.random() * 1.2

      pos.set(x, y, z)
      scale.setScalar(s)
      BABYLON.Quaternion.RotationYawPitchRollToRef(ry, rx, 0, rotQuat)
      BABYLON.Matrix.ComposeToRef(scale, rotQuat, pos, tempMat)
      tempMat.copyToArray(matrixBuffer, i * 16)
    }
    
    // Thin instances no se recalcularán en el loop (gran optimización para CPU)
    baseBox.thinInstanceSetBuffer("matrix", matrixBuffer, 16, true)

    // Loop de Renderizado y recolección de métricas
    let frameCount = 0
    let lastTime = performance.now()

    scene.onBeforeRenderObservable.add(() => {
      const now = performance.now()
      const delta = (now - lastTime) / 1000
      lastTime = now

      metricsCalculator.push(delta)
      frameCount++

      if (frameCount === 1) setIsLoading(false)

      // Actualizar Métricas cada 10 frames
      if (frameCount % 10 === 0) {
        const memoryInfo = (performance as any).memory
        const ramMB = memoryInfo ? Math.round(memoryInfo.usedJSHeapSize / 1048576) : 0
        
        // Babylon GPU time está en nanosegundos
        const gpuTimeMs = engineInstrumentation.gpuFrameTimeCounter?.current 
          ? (engineInstrumentation.gpuFrameTimeCounter.current * 0.000001).toFixed(2) 
          : "N/A"

        setMetrics({
          ...metricsCalculator.compute(),
          fps: Math.round(engine.getFps()),
          cpuTime: sceneInstrumentation.frameTimeCounter.current.toFixed(2),
          gpuTime: gpuTimeMs,
          drawCalls: sceneInstrumentation.drawCallsCounter.current,
          triangles: scene.getActiveIndices() / 3,
          ram: ramMB
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
      engine.dispose()
    }
  }, [count]) // Se recrea al cambiar count (geometría base)

  // 2. Lógica Dinámica de Luces
  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return

    // Limpiar luces previas
    activeLightsRef.current.forEach(data => {
      data.light.dispose()
      data.shadowGen.dispose()
      data.helper.dispose()
    })
    activeLightsRef.current = []

    const orbitRadius = ARENA.w * 0.28
    const lightY = ARENA.h * 0.55

    for (let i = 0; i < lightCount; i++) {
      const color = BABYLON.Color3.FromHexString("#f0f9ff") // hsl(195, 30%, 95%) aprox
      
      const light = new BABYLON.PointLight(`pl-${i}`, BABYLON.Vector3.Zero(), scene)
      light.diffuse = color
      light.intensity = 500 // Equivalente aproximado al 512 de Three.js con decadencia física
      
      const helper = BABYLON.MeshBuilder.CreateSphere(`hlp-${i}`, { diameter: 0.4 }, scene)
      const hMat = new BABYLON.StandardMaterial(`hmat-${i}`, scene)
      hMat.emissiveColor = color
      hMat.disableLighting = true
      helper.material = hMat

      // Generador de Sombras (En PointLight esto crea un CubeMap, MUY costoso)
      const shadowGen = new BABYLON.ShadowGenerator(512, light)
      shadowGen.bias = 0.0005
      
      shadowCastersRef.current.forEach(mesh => {
        shadowGen.addShadowCaster(mesh, true)
      })

      // Posición Inicial
      const staticX = -ARENA.w / 2 + (ARENA.w / lightCount) * (i + 0.5)
      
      activeLightsRef.current.push({
        light,
        helper,
        shadowGen,
        index: i,
        staticX,
        y: lightY,
        orbitRadius
      })
    }

    // Animador vinculado al ciclo de render de Babylon
    const animObserver = scene.onBeforeRenderObservable.add(() => {
      const t = performance.now() * 0.001

      activeLightsRef.current.forEach(data => {
        if (isStatic) {
          data.light.position.set(data.staticX, data.y, 0)
        } else {
          const baseAngle = (data.index / lightCount) * Math.PI * 2
          data.light.position.x = Math.cos(t + baseAngle) * data.orbitRadius
          data.light.position.z = Math.sin(t + baseAngle) * data.orbitRadius
          data.light.position.y = data.y
        }
        data.helper.position.copyFrom(data.light.position)
      })
    })

    return () => {
      scene.onBeforeRenderObservable.remove(animObserver)
    }
  }, [lightCount, isStatic])

  return (
    <main className="relative w-full h-screen bg-[#050505] overflow-hidden">
      <ExtendedMetricsHUD metrics={metrics} lightCount={lightCount} />
      
      <div className="absolute inset-0 pointer-events-none z-10">
        <DebugTools title="Estrés de Sombras Babylon (Arena)" entityCount={count} />
        {isLoading && <Loader3D />}
      </div>

      <canvas ref={canvasRef} className="w-full h-full outline-none block" />

      {/* Mantengo el PerformanceOverlay exacto de tu código R3F */}
      <PerformanceOverlay
        title={`Sombras: ${count} Objetos en Arena`}
        input={true}
        count={count}
        setCount={setCount}
        inputConfig={{
          unit: 'normal',
          type: 'values',
          values: [64, 256, 1024, 4096, 16384],
        }}
      >
        <div className="bg-white/5 px-6 py-3 border-t border-white/10 flex flex-col gap-4 rounded-3xl mt-4 relative z-50 pointer-events-auto">
          <div className="flex justify-between items-center mb-1">
            <label className="text-[12px] uppercase tracking-[0.15em] font-black text-white/50">Luces</label>
            <span className="text-[16px] font-mono text-yellow-400 font-bold bg-yellow-500/15 px-3 py-1 rounded-full border border-yellow-500/30 shadow-inner">
              {lightCount} <span className="text-[8px] opacity-70 ml-1">LIT</span>
            </span>
          </div>
          
          <div className="relative h-6 flex items-center">
            <input 
              type="range" 
              min="1" 
              max="2" 
              step="1" 
              className="w-full accent-yellow-500 cursor-pointer h-1 bg-white/10 rounded-full appearance-none hover:bg-white/20 transition-colors"
              value={lightCount}
              onChange={(e) => setLightCount(Number(e.target.value))}
            />
          </div>

          <div className="flex justify-between items-center mt-2 group cursor-pointer" onClick={() => setIsStatic(!isStatic)}>
            <label className="text-[12px] uppercase tracking-[0.15em] font-black text-white/50 cursor-pointer">Movimiento</label>
            <div className={`w-12 h-6 rounded-full p-1 transition-all duration-300 ${isStatic ? 'bg-white/10' : 'bg-green-500/40'}`}>
              <div className={`w-4 h-4 rounded-full bg-white transition-all duration-300 ${isStatic ? 'translate-x-0 opacity-40' : 'translate-x-6 shadow-[0_0_10px_white]'}`} />
            </div>
          </div>
        </div>
      </PerformanceOverlay>
    </main>
  )
}