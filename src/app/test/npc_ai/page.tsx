'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import * as BABYLON from '@babylonjs/core'
import * as GUI from '@babylonjs/gui'
import PerformanceOverlay from '@/components/test/PerformanceOverlay'
import Loader3D from '@/components/ui/Loader3D'

// ─── MÉTRICAS (Mismo sistema que triangles_rotating) ──────────────────────────────────────
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

// ─── TIPOS Y COLA ─────────────────────────────────────────────────────────────
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
  latencies: Array<{ latency: number; timestamp: number }>
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

// ─── SCRIPTING CPU BUFFER ────────────────────────────────────────────────────────
const scriptingBuffer = new Float32Array(60)
let scriptingIndex = 0
let scriptingFilled = 0

// ─── HUD ─────────────────────────────────────────────────────────────────────
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
      <div className="grid grid-cols-2 gap-2">
        <MiniCard label="NPCs"         value={npcCount}                                          color="blue"                              />
        <MiniCard label="Requests"     value={netMetrics.totalRequests}                          color="emerald"                           />
        <MiniCard label="Latencia Prom" value={netMetrics.avgLatency || '—'}                    color="yellow"  unit="ms"                 />
        <MiniCard label="Tasa Éxito"   value={successRate}                                       color={successRate > 90 ? 'emerald' : 'red'} unit="%" />
      </div>
      <div className="bg-black/80 backdrop-blur border border-orange-500/40 px-4 py-2 rounded-xl">
        <div className="flex justify-between items-center">
          <p className="text-gray-400 text-[10px] uppercase tracking-widest">Scripting CPU (Loop)</p>
          <p className={`text-xl font-mono font-black ${scriptingColor}`}>
            {scriptingMs.toFixed(2)}<span className="text-xs text-gray-500 ml-1">ms</span>
          </p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 mt-1">
        <MiniCard label="FPS"        value={engineMetrics.fps}                        color="green"  />
        <MiniCard label="GPU"        value={engineMetrics.gpuTime}                    color="pink"   unit="ms" />
        <MiniCard label="CPU"        value={engineMetrics.cpuTime}                    color="blue"   unit="ms" />
        <MiniCard label="DrawCalls"  value={engineMetrics.drawCalls}                  color="yellow" />
        <MiniCard label="Triángulos" value={engineMetrics.triangles?.toLocaleString()} color="purple" />
        <MiniCard label="RAM"        value={engineMetrics.ram}                        color="cyan"   unit="MB" />
      </div>
    </div>
  )
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
export default function NpcAiBabylonTest() {
  const [npcCount, setNpcCount]       = useState(64)
  const [npcStates, setNpcStates]     = useState<NpcState[]>([])
  const [scriptingMs, setScriptingMs] = useState(0)
  const [isLoading, setIsLoading]     = useState(true)
  const [netMetrics, setNetMetrics]   = useState<ApiMetrics>({
    totalRequests: 0, successRequests: 0, failedRequests: 0, avgLatency: 0, latencies: [],
  })
  const [engineMetrics, setEngineMetrics] = useState<any>({
    fps: 0, cpuTime: 0, gpuTime: 0, drawCalls: 0, triangles: 0, ram: 0,
  })

  const canvasRef        = useRef<HTMLCanvasElement>(null)
  const npcEntitiesRef   = useRef<Map<number, any>>(new Map())
  const sceneRef         = useRef<BABYLON.Scene | null>(null)
  // Agrega esta ref junto a las demás refs
  const netMetricsRef = useRef<ApiMetrics>({
    totalRequests: 0, successRequests: 0, failedRequests: 0, avgLatency: 0, latencies: [],
  })

  // ─── 1. Init estados NPC ───────────────────────────────────────────────────
  useEffect(() => {
    setNpcStates(Array.from({ length: npcCount }, (_, i): NpcState => ({
      id: i, action: 'idle', thinking: false, error: false,
      targetPosition: { x: 0, z: 0 }, requestCount: 0, lastLatency: 0,
    })))
  }, [npcCount])

  const recordRequest = useCallback((success: boolean, latency: number) => {
  setNetMetrics(prev => {
    const now = performance.now()
    const newLatencies = [...prev.latencies.slice(-49), { latency, timestamp: now }]
    const avgLatency   = Math.round(newLatencies.reduce((a, b) => a + b.latency, 0) / newLatencies.length)
    const next = {
      totalRequests:   prev.totalRequests + 1,
      successRequests: prev.successRequests + (success ? 1 : 0),
      failedRequests:  prev.failedRequests  + (success ? 0 : 1),
      avgLatency,
      latencies: newLatencies,
    }
    // ✅ Sincronizar ref para que el console log la pueda leer sin closures stale
    netMetricsRef.current = next
    return next
  })
}, [])

  const updateNpc = useCallback((id: number, patch: Partial<NpcState>) => {
    setNpcStates(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s))
  }, [])

  const runNpcLoop = useCallback(async (id: number, signal: AbortSignal) => {
    await new Promise(r => setTimeout(r, id * 500))
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
            lastLatency: latency,
          })
        })
      } catch (err: any) {
        if (err.name === 'AbortError') return
        const lat = Math.round(performance.now() - t0)
        recordRequest(false, lat)
        updateNpc(id, { thinking: false, error: true, lastLatency: lat })
      }
      await new Promise(r => {
        const timeout = setTimeout(r, 3000 + Math.random() * 2000)
        signal.addEventListener('abort', () => clearTimeout(timeout), { once: true })
      })
    }
  }, [updateNpc, recordRequest])

  useEffect(() => {
    if (npcStates.length === 0) return
    const ac = new AbortController()
    npcStates.forEach(s => runNpcLoop(s.id, ac.signal))
    return () => ac.abort()
  }, [npcStates.length, runNpcLoop])

  // ─── 2. Init Babylon ───────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // ✅ Fix canvas size
    canvas.width  = canvas.clientWidth  || window.innerWidth
    canvas.height = canvas.clientHeight || window.innerHeight

    const engine = new BABYLON.Engine(canvas, true, {
      preserveDrawingBuffer: true, stencil: true, adaptToDeviceRatio: true,
    })
    const scene = new BABYLON.Scene(engine)
    scene.clearColor = new BABYLON.Color4(0.02, 0.02, 0.02, 1)
    sceneRef.current = scene

    const sceneInst  = new BABYLON.SceneInstrumentation(scene)
    const engineInst = new BABYLON.EngineInstrumentation(engine)
    sceneInst.captureFrameTime     = true
    sceneInst.captureDrawCalls     = true
    engineInst.captureGPUFrameTime = true

    // ── Cámara FIJA ──────────────────────────────────────────────────────────
    const camera = new BABYLON.ArcRotateCamera('camera', -Math.PI / 2, Math.PI / 3, 22.8, BABYLON.Vector3.Zero(), scene)
    camera.setPosition(new BABYLON.Vector3(0, 14, 18))
    camera.fov = 50 * (Math.PI / 180)
    // Sin attachControl → estática

    // Luces
    new BABYLON.HemisphericLight('ambient', new BABYLON.Vector3(0, 1, 0), scene).intensity = 0.5
    const dirLight = new BABYLON.DirectionalLight('dir', new BABYLON.Vector3(-1, -2, -1), scene)
    dirLight.position  = new BABYLON.Vector3(10, 15, 10)
    dirLight.intensity = 1.0

    // Suelo
    const ground    = BABYLON.MeshBuilder.CreatePlane('ground', { size: 30 }, scene)
    ground.rotation.x = Math.PI / 2
    const groundMat = new BABYLON.StandardMaterial('gmat', scene)
    groundMat.diffuseColor  = BABYLON.Color3.FromHexString('#020817')
    groundMat.specularColor = new BABYLON.Color3(0, 0, 0)
    ground.material = groundMat

    // GUI
    const advancedTexture = GUI.AdvancedDynamicTexture.CreateFullscreenUI('UI')

    // Materiales compartidos
    const matNormal   = new BABYLON.StandardMaterial('mNormal', scene)
    matNormal.diffuseColor = BABYLON.Color3.FromHexString('#f97316')
    const matThinking = new BABYLON.StandardMaterial('mThink', scene)
    matThinking.diffuseColor = BABYLON.Color3.FromHexString('#facc15')
    const matError    = new BABYLON.StandardMaterial('mErr', scene)
    matError.diffuseColor = BABYLON.Color3.FromHexString('#ef4444')
    const matHorn     = new BABYLON.StandardMaterial('mHorn', scene)
    matHorn.diffuseColor = BABYLON.Color3.FromHexString('#c2410c')

    // ── Limpiar entidades anteriores ─────────────────────────────────────────
    npcEntitiesRef.current.forEach(ent => {
      ent.group?.dispose()
      ent.rect?.dispose()
    })
    npcEntitiesRef.current.clear()

    // ── Crear NPCs directamente (sin instantiateHierarchy) ───────────────────
    // ✅ FIX: construir cada NPC desde cero para evitar nombres ambiguos en clones
    for (let i = 0; i < npcCount; i++) {
      const col  = i % 32
      const row  = Math.floor(i / 32)
      const startPos = new BABYLON.Vector3(col * 2.2 - 32, 0, row * 2.2 - 16)

      // Grupo raíz del NPC
      const group     = new BABYLON.TransformNode(`npc_root_${i}`, scene)
      group.position.copyFrom(startPos)

      // Grupo de cuerpo (para animaciones de rebote/rotación independientes del root)
      const bodyGroup = new BABYLON.TransformNode(`npc_body_${i}`, scene)
      bodyGroup.parent = group

      // Cabeza
      const head = BABYLON.MeshBuilder.CreateBox(`npc_head_${i}`, { width: 0.8, height: 0.8, depth: 0.8 }, scene)
      head.position.set(0, 1.2, 0.4)
      head.parent   = bodyGroup
      head.material = matNormal

      // Cuernos
      const hornL = BABYLON.MeshBuilder.CreateCylinder(`npc_hornL_${i}`, {
        diameterTop: 0, diameterBottom: 0.15, height: 0.4, tessellation: 4,
      }, scene)
      hornL.position.set(-0.25, 0.5, 0)
      hornL.parent   = head
      hornL.material = matHorn

      const hornR = BABYLON.MeshBuilder.CreateCylinder(`npc_hornR_${i}`, {
        diameterTop: 0, diameterBottom: 0.15, height: 0.4, tessellation: 4,
      }, scene)
      hornR.position.set(0.25, 0.5, 0)
      hornR.parent   = head
      hornR.material = matHorn

      // Torso
      const torso = BABYLON.MeshBuilder.CreateBox(`npc_torso_${i}`, { width: 1.0, height: 0.7, depth: 1.4 }, scene)
      torso.position.set(0, 0.5, -0.3)
      torso.parent   = bodyGroup
      torso.material = matNormal

      // GUI label
      const rect = new GUI.Rectangle()
      rect.thickness = 0
      rect.height    = '60px'

      const label = new GUI.TextBlock()
      label.text         = `#${i} IDLE`
      label.color        = '#4ade80'
      label.fontSize     = 14
      label.outlineColor = 'black'
      label.outlineWidth = 3
      label.top          = '-20px'

      const latencyLabel = new GUI.TextBlock()
      latencyLabel.text     = ''
      latencyLabel.color    = '#94a3b8'
      latencyLabel.fontSize = 10
      latencyLabel.top      = '5px'

      rect.addControl(label)
      rect.addControl(latencyLabel)
      advancedTexture.addControl(rect)
      rect.linkWithMesh(group)
      rect.linkOffsetY = -60

      npcEntitiesRef.current.set(i, {
        group, bodyGroup, head, torso,
        rect, label, latencyLabel,
        targetPos: startPos.clone(),
        state: { action: 'idle', thinking: false, error: false, lastLatency: 0 },
      })
    }

    // ─── Render loop ────────────────────────────────────────────────────────────
    let frameCount = 0
    let startTime = performance.now()
    let loadTime = 0
    let lastTime = performance.now()
    let lastLogTime = performance.now()

    scene.onBeforeRenderObservable.add(() => {
      const now = performance.now()
      const delta = (now - lastTime) / 1000
      lastTime = now

      // Tracking de Métricas
      metricsCalculator.push(delta)
      frameCount++
      
      if (frameCount === 1) {
        loadTime = performance.now() - startTime
        setIsLoading(false)
      }
      
      if (frameCount % 10 === 0) {
        const mem = (performance as any).memory
        setEngineMetrics({
          fps:       Math.round(engine.getFps()),
          cpuTime:   sceneInst.frameTimeCounter.current,
          gpuTime:   engineInst.gpuFrameTimeCounter?.current
                       ? (engineInst.gpuFrameTimeCounter.current * 0.000001).toFixed(2)
                       : 'N/A',
          drawCalls: sceneInst.drawCallsCounter.current,
          triangles: scene.getActiveIndices() / 3,
          ram:       mem ? Math.round(mem.usedJSHeapSize / 1048576) : 0,
        })
      }

      const t = now * 0.001

      const startScripting = performance.now()

      npcEntitiesRef.current.forEach((ent, id) => {
        const { group, bodyGroup, state, targetPos } = ent
        if (!group || !bodyGroup) return

        if (state.action === 'idle') {
          bodyGroup.position.y = Math.sin(t * 2 + id) * 0.08
          bodyGroup.rotation.z = Math.sin(t + id) * 0.04
        } else if (state.action === 'jump') {
          bodyGroup.position.y = Math.abs(Math.sin(t * 6 + id)) * 1.5
          bodyGroup.rotation.x = Math.sin(t * 6) * 0.3
        } else if (state.action === 'walk') {
          const curr = group.position
          const dir  = targetPos.subtract(curr)
          if (dir.length() > 0.1) {
            const angle    = Math.atan2(dir.x, dir.z)
            group.rotation.y = BABYLON.Scalar.Lerp(group.rotation.y, angle, delta * 5)
            group.position   = BABYLON.Vector3.Lerp(curr, targetPos, delta * 1.5)
          }
          bodyGroup.position.y = Math.abs(Math.sin(t * 8 + id)) * 0.3
          bodyGroup.rotation.z = Math.sin(t * 8 + id) * 0.15
        }
      })

      // Scripting CPU
      const scriptTime = performance.now() - startScripting
      scriptingBuffer[scriptingIndex] = scriptTime
      scriptingIndex = (scriptingIndex + 1) % 60
      scriptingFilled = Math.min(scriptingFilled + 1, 60)

      // Calculate scripting CPU average
      let scriptSum = 0
      for (let i = 0; i < scriptingFilled; i++) scriptSum += scriptingBuffer[i]
      const scriptAvg = scriptingFilled > 0 ? scriptSum / scriptingFilled : 0
      if (frameCount % 10 === 0) {
        setScriptingMs(Math.round(scriptAvg * 100) / 100)
      }

      // ── Console log cada 5s ──────────────────────────────────────────────────
      if (now - lastLogTime >= 5000) {
        lastLogTime = now

        const fps     = engine.getFps()
        const computed = metricsCalculator.compute()
        const frameTime = computed.frameTime
        const jitter = computed.jitter
        const frameBudget = (frameTime / 10) * 100 // 10ms for 100Hz

        const gpuMs = (engineInst.gpuFrameTimeCounter?.current || 0) / 1000000
        const cpuMs = Math.max(0, frameTime - gpuMs)
        
        const mem      = (performance as any).memory
        const ramMBLog = mem ? (mem.usedJSHeapSize / 1048576).toFixed(1) : 'N/A'

        const reqTotal = netMetricsRef.current.totalRequests
        const latSum   = netMetricsRef.current.avgLatency

        // Calculate API jitter
        let apiJitter = 0
        if (netMetricsRef.current.latencies.length > 1) {
          const lats = netMetricsRef.current.latencies.map(l => l.latency)
          const mean = lats.reduce((a, b) => a + b, 0) / lats.length
          const variance = lats.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / lats.length
          apiJitter = Math.sqrt(variance)
        }

        // Calculate peak latency (last 10s)
        let peakLatency10s = 0
        const tenSecondsAgo = now - 10000
        const recentLatencies = netMetricsRef.current.latencies.filter(l => l.timestamp >= tenSecondsAgo)
        if (recentLatencies.length > 0) {
          peakLatency10s = Math.max(...recentLatencies.map(l => l.latency))
        }

        console.group(
          `%c[Babylon NPC AI Test] ${new Date().toLocaleTimeString()}`,
          'color:#6366f1;font-weight:700;font-size:12px',
        )
        console.log(`%cAgentes              %c${npcCount}`,                     'color:#94a3b8', 'color:#f1f5f9;font-weight:600')
        console.log(`%cMotor                %cBabylon.js`,                      'color:#94a3b8', 'color:#f1f5f9;font-weight:600')
        console.log(`%cFPS                  %c${fps.toFixed(1)}`,               'color:#94a3b8', 'color:#f1f5f9;font-weight:600')
        console.log(`%cFrame Time (ms)      %c${frameTime.toFixed(2)}`,         'color:#94a3b8', 'color:#f1f5f9;font-weight:600')
        console.log(`%cFrame Budget (%%)    %c${frameBudget.toFixed(1)}`,       'color:#94a3b8', 'color:#f1f5f9;font-weight:600')
        console.log(`%cScripting CPU (ms)   %c${scriptAvg.toFixed(2)}`,         'color:#94a3b8', 'color:#f1f5f9;font-weight:600')
        console.log(`%cLatencia Prom (ms)   %c${latSum}`,                      'color:#94a3b8', 'color:#f1f5f9;font-weight:600')
        console.log(`%cFrame Jitter (ms)    %c${jitter.toFixed(2)}`,            'color:#94a3b8', 'color:#f1f5f9;font-weight:600')
        console.log(`%cAPI Jitter (ms)      %c${apiJitter.toFixed(2)}`,         'color:#94a3b8', 'color:#f1f5f9;font-weight:600')
        console.log(`%cPico Latencia (10s)  %c${peakLatency10s}`,              'color:#94a3b8', 'color:#f1f5f9;font-weight:600')
        console.log(`%cRequests Totales     %c${reqTotal}`,                    'color:#94a3b8', 'color:#f1f5f9;font-weight:600')
        console.log(`%cRAM (MB)             %c${ramMBLog}`,                    'color:#94a3b8', 'color:#f1f5f9;font-weight:600')
        console.log(`%cGPU (ms)             %c${gpuMs.toFixed(2)}`,             'color:#94a3b8', 'color:#f1f5f9;font-weight:600')
        console.log(`%cCPU (ms)             %c${cpuMs.toFixed(2)}`,             'color:#94a3b8', 'color:#f1f5f9;font-weight:600')
        console.groupEnd()
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
  }, [npcCount])

  // ─── 3. Sync React → Babylon ───────────────────────────────────────────────
  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return

    const matNormal   = scene.getMaterialByName('mNormal')   as BABYLON.StandardMaterial
    const matThinking = scene.getMaterialByName('mThink')    as BABYLON.StandardMaterial
    const matError    = scene.getMaterialByName('mErr')      as BABYLON.StandardMaterial

    npcStates.forEach(s => {
      const ent = npcEntitiesRef.current.get(s.id)
      // ✅ Guard: saltar si la entidad aún no existe
      if (!ent || !ent.head || !ent.torso) return

      ent.state    = s
      ent.targetPos.set(s.targetPosition.x, 0, s.targetPosition.z)

      const targetMat = s.error ? matError : s.thinking ? matThinking : matNormal
      if (ent.head.material !== targetMat) {
        ent.head.material  = targetMat
        ent.torso.material = targetMat
      }

      const labelText  = s.thinking ? '...' : s.error ? 'ERR' : s.action.toUpperCase()
      const labelColor = s.error ? '#ef4444' : s.thinking ? '#facc15' : '#4ade80'
      ent.label.text   = `#${s.id} ${labelText}`
      ent.label.color  = labelColor
      if (s.lastLatency > 0) ent.latencyLabel.text = `${s.lastLatency}ms`
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
      
      <div className="absolute inset-0 pointer-events-none z-10">
        {isLoading && <Loader3D />}
      </div>
      <canvas ref={canvasRef} className="w-full h-full outline-none block" />
    </main>
  )
}
