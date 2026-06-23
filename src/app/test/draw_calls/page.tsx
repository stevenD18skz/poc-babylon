'use client'

import { useEffect, useRef, useState } from 'react'
import * as BABYLON from '@babylonjs/core'
import PerformanceOverlay from '@/components/test/PerformanceOverlay'

// ─── GUARD DE MÓDULO (sobrevive StrictMode double-mount) ──────────────────────
let _engine: BABYLON.Engine | null = null
let _scene:  BABYLON.Scene  | null = null

// ─── MÉTRICAS ─────────────────────────────────────────────────────────────────
const SAMPLE_SIZE = 120

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

// ─── HELPER: construye / reconstruye meshes ───────────────────────────────────
type MeshEntry = { mesh: BABYLON.Mesh; mat: BABYLON.StandardMaterial }

function buildMeshes(scene: BABYLON.Scene, count: number, store: MeshEntry[]) {
  // Limpieza — sin isDisposed, dispose() es seguro llamarlo múltiples veces
  store.forEach(({ mesh, mat }) => {
    mesh.dispose()
    mat.dispose()
  })
  store.length = 0
  deltaCalc.reset()

  // 5 geometrías base (ocultas, solo para clonar)
  const bases = [
    BABYLON.MeshBuilder.CreateBox     ('b0', { size: 1 }, scene),
    BABYLON.MeshBuilder.CreateSphere  ('b1', { diameter: 1.2, segments: 16 }, scene),
    BABYLON.MeshBuilder.CreateCylinder('b2', { diameterTop: 0,   diameterBottom: 1,   height: 1.2, tessellation: 8  }, scene),
    BABYLON.MeshBuilder.CreateCylinder('b3', { diameterTop: 0.8, diameterBottom: 0.8, height: 1.2, tessellation: 12 }, scene),
    BABYLON.MeshBuilder.CreateTorus   ('b4', { diameter: 1, thickness: 0.2, tessellation: 16 }, scene),
  ]
  bases.forEach(g => { g.isVisible = false })

  for (let i = 0; i < count; i++) {
    const gi   = i % bases.length
    const mesh = bases[gi].clone(`obj-${i}`)
    mesh.isVisible = true

    mesh.position.set(
      (Math.random() - 0.5) * 30,
      (Math.random() - 0.5) * 20,
      (Math.random() - 0.5) * 30,
    )
    mesh.rotation.set(
      Math.random() * Math.PI,
      Math.random() * Math.PI,
      Math.random() * Math.PI,
    )
    mesh.scaling.setAll(0.4 + Math.random() * 1.0)

    // Material único por objeto → 1 draw call estricto, sin batching
    const mat = new BABYLON.StandardMaterial(`mat-${i}`, scene)
    mat.diffuseColor  = BABYLON.Color3.FromHSV((i / count) * 360, 0.7, 0.7)
    mat.roughness     = 0.3 + (gi / 5) * 0.5
    const sv          = 0.1 + (gi / 5) * 0.4
    mat.specularColor = new BABYLON.Color3(sv, sv, sv)
    mesh.material     = mat
    mesh.makeGeometryUnique()

    store.push({ mesh, mat })
  }

  bases.forEach(g => g.dispose())
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
export default function DrawCallsBabylonTest() {
  const count = 1 // Valor fijo, no depende de input

  const canvasRef   = useRef<HTMLCanvasElement>(null)
  const countRef    = useRef(count)
  const meshStore   = useRef<MeshEntry[]>([])

  // Mantener countRef sincronizado
  useEffect(() => { countRef.current = count }, [count])

  // ─── 1. Init del motor ────────────────────────────────────────────────────
  useEffect(() => {
    if (!canvasRef.current) return

    // Guard: reutilizar si ya existe (StrictMode double-mount)
    if (_engine && !_engine.isDisposed) {
      if (_scene) buildMeshes(_scene, countRef.current, meshStore.current)
      return
    }

    // Engine
    const engine = new BABYLON.Engine(canvasRef.current, true, {
      preserveDrawingBuffer: true,
      stencil: true,
    })
    _engine = engine

    // Scene
    const scene = new BABYLON.Scene(engine)
    scene.clearColor = new BABYLON.Color4(0.02, 0.02, 0.02, 1)
    _scene = scene

    // Instrumentación
    const inst = new BABYLON.SceneInstrumentation(scene)
    inst.captureFrameTime = true

    // Cámara
    const cam = new BABYLON.ArcRotateCamera('cam', -Math.PI / 2, Math.PI / 2.5, 41.2, BABYLON.Vector3.Zero(), scene)
    cam.setPosition(new BABYLON.Vector3(0, 10, 40))
    cam.fov = 50 * (Math.PI / 180)
    cam.attachControl(canvasRef.current, true)

    // Luces
    new BABYLON.HemisphericLight('amb', new BABYLON.Vector3(0, 1, 0), scene).intensity = 0.6
    const d1 = new BABYLON.DirectionalLight('d1', new BABYLON.Vector3(-1, -2, -1), scene)
    d1.position = new BABYLON.Vector3(10, 20, 10); d1.intensity = 1.0
    const d2 = new BABYLON.DirectionalLight('d2', new BABYLON.Vector3(1, 1, 1), scene)
    d2.position = new BABYLON.Vector3(-10, -10, -10)
    d2.diffuse  = BABYLON.Color3.FromHexString('#4f46e5')
    d2.intensity = 0.3

    // Meshes iniciales
    buildMeshes(scene, countRef.current, meshStore.current)

    // ─── Render loop ──────────────────────────────────────────────────────
    let frameCount  = 0
    let lastTime    = performance.now()
    let lastLogTime = performance.now() - 9000 // primer log a los 10s

    scene.onBeforeRenderObservable.add(() => {
      const now   = performance.now()
      const delta = now - lastTime
      lastTime    = now
      frameCount++

      if (frameCount > 10) deltaCalc.push(delta)

      if (now - lastLogTime >= 5000) {
        lastLogTime = now

        const meanFt    = deltaCalc.mean()
        const fps       = meanFt > 0 ? 1000 / meanFt : engine.getFps()
        const jitter    = deltaCalc.jitter()
        const cpuMs     = inst.frameTimeCounter.current
        // Draw calls en Babylon 9: se leen desde el engine directamente
        const drawCalls = (engine as any)._drawCalls?.current ?? engine.getInfo().drawCalls ?? 0

        console.group(
          `%c[Draw Calls Babylon] ${new Date().toLocaleTimeString()}  |  ${countRef.current} objetos únicos`,
          'color:#f59e0b;font-weight:700;font-size:12px',
        )
        console.log(`%cFPS            %c${fps.toFixed(1)}`,       'color:#94a3b8', 'color:#f1f5f9;font-weight:600')
        console.log(`%cDraw Calls     %c${drawCalls}`,            'color:#94a3b8', 'color:#f1f5f9;font-weight:600')
        console.log(`%cCPU (ms/frame) %c${cpuMs.toFixed(2)} ms`, 'color:#94a3b8', 'color:#f1f5f9;font-weight:600')
        console.log(`%cFrame Time     %c${meanFt.toFixed(2)} ms`, 'color:#94a3b8', 'color:#f1f5f9;font-weight:600')
        console.log(`%cJitter         %c${jitter.toFixed(2)} ms`, 'color:#94a3b8', 'color:#f1f5f9;font-weight:600')
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
    buildMeshes(_scene, count, meshStore.current)
  }, [count])

  return (
    <main className="relative w-full h-screen bg-[#050505] overflow-hidden">
      <PerformanceOverlay
        title={`Draw Calls: ${count} Objetos Únicos`}
        input={true}
        count={count}
        setCount={setCount}
        inputConfig={{ unit: 'normal', type: 'values', values: [1, 32, 256] }}
      />
      <canvas ref={canvasRef} className="w-full h-full outline-none block" />
    </main>
  )
}