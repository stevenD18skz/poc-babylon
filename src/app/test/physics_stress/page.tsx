'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import * as BABYLON from '@babylonjs/core'
import HavokPhysics from '@babylonjs/havok'
import PerformanceOverlay from '@/components/test/PerformanceOverlay'
import DebugTools from '@/components/DebugTools'
import Loader3D from '@/components/ui/Loader3D'

// ─── PARÁMETROS DEL TEST ─────────────────────────────────────────────────────
const SPAWN_HEIGHT = 22
const KILL_Y = -5
const BODY_SIZE = 0.6

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
      frameTime: mean
    }
  },
}

// ─── HUD INTEGRADO CON TODAS LAS MÉTRICAS SOLICITADAS ────────────────────────
function PhysicsStressHUD({ 
  metrics, count, activeBodies, simStepMs 
}: { 
  metrics: any; count: number; activeBodies: number; simStepMs: number 
}) {
  const simColor = simStepMs < 2 ? 'text-emerald-400' : simStepMs < 6 ? 'text-yellow-400' : 'text-red-400'
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
      
      {/* Sección Específica de Física (Havok) */}
      <div className="grid grid-cols-2 gap-2 mb-1">
        <div className="bg-black/80 backdrop-blur border border-orange-500/40 px-3 py-2 rounded-xl">
          <p className="text-gray-400 text-[10px] uppercase tracking-widest mb-1">Sim Step (WASM)</p>
          <p className={`text-xl font-mono font-black ${simColor}`}>
            {simStepMs.toFixed(2)}<span className="text-xs text-gray-500 ml-1">ms</span>
          </p>
          <p className="text-gray-600 text-[9px] mt-1">Havok Physics Time</p>
        </div>
        <div className="bg-black/80 backdrop-blur border border-blue-500/40 px-3 py-2 rounded-xl">
          <p className="text-gray-400 text-[10px] uppercase tracking-widest mb-1">Cuerpos Activos</p>
          <p className="text-xl font-mono font-black text-blue-400">
            {activeBodies}<span className="text-xs text-gray-500 ml-1">/ {count}</span>
          </p>
          <p className="text-gray-600 text-[9px] mt-1">Colisiones dinámicas</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-1">
        <div className="bg-black/80 backdrop-blur border border-yellow-500/40 px-3 py-2 rounded-xl">
          <p className="text-gray-400 text-[10px] uppercase tracking-widest mb-1">Jitter</p>
          <p className={`text-xl font-mono font-black ${jitterColor}`}>
            {metrics.jitter?.toFixed(2)}<span className="text-xs text-gray-500 ml-1">ms</span>
          </p>
        </div>
        <div className="bg-black/80 backdrop-blur border border-purple-500/40 px-3 py-2 rounded-xl">
          <p className="text-gray-400 text-[10px] uppercase tracking-widest mb-1">Frame Budget</p>
          <p className={`text-xl font-mono font-black ${budgetColor}`}>
            {metrics.frameBudget?.toFixed(1)}<span className="text-xs text-gray-500 ml-1">%</span>
          </p>
        </div>
      </div>

      {/* Métricas Generales del Motor */}
      <div className="grid grid-cols-3 gap-2">
        <MetricCard label="FPS" value={metrics.fps} unit="fps" color="green" />
        <MetricCard label="CPU" value={metrics.cpuTime} unit="ms" color="blue" />
        <MetricCard label="GPU" value={metrics.gpuTime} unit="ms" color="pink" />
        <MetricCard label="Draw Calls" value={metrics.drawCalls} unit="" color="yellow" />
        <MetricCard label="Triángulos" value={metrics.triangles?.toLocaleString()} unit="" color="purple" />
        <MetricCard label="RAM" value={metrics.ram} unit="MB" color="cyan" />
      </div>

    </div>
  )
}

// ─── COMPONENTE PRINCIPAL BABYLON ────────────────────────────────────────────
export default function PhysicsStressBabylonTest() {
  const [count, setCount] = useState(1024)
  const [isLoading, setIsLoading] = useState(true)
  
  const [metrics, setMetrics] = useState<any>({ fps: 0, cpuTime: 0, gpuTime: 0, drawCalls: 0, triangles: 0, ram: 0, jitter: 0, frameBudget: 0 })
  const [simStepMs, setSimStepMs] = useState(0)
  const [activeBodies, setActiveBodies] = useState(0)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  
  // Referencias para limpieza
  const engineRef = useRef<BABYLON.Engine | null>(null)
  const sceneRef = useRef<BABYLON.Scene | null>(null)
  const physicsBodiesRef = useRef<BABYLON.PhysicsBody[]>([])

  useEffect(() => {
    if (!canvasRef.current) return

    let isMounted = true;
    const engine = new BABYLON.Engine(canvasRef.current, true, { preserveDrawingBuffer: true, stencil: true })
    engineRef.current = engine

    // 1. Inicialización Asíncrona (Requerido para cargar WASM de Havok)
    const initEngine = async () => {
      const scene = new BABYLON.Scene(engine)
      scene.clearColor = new BABYLON.Color4(0.02, 0.02, 0.02, 1)
      sceneRef.current = scene

      // Inicializar Havok Physics
      const havokInstance = await HavokPhysics()
      const physicsPlugin = new BABYLON.HavokPlugin(true, havokInstance)
      scene.enablePhysics(new BABYLON.Vector3(0, -9.81, 0), physicsPlugin)

      // Instrumentación General
      const sceneInst = new BABYLON.SceneInstrumentation(scene)
      const engineInst = new BABYLON.EngineInstrumentation(engine)
      sceneInst.captureFrameTime = true
      sceneInst.captureDrawCalls = true
      engineInst.captureGPUFrameTime = true

      // Instrumentación de Física (Midendo Havok WASM execution time)
      let physicsStartTime = 0
      let smoothedSimStep = 0
      scene.onBeforePhysicsObservable.add(() => { physicsStartTime = performance.now() })
      scene.onAfterPhysicsObservable.add(() => { 
        const stepTime = performance.now() - physicsStartTime
        // Suavizado para UI estable
        smoothedSimStep = smoothedSimStep * 0.85 + stepTime * 0.15
      })

      // Cámara
      const camera = new BABYLON.ArcRotateCamera("camera", -Math.PI / 2, Math.PI / 3, 40, new BABYLON.Vector3(0, 4, 0), scene)
      camera.setPosition(new BABYLON.Vector3(18, 18, 18))
      camera.fov = 50 * (Math.PI / 180)
      camera.attachControl(canvasRef.current, true)

      // Luces
      new BABYLON.HemisphericLight("ambient", new BABYLON.Vector3(0, 1, 0), scene).intensity = 0.5
      const dirLight = new BABYLON.DirectionalLight("dirLight", new BABYLON.Vector3(-0.5, -1, -0.5), scene)
      dirLight.position = new BABYLON.Vector3(15, 25, 10)
      dirLight.intensity = 1.2

      const pLight1 = new BABYLON.PointLight("pLight1", new BABYLON.Vector3(0, 15, 0), scene)
      pLight1.diffuse = BABYLON.Color3.FromHexString("#6366f1")
      pLight1.intensity = 30
      
      const pLight2 = new BABYLON.PointLight("pLight2", new BABYLON.Vector3(-8, 5, -8), scene)
      pLight2.diffuse = BABYLON.Color3.FromHexString("#f43f5e")
      pLight2.intensity = 15

      // ─── CONSTRUCCIÓN DEL BOWL CÓNCAVO ──────────────────────────────────────
      const RADIUS = 12
      const HEIGHT = 6
      const THICKNESS = 0.4
      const bowlMat = new BABYLON.StandardMaterial("bowlMat", scene)
      bowlMat.diffuseColor = BABYLON.Color3.FromHexString("#334155")
      bowlMat.roughness = 0.7

      const baseMat = new BABYLON.StandardMaterial("baseMat", scene)
      baseMat.diffuseColor = BABYLON.Color3.FromHexString("#1e293b")

      const rampMat = new BABYLON.StandardMaterial("rampMat", scene)
      rampMat.diffuseColor = BABYLON.Color3.FromHexString("#4f46e5")

      // Base
      const floor = BABYLON.MeshBuilder.CreateCylinder("floor", { diameter: RADIUS * 1.2, height: THICKNESS, tessellation: 32 }, scene)
      floor.material = baseMat
      new BABYLON.PhysicsBody(floor, BABYLON.PhysicsMotionType.STATIC, false, scene)
      const floorShape = new BABYLON.PhysicsShapeCylinder(BABYLON.Vector3.Zero(), new BABYLON.Vector3(0, 1, 0), RADIUS * 0.6, scene)
      floor.physicsBody!.shape = floorShape

      // Paredes
      const wallShape = new BABYLON.PhysicsShapeBox(BABYLON.Vector3.Zero(), new BABYLON.Quaternion(), new BABYLON.Vector3(THICKNESS, HEIGHT, RADIUS * 0.85), scene)
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2
        const tilt = 0.4
        
        const wall = BABYLON.MeshBuilder.CreateBox(`wall${i}`, { width: THICKNESS, height: HEIGHT, depth: RADIUS * 0.85 }, scene)
        wall.material = bowlMat
        
        // Posicionar y rotar la pared
        const dummyNode = new BABYLON.TransformNode(`dummy${i}`, scene)
        dummyNode.rotation.y = angle
        
        wall.parent = dummyNode
        wall.position.set(RADIUS * 0.8, HEIGHT / 2, 0)
        wall.rotation.z = -tilt
        wall.setParent(null) // Aplicar transformaciones al mundo local
        dummyNode.dispose()

        const body = new BABYLON.PhysicsBody(wall, BABYLON.PhysicsMotionType.STATIC, false, scene)
        body.shape = wallShape
      }

      // Rampa Central
      const ramp = BABYLON.MeshBuilder.CreateBox("ramp", { width: 5, height: 0.3, depth: 5 }, scene)
      ramp.material = rampMat
      ramp.position.set(0, 2, 0)
      ramp.rotation.set(0.3, 0.4, 0.2)
      
      const rampBody = new BABYLON.PhysicsBody(ramp, BABYLON.PhysicsMotionType.STATIC, false, scene)
      const rampShape = new BABYLON.PhysicsShapeBox(BABYLON.Vector3.Zero(), new BABYLON.Quaternion(), new BABYLON.Vector3(5, 0.3, 5), scene)
      rampBody.shape = rampShape

      // Compartir Shapes de los cuerpos físicos ahorra memoria inmensamente
      const sharedSphereShape = new BABYLON.PhysicsShapeSphere(BABYLON.Vector3.Zero(), BODY_SIZE * 0.5, scene)
      const sharedBoxShape = new BABYLON.PhysicsShapeBox(BABYLON.Vector3.Zero(), new BABYLON.Quaternion(), new BABYLON.Vector3(BODY_SIZE, BODY_SIZE, BODY_SIZE), scene)
      
      const baseSphere = BABYLON.MeshBuilder.CreateSphere("bs", { segments: 12, diameter: BODY_SIZE }, scene)
      const baseBox = BABYLON.MeshBuilder.CreateBox("bx", { size: BODY_SIZE }, scene)
      baseSphere.isVisible = false; baseBox.isVisible = false;

      // ─── GENERACIÓN Y BUCLE DE SIMULACIÓN ──────────────────────────────────
      const initBodies = (targetCount: number) => {
        // Limpiar anteriores
        physicsBodiesRef.current.forEach(b => {
          b.transformNode.dispose()
          b.dispose()
        })
        physicsBodiesRef.current = []

        for (let i = 0; i < targetCount; i++) {
          const isSphere = i % 2 === 0
          const mesh = isSphere ? baseSphere.clone(`s${i}`) : baseBox.clone(`b${i}`)
          mesh.isVisible = true

          const mat = new BABYLON.StandardMaterial(`m${i}`, scene)
          const hue = (i / targetCount) * 240 + 20
          mat.diffuseColor = BABYLON.Color3.FromHSV(hue, 0.8, 0.55)
          mat.roughness = 0.4
          mesh.material = mat

          mesh.position.set(
            (Math.random() - 0.5) * 8,
            SPAWN_HEIGHT + i * 0.25,
            (Math.random() - 0.5) * 8
          )

          const body = new BABYLON.PhysicsBody(mesh, BABYLON.PhysicsMotionType.DYNAMIC, false, scene)
          body.shape = isSphere ? sharedSphereShape : sharedBoxShape
          body.setMassProperties({ mass: 1 })
          
          // Equivalentes a restitución, fricción y damping de Rapier
          // En Havok V2 se usan PhysicsMaterials aplicados al shape o la escena
          body.setLinearDamping(0.05)
          body.setAngularDamping(0.05)

          physicsBodiesRef.current.push(body)
        }
      }

      initBodies(count)
      if (isMounted) setIsLoading(false)

      let frameCount = 0
      let lastTime = performance.now()

      scene.onBeforeRenderObservable.add(() => {
        const now = performance.now()
        const delta = (now - lastTime) / 1000
        lastTime = now

        metricsCalculator.push(delta)
        frameCount++

        // ─── RESPONDER MANAGER (Ejecutado cada frame) ───
        let awakeCount = 0
        physicsBodiesRef.current.forEach((body) => {
          if (!body.transformNode) return
          
          // Aunque no hay body.isSleeping() expuesto directamente sin hack, 
          // Havok detecta velocidad. Podemos aproximar si está en reposo.
          const vel = body.getLinearVelocity()
          if (vel.lengthSquared() > 0.01) awakeCount++

          const pos = body.transformNode.position
          if (pos.y < KILL_Y) {
            // Respawn
            body.disablePreStep = false // Necesario para sincronizar el nodo de vuelta al motor físico
            pos.set(
              (Math.random() - 0.5) * 8,
              SPAWN_HEIGHT,
              (Math.random() - 0.5) * 8
            )
            
            body.setLinearVelocity(new BABYLON.Vector3(
              (Math.random() - 0.5) * 3, 0, (Math.random() - 0.5) * 3
            ))
            body.setAngularVelocity(new BABYLON.Vector3(
              (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8
            ))
          }
        })

        // Actualizar UI
        if (frameCount % 10 === 0) {
          const m = metricsCalculator.compute()
          setSimStepMs(smoothedSimStep)
          setActiveBodies(awakeCount)

          const memoryInfo = (performance as any).memory
          const ramMB = memoryInfo ? Math.round(memoryInfo.usedJSHeapSize / 1048576) : 0
          const gpuTimeMs = engineInst.gpuFrameTimeCounter?.current ? (engineInst.gpuFrameTimeCounter.current * 0.000001).toFixed(2) : "N/A"

          setMetrics({
            fps: Math.round(engine.getFps()),
            cpuTime: sceneInst.frameTimeCounter.current.toFixed(2),
            gpuTime: gpuTimeMs,
            drawCalls: sceneInst.drawCallsCounter.current,
            triangles: scene.getActiveIndices() / 3,
            ram: ramMB,
            jitter: m.jitter,
            frameBudget: m.frameBudget
          })
        }
      })

      engine.runRenderLoop(() => { scene.render() })
    }

    initEngine()

    const handleResize = () => { if (engineRef.current) engineRef.current.resize() }
    window.addEventListener('resize', handleResize)

    return () => {
      isMounted = false
      window.removeEventListener('resize', handleResize)
      if (engineRef.current) engineRef.current.dispose()
    }
  }, [count]) // El array de dependencias reconstruye la escena si cambia count

  return (
    <main className="relative w-full h-screen bg-[#050505] overflow-hidden">
      
      <PerformanceOverlay
        title={`Havok Física: ${count} Cuerpos`}
        input={true}
        count={count}
        setCount={setCount}
        inputConfig={{ unit: 'normal', type: 'values', values: [16, 64, 128, 512, 1024, 2048] }}
      />

      <PhysicsStressHUD 
        metrics={metrics} 
        count={count} 
        activeBodies={activeBodies} 
        simStepMs={simStepMs} 
      />

      <div className="absolute inset-0 pointer-events-none z-10">
        <DebugTools title="Estrés de Física (Havok WASM)" entityCount={count} />
        {isLoading && <Loader3D />}
      </div>

      <canvas 
        ref={canvasRef} 
        className="w-full h-full outline-none block" 
      />
    </main>
  )
}