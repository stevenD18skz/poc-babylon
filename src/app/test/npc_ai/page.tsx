'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import * as BABYLON from '@babylonjs/core'
import * as GUI from '@babylonjs/gui'
import PerformanceOverlay from '@/components/test/PerformanceOverlay'
import DebugTools from '@/components/DebugTools'
import Loader3D from '@/components/ui/Loader3D'

// ─── TIPOS Y COLA DE SOLICITUDES (Idéntico a R3F) ────────────────────────────
type NpcAction = 'idle' | 'walk' | 'jump'

interface NpcState {
  id: number
  action: NpcAction
  thinking: boolean
  error: boolean
  targetPosition: { x: number; z: number }
  requestCount: number
  lastLatency: number
}

interface ApiMetrics {
  totalRequests: number
  successRequests: number
  failedRequests: number
  avgLatency: number
  latencies: number[]
}

class RequestQueue {
  private queue: Array<() => Promise<void>> = []
  private running = 0
  private maxConcurrent: number
  constructor(maxConcurrent = 3) { this.maxConcurrent = maxConcurrent }
  async add(fn: () => Promise<void>) {
    return new Promise<void>((resolve, reject) => {
      this.queue.push(async () => { try { await fn(); resolve() } catch (e) { reject(e) } })
      this.process()
    })
  }
  private async process() {
    if (this.running >= this.maxConcurrent || this.queue.length === 0) return
    this.running++
    const task = this.queue.shift()!
    try { await task() } finally { this.running--; this.process() }
  }
}

const globalQueue = new RequestQueue(3)

// ─── MÉTRICAS CPU (Scripting / JS Overhead) ──────────────────────────────────
const scriptingBuffer = new Float32Array(60)
let scriptingIndex = 0
let scriptingFilled = 0

// ─── HUD INTEGRADO (Red + Motor 3D) ──────────────────────────────────────────
function CombinedMetricsHUD({ 
  netMetrics, engineMetrics, npcCount, scriptingMs 
}: { 
  netMetrics: ApiMetrics; engineMetrics: any; npcCount: number; scriptingMs: number 
}) {
  const successRate = netMetrics.totalRequests > 0
    ? Math.round((netMetrics.successRequests / netMetrics.totalRequests) * 100) : 100

  const scriptingColor = scriptingMs < 8 ? 'text-emerald-400' : scriptingMs < 14 ? 'text-yellow-400' : 'text-red-400'

  const MiniCard = ({ label, value, color, unit = '' }: any) => (
    <div className={`bg-black/80 backdrop-blur border border-${color}-500/40 px-3 py-2 rounded-xl`}>
      <p className="text-gray-400 text-[10px] uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-xl font-mono font-black text-${color}-400`}>
        {value}<span className="text-[10px] text-gray-500 ml-1">{unit}</span>
      </p>
    </div>
  )

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 min-w-[220px]">
      {/* Sección Red e IA */}
      <div className="grid grid-cols-2 gap-2">
        <MiniCard label="NPCs" value={npcCount} color="blue" />
        <MiniCard label="Requests" value={netMetrics.totalRequests} color="emerald" />
        <MiniCard label="Latencia Prom" value={netMetrics.avgLatency || '—'} color="yellow" unit="ms" />
        <MiniCard label="Tasa Éxito" value={successRate} color={successRate > 90 ? 'emerald' : 'red'} unit="%" />
      </div>

      {/* Scripting CPU Specífico */}
      <div className="bg-black/80 backdrop-blur border border-orange-500/40 px-4 py-2 rounded-xl">
        <div className="flex justify-between items-center">
          <p className="text-gray-400 text-[10px] uppercase tracking-widest">Scripting CPU (Loop)</p>
          <p className={`text-xl font-mono font-black ${scriptingColor}`}>
            {scriptingMs.toFixed(2)}<span className="text-xs text-gray-500 ml-1">ms</span>
          </p>
        </div>
      </div>

      {/* Sección Rendimiento Gráfico Motor */}
      <div className="grid grid-cols-3 gap-2 mt-1">
        <MiniCard label="FPS" value={engineMetrics.fps} color="green" />
        <MiniCard label="GPU" value={engineMetrics.gpuTime} color="pink" unit="ms" />
        <MiniCard label="CPU" value={engineMetrics.cpuTime} color="blue" unit="ms" />
        <MiniCard label="DrawCalls" value={engineMetrics.drawCalls} color="yellow" />
        <MiniCard label="Triángulos" value={engineMetrics.triangles?.toLocaleString()} color="purple" />
        <MiniCard label="RAM" value={engineMetrics.ram} color="cyan" unit="MB" />
      </div>
    </div>
  )
}

// ─── COMPONENTE PRINCIPAL BABYLON ────────────────────────────────────────────
export default function NpcAiBabylonTest() {
  const [npcCount, setNpcCount] = useState(512)
  const [npcStates, setNpcStates] = useState<NpcState[]>([])
  const [scriptingMs, setScriptingMs] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  
  const [netMetrics, setNetMetrics] = useState<ApiMetrics>({
    totalRequests: 0, successRequests: 0, failedRequests: 0, avgLatency: 0, latencies: [],
  })
  const [engineMetrics, setEngineMetrics] = useState<any>({ fps: 0, cpuTime: 0, gpuTime: 0, drawCalls: 0, triangles: 0, ram: 0 })

  const canvasRef = useRef<HTMLCanvasElement>(null)
  
  // Diccionario para acceso rápido a las mallas de Babylon sin re-renderizar React
  const npcEntitiesRef = useRef<Map<number, any>>(new Map())
  const sceneRef = useRef<BABYLON.Scene | null>(null)

  // 1. LÓGICA DE API Y ESTADOS (Idéntica a R3F para mantener la misma carga en Next.js)
  useEffect(() => {
    setNpcStates(Array.from({ length: npcCount }, (_, i): NpcState => ({
      id: i, action: 'idle', thinking: false, error: false,
      targetPosition: { x: 0, z: 0 }, requestCount: 0, lastLatency: 0,
    })))
  }, [npcCount])

  const recordRequest = useCallback((success: boolean, latency: number) => {
    setNetMetrics((prev) => {
      const newLatencies = [...prev.latencies.slice(-49), latency]
      const avgLatency = Math.round(newLatencies.reduce((a, b) => a + b, 0) / newLatencies.length)
      return {
        totalRequests: prev.totalRequests + 1,
        successRequests: prev.successRequests + (success ? 1 : 0),
        failedRequests: prev.failedRequests + (success ? 0 : 1),
        avgLatency, latencies: newLatencies,
      }
    })
  }, [])

  const updateNpc = useCallback((id: number, patch: Partial<NpcState>) => {
    setNpcStates((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)))
  }, [])

  const runNpcLoop = useCallback(async (id: number, signal: AbortSignal) => {
    await new Promise((r) => setTimeout(r, id * 500))
    while (!signal.aborted) {
      let currentAction: NpcAction = 'idle'
      let currentPos = { x: 0, z: 0 }
      
      setNpcStates(prev => {
        const npc = prev.find(s => s.id === id)
        if (npc) { currentAction = npc.action; currentPos = npc.targetPosition }
        return prev
      })
      
      updateNpc(id, { thinking: true, error: false })
      const t0 = performance.now()
      
      try {
        await globalQueue.add(async () => {
          if (signal.aborted) return
          const res = await fetch('/api/npc', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ currentAction, position: { x: currentPos.x, y: 0, z: currentPos.z } }),
            signal,
          })
          const latency = Math.round(performance.now() - t0)
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          const data = await res.json()
          if (signal.aborted) return
          recordRequest(true, latency)
          updateNpc(id, { 
            action: data.action as NpcAction, 
            thinking: false, error: false, 
            targetPosition: data.targetPosition ?? { x: 0, z: 0 }, 
            lastLatency: latency 
          })
        })
      } catch (err: any) {
        if (err.name === 'AbortError') return
        const lat = Math.round(performance.now() - t0)
        recordRequest(false, lat)
        updateNpc(id, { thinking: false, error: true, lastLatency: lat })
      }
      
      await new Promise((r) => {
        const timeout = setTimeout(r, 3000 + Math.random() * 2000)
        signal.addEventListener('abort', () => clearTimeout(timeout), { once: true })
      })
    }
  }, [updateNpc, recordRequest])

  // Iniciar ciclos IA
  useEffect(() => {
    if (npcStates.length === 0) return
    const ac = new AbortController()
    npcStates.forEach((s) => runNpcLoop(s.id, ac.signal))
    return () => ac.abort()
  }, [npcStates.length, runNpcLoop])


  // 2. INICIALIZACIÓN DEL MOTOR BABYLON 3D
  useEffect(() => {
    if (!canvasRef.current) return

    const engine = new BABYLON.Engine(canvasRef.current, true, { preserveDrawingBuffer: true, stencil: true })
    const scene = new BABYLON.Scene(engine)
    scene.clearColor = new BABYLON.Color4(0.02, 0.02, 0.02, 1)
    sceneRef.current = scene

    // Instrumentación
    const sceneInst = new BABYLON.SceneInstrumentation(scene)
    const engineInst = new BABYLON.EngineInstrumentation(engine)
    sceneInst.captureFrameTime = true
    sceneInst.captureDrawCalls = true
    engineInst.captureGPUFrameTime = true

    const camera = new BABYLON.ArcRotateCamera("camera", -Math.PI / 2, Math.PI / 3, 22.8, BABYLON.Vector3.Zero(), scene)
    camera.setPosition(new BABYLON.Vector3(0, 14, 18))
    camera.fov = 50 * (Math.PI / 180)
    camera.upperBetaLimit = Math.PI / 2 - 0.05
    camera.attachControl(canvasRef.current, true)

    new BABYLON.HemisphericLight("ambient", new BABYLON.Vector3(0, 1, 0), scene).intensity = 0.5
    const dirLight = new BABYLON.DirectionalLight("dir", new BABYLON.Vector3(-1, -2, -1), scene)
    dirLight.position = new BABYLON.Vector3(10, 15, 10)
    dirLight.intensity = 1.0

    // Entorno (Suelo oscuro similar a R3F)
    const ground = BABYLON.MeshBuilder.CreatePlane("ground", { size: 30 }, scene)
    ground.rotation.x = Math.PI / 2
    const groundMat = new BABYLON.StandardMaterial("gmat", scene)
    groundMat.diffuseColor = BABYLON.Color3.FromHexString("#020817")
    groundMat.specularColor = new BABYLON.Color3(0, 0, 0)
    ground.material = groundMat

    // UI para Textos (Reemplazo de <Text> de Drei)
    const advancedTexture = GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI")

    // Materiales pre-construidos para NPCs
    const matNormal = new BABYLON.StandardMaterial("mNormal", scene)
    matNormal.diffuseColor = BABYLON.Color3.FromHexString("#f97316") // orange
    const matThinking = new BABYLON.StandardMaterial("mThink", scene)
    matThinking.diffuseColor = BABYLON.Color3.FromHexString("#facc15") // yellow
    const matError = new BABYLON.StandardMaterial("mErr", scene)
    matError.diffuseColor = BABYLON.Color3.FromHexString("#ef4444") // red
    const matHorn = new BABYLON.StandardMaterial("mHorn", scene)
    matHorn.diffuseColor = BABYLON.Color3.FromHexString("#c2410c")

    // Jerarquía base del NPC (Invisible, servirá para clonar)
    const baseGroup = new BABYLON.TransformNode("baseGroup", scene)
    const baseBodyGroup = new BABYLON.TransformNode("baseBodyGroup", scene)
    baseBodyGroup.parent = baseGroup

    const head = BABYLON.MeshBuilder.CreateBox("head", { width: 0.8, height: 0.8, depth: 0.8 }, scene)
    head.position.set(0, 1.2, 0.4)
    head.parent = baseBodyGroup

    const hornL = BABYLON.MeshBuilder.CreateCylinder("hl", { diameterTop: 0, diameterBottom: 0.15, height: 0.4, tessellation: 4 }, scene)
    hornL.position.set(-0.25, 0.5, 0)
    hornL.material = matHorn
    hornL.parent = head

    const hornR = BABYLON.MeshBuilder.CreateCylinder("hr", { diameterTop: 0, diameterBottom: 0.15, height: 0.4, tessellation: 4 }, scene)
    hornR.position.set(0.25, 0.5, 0)
    hornR.material = matHorn
    hornR.parent = head

    const torso = BABYLON.MeshBuilder.CreateBox("torso", { width: 1.0, height: 0.7, depth: 1.4 }, scene)
    torso.position.set(0, 0.5, -0.3)
    torso.parent = baseBodyGroup

    // Ocultar originales
    head.isVisible = false; hornL.isVisible = false; hornR.isVisible = false; torso.isVisible = false

    // Generar N Instancias
    npcEntitiesRef.current.forEach(ent => { ent.group.dispose(); ent.label.dispose() })
    npcEntitiesRef.current.clear()

    for (let i = 0; i < npcCount; i++) {
      const cloneGroup = baseGroup.instantiateHierarchy() as BABYLON.TransformNode
      const startPos = new BABYLON.Vector3(i % 5 * 3 - 6, 0, Math.floor(i / 5) * 3 - 6)
      cloneGroup.position.copyFrom(startPos)
      
      const bodyGroup = cloneGroup.getChildren()[0] as BABYLON.TransformNode
      const headMesh = bodyGroup.getChildren().find(m => m.name === "head") as BABYLON.Mesh
      const torsoMesh = bodyGroup.getChildren().find(m => m.name === "torso") as BABYLON.Mesh

      // GUI Label
      const rect = new GUI.Rectangle()
      rect.thickness = 0
      rect.height = "60px"
      
      const label = new GUI.TextBlock()
      label.text = `#${i} IDLE`
      label.color = "#4ade80"
      label.fontSize = 14
      label.outlineColor = "black"
      label.outlineWidth = 3
      label.top = "-20px"
      
      const latencyLabel = new GUI.TextBlock()
      latencyLabel.text = ""
      latencyLabel.color = "#94a3b8"
      latencyLabel.fontSize = 10
      latencyLabel.top = "5px"

      rect.addControl(label)
      rect.addControl(latencyLabel)
      advancedTexture.addControl(rect)
      rect.linkWithMesh(cloneGroup)
      rect.linkOffsetY = -60

      npcEntitiesRef.current.set(i, {
        group: cloneGroup,
        body: bodyGroup,
        head: headMesh,
        torso: torsoMesh,
        rect, label, latencyLabel,
        targetPos: startPos.clone(),
        state: { action: 'idle', thinking: false, error: false, lastLatency: 0 }
      })
    }

    // Render Loop & Scripting CPU Measurement
    let frameCount = 0
    let lastTime = performance.now()

    scene.onBeforeRenderObservable.add(() => {
      const now = performance.now()
      const delta = (now - lastTime) / 1000
      lastTime = now

      // Medir el tiempo de CPU (Scripting) de todo este bloque lógico
      const startScripting = performance.now()

      frameCount++
      if (frameCount === 1) setIsLoading(false)

      const t = performance.now() * 0.001

      // Actualizar lógicas de NPC (Equivalente al useFrame interno del NpcEntity)
      npcEntitiesRef.current.forEach((ent, id) => {
        const { group, body, state, targetPos } = ent

        if (state.action === 'idle') {
          body.position.y = Math.sin(t * 2 + id) * 0.08
          body.rotation.z = Math.sin(t + id) * 0.04
        } else if (state.action === 'jump') {
          body.position.y = Math.abs(Math.sin(t * 6 + id)) * 1.5
          body.rotation.x = Math.sin(t * 6) * 0.3
        } else if (state.action === 'walk') {
          const curr = group.position
          const dir = targetPos.subtract(curr)
          
          if (dir.length() > 0.1) {
            const angle = Math.atan2(dir.x, dir.z)
            group.rotation.y = BABYLON.Scalar.Lerp(group.rotation.y, angle, delta * 5)
            group.position = BABYLON.Vector3.Lerp(curr, targetPos, delta * 1.5)
          }
          body.position.y = Math.abs(Math.sin(t * 8 + id)) * 0.3
          body.rotation.z = Math.sin(t * 8 + id) * 0.15
        }
      })

      // Cálculo del Scripting CPU y otras métricas
      const scriptTime = performance.now() - startScripting
      scriptingBuffer[scriptingIndex] = scriptTime
      scriptingIndex = (scriptingIndex + 1) % 60
      scriptingFilled = Math.min(scriptingFilled + 1, 60)

      if (frameCount % 10 === 0) {
        let sum = 0; for (let i = 0; i < scriptingFilled; i++) sum += scriptingBuffer[i]
        const avg = sum / scriptingFilled
        let variance = 0; for (let i = 0; i < scriptingFilled; i++) variance += Math.pow(scriptingBuffer[i] - avg, 2)
        const jitter = Math.sqrt(variance / scriptingFilled)
        setScriptingMs(Math.round((avg + jitter) * 100) / 100)

        const mem = (performance as any).memory
        setEngineMetrics({
          fps: Math.round(engine.getFps()),
          cpuTime: sceneInst.frameTimeCounter.current.toFixed(2),
          gpuTime: engineInst.gpuFrameTimeCounter?.current ? (engineInst.gpuFrameTimeCounter.current * 0.000001).toFixed(2) : "N/A",
          drawCalls: sceneInst.drawCallsCounter.current,
          triangles: scene.getActiveIndices() / 3,
          ram: mem ? Math.round(mem.usedJSHeapSize / 1048576) : 0
        })
      }
    })

    engine.runRenderLoop(() => scene.render())

    const handleResize = () => engine.resize()
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      engine.dispose()
    }
  }, [npcCount])

  // 3. SINCRONIZACIÓN REACT -> BABYLON (Actualiza mallas cuando cambia el estado de la API)
  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return

    const matNormal = scene.getMaterialByName("mNormal") as BABYLON.StandardMaterial
    const matThinking = scene.getMaterialByName("mThink") as BABYLON.StandardMaterial
    const matError = scene.getMaterialByName("mErr") as BABYLON.StandardMaterial

    npcStates.forEach(s => {
      const ent = npcEntitiesRef.current.get(s.id)
      if (!ent) return

      // Actualizar estado interno para el loop
      ent.state = s
      ent.targetPos.set(s.targetPosition.x, 0, s.targetPosition.z)

      // Actualizar visuales (Colores)
      const targetMat = s.error ? matError : s.thinking ? matThinking : matNormal
      if (ent.head.material !== targetMat) {
        ent.head.material = targetMat
        ent.torso.material = targetMat
      }

      // Actualizar GUI Labels
      const labelText = s.thinking ? '...' : s.error ? 'ERR' : s.action.toUpperCase()
      const labelColor = s.error ? '#ef4444' : s.thinking ? '#facc15' : '#4ade80'
      
      ent.label.text = `#${s.id} ${labelText}`
      ent.label.color = labelColor
      
      if (s.lastLatency > 0) {
        ent.latencyLabel.text = `${s.lastLatency}ms`
      }
    })
  }, [npcStates])

  return (
    <main className="relative w-full h-screen bg-[#050505] overflow-hidden">
      <PerformanceOverlay
        title={`Babylon IA: ${npcCount} Agentes`}
        input={true}
        count={npcCount}
        setCount={setNpcCount}
        inputConfig={{ unit: 'normal', type: 'values', values: [4, 16, 64, 256, 512] }}
      />
      
      <CombinedMetricsHUD 
        netMetrics={netMetrics} 
        engineMetrics={engineMetrics} 
        npcCount={npcCount} 
        scriptingMs={scriptingMs} 
      />

      <div className="absolute inset-0 pointer-events-none z-10">
        <DebugTools title="Simulación NPC + IA (Babylon)" entityCount={npcCount} />
        {isLoading && <Loader3D />}
      </div>

      <canvas 
        ref={canvasRef} 
        className="w-full h-full outline-none block" 
      />
    </main>
  )
}
```</Text>