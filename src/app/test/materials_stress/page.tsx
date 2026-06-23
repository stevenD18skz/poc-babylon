'use client'

import { useEffect, useRef, useState } from 'react'
import * as BABYLON from '@babylonjs/core'
import PerformanceOverlay from '@/components/test/PerformanceOverlay'
import Loader3D from '@/components/ui/Loader3D'

// ─── MÉTRICAS ─────────────────────────────────────────────────────────────────
const JITTER_SAMPLE_SIZE = 120

const metricsCalculator = {
  samples: new Float32Array(JITTER_SAMPLE_SIZE),
  index: 0, filled: 0,
  frameCount: 0,         // para ventana de warmup igual que R3F (5 frames)
  compilationSpike: 0,
  push(deltaMs: number) {
    this.frameCount++
    // Primeros 5 frames → capturar spike, no alimentar jitter (igual que R3F)
    if (this.frameCount <= 5) {
      if (deltaMs > this.compilationSpike) this.compilationSpike = deltaMs
      return
    }
    this.samples[this.index] = deltaMs
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
  reset() {
    this.index = 0; this.filled = 0; this.frameCount = 0; this.compilationSpike = 0
  },
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
export default function MaterialsStressBabylonTest() {
  const [count, setCount]         = useState(32)
  const [isLoading, setIsLoading] = useState(true)

  const canvasRef     = useRef<HTMLCanvasElement>(null)
  const sceneRef      = useRef<BABYLON.Scene | null>(null)
  const engineInstRef = useRef<BABYLON.EngineInstrumentation | null>(null)
  const sceneInstRef  = useRef<BABYLON.SceneInstrumentation | null>(null)
  const instancesRef  = useRef<{ mesh: BABYLON.Mesh; mat: BABYLON.Material; rtt?: BABYLON.RenderTargetTexture }[]>([])
  const rootNodeRef   = useRef<BABYLON.TransformNode | null>(null)
  const countRef      = useRef(count)

  useEffect(() => { countRef.current = count }, [count])

  // ─── Rebuild materiales (equivalente a useMemo + re-mount de ComplexMaterials)
  const rebuildMaterials = (scene: BABYLON.Scene, n: number) => {
    setIsLoading(true)
    metricsCalculator.reset()

    // Limpiar anteriores
    instancesRef.current.forEach(({ mesh, mat, rtt }) => {
      mesh.dispose()
      if (rtt) {
        // Remover de customRenderTargets antes de disponer
        const idx = scene.customRenderTargets.indexOf(rtt)
        if (idx !== -1) scene.customRenderTargets.splice(idx, 1)
        rtt.dispose()
      }
      mat.dispose()
    })
    instancesRef.current = []

    // Limpiar geometrías base anteriores
    const oldTK = scene.getMeshByName('baseTK')
    const oldSP = scene.getMeshByName('baseSP')
    oldTK?.dispose()
    oldSP?.dispose()

    // Geometrías base (equivalente a torusKnotGeom y sphereGeom globales de R3F)
    const baseTK = BABYLON.MeshBuilder.CreateTorusKnot(
      'baseTK', { radius: 1, tube: 0.3, radialSegments: 128, tubularSegments: 32 }, scene,
    )
    const baseSP = BABYLON.MeshBuilder.CreateSphere(
      'baseSP', { segments: 64, diameter: 2 }, scene,
    )
    baseTK.isVisible = false
    baseSP.isVisible = false

    const rootNode = rootNodeRef.current!

    for (let i = 0; i < n; i++) {
      const type    = i % 3
      const isTorus = i % 2 === 0

      const mesh = isTorus ? baseTK.clone(`mesh-${i}`) : baseSP.clone(`mesh-${i}`)
      mesh.isVisible      = true
      mesh.parent         = rootNode
      mesh.rotationQuaternion = null  // fix rotación en clones
      mesh.makeGeometryUnique()  // ← forzar buffer independiente

      mesh.position.set(
        (Math.random() - 0.5) * 25,
        (Math.random() - 0.5) * 25,
        (Math.random() - 0.5) * 25,
      )
      mesh.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI,
      )
      mesh.scaling.setAll(Math.random() * 1.5 + 0.5)

      const hue   = i / n
      const color = BABYLON.Color3.FromHSV(hue * 360, 0.7, 0.5)

      const pbr = new BABYLON.PBRMaterial(`mat-${i}`, scene)
      pbr.albedoColor = color

      if (type === 0) {
        // TRANSMISSION con RenderTargetTexture (equiv. MeshTransmissionMaterial)
        pbr.metallic  = 0
        pbr.roughness = 0.1

        // Crear RTT y añadirla al render loop de la escena
        const rtt = new BABYLON.RenderTargetTexture(`refraction-${i}`, 256, scene)

        // Añadir todos los meshes visibles como renderizables en este RTT
        // (equivalente a lo que Three.js hace internamente por cada MeshTransmissionMaterial)
        rtt.renderList = [] // se llena después de crear todos los meshes

        // Registrar en la escena para que se ejecute cada frame
        scene.customRenderTargets.push(rtt)

        pbr.refractionTexture = rtt
        pbr.subSurface.isRefractionEnabled = true
        pbr.subSurface.refractionIntensity = 1.0
        pbr.subSurface.indexOfRefraction   = 1.2
        pbr.linkRefractionWithTransparency = true
        pbr.subSurface.tintColor           = color
        pbr.subSurface.useDispersion       = true
        pbr.subSurface.dispersion          = 0.05

        mesh.material = pbr
        instancesRef.current.push({ mesh, mat: pbr, rtt })
      } else {
        if (type === 1) {
          // METAL PBR (equiv. meshPhysicalMaterial metalness+clearcoat)
          pbr.metallic             = 1.0
          pbr.roughness            = 0.05
          pbr.clearCoat.isEnabled  = true
          pbr.clearCoat.roughness  = 0.1
        } else {
          // CLEARCOAT + SHEEN
          pbr.metallic             = 0.1
          pbr.roughness            = 0.4
          pbr.clearCoat.isEnabled  = true
          pbr.clearCoat.roughness  = 0.1
          pbr.sheen.isEnabled      = true
          pbr.sheen.roughness      = 0.5
          pbr.sheen.color          = BABYLON.Color3.White()
        }

        mesh.material = pbr
        instancesRef.current.push({ mesh, mat: pbr })
      }
    }

    // Después del for loop, llenar renderList de cada RTT
    instancesRef.current.forEach(({ mesh: ownerMesh, rtt }) => {
      if (rtt) {
        // Excluir el propio mesh de la renderList para evitar feedback loop
        rtt.renderList = instancesRef.current
          .filter(({ mesh }) => mesh !== ownerMesh)
          .map(({ mesh }) => mesh)
      }
    })

    setTimeout(() => setIsLoading(false), 100)
  }

  // ─── Init motor UNA sola vez ──────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    canvas.width  = canvas.clientWidth  || window.innerWidth
    canvas.height = canvas.clientHeight || window.innerHeight

    const engine = new BABYLON.Engine(canvas, true, {
      preserveDrawingBuffer: true, stencil: true,
      adaptToDeviceRatio: true, powerPreference: 'high-performance',
    })

    const scene = new BABYLON.Scene(engine)
    sceneRef.current = scene
    scene.clearColor = new BABYLON.Color4(0.02, 0.02, 0.02, 1)

    const sceneInst  = new BABYLON.SceneInstrumentation(scene)
    const engineInst = new BABYLON.EngineInstrumentation(engine)
    sceneInst.captureFrameTime     = true
    sceneInst.captureDrawCalls     = true
    engineInst.captureGPUFrameTime = true
    sceneInstRef.current  = sceneInst
    engineInstRef.current = engineInst

    // ── Cámara FIJA (equiv. camera={{ position:[0,0,40], fov:45 }}) ──────────
    const camera = new BABYLON.ArcRotateCamera('cam', -Math.PI / 2, Math.PI / 2, 40, BABYLON.Vector3.Zero(), scene)
    camera.fov = 45 * (Math.PI / 180)
    // Sin attachControl → estática

    // ── Entorno HDRI studio (equiv. <Environment preset="studio" />) ─────────
    try {
      const env = BABYLON.CubeTexture.CreateFromPrefilteredData(
        'https://assets.babylonjs.com/environments/studio.env', scene,
      )
      scene.environmentTexture   = env
      scene.environmentIntensity = 1.0
      scene.createDefaultSkybox(env, true, 500, 0.5) // equiv. background blur={0.5}
    } catch (_) {}

    // ── Root node para rotación global (equiv. groupRef.rotation.y en useFrame)
    const rootNode = new BABYLON.TransformNode('root', scene)
    rootNodeRef.current = rootNode

    // ── Primera carga ─────────────────────────────────────────────────────────
    rebuildMaterials(scene, countRef.current)

    // ── Render loop ───────────────────────────────────────────────────────────
    let lastTime    = performance.now()
    let lastLogTime = performance.now() - 2000
    const startTime = performance.now()

    scene.onBeforeRenderObservable.add(() => {
      const now   = performance.now()
      const delta = (now - lastTime) / 1000
      lastTime    = now

      const deltaMs = delta * 1000
      metricsCalculator.push(deltaMs)

      // Rotación del grupo (equiv. groupRef.current.rotation.y = elapsed * 0.05)
      rootNode.rotation.y = (now - startTime) * 0.001 * 0.05

      // Console log cada 2s — mismo formato e intervalo que R3F
      if (now - lastLogTime >= 2000) {
        lastLogTime = now

        const meanMs   = metricsCalculator.mean()
        const jitterMs = metricsCalculator.jitter()
        const currentFps = meanMs > 0 ? 1000 / meanMs : 0

        const gpuMs  = engineInst.gpuFrameTimeCounter?.current
          ? engineInst.gpuFrameTimeCounter.current * 0.000001 : 0
        const cpuMs  = Math.max(0, meanMs - gpuMs)

        const estimateVRAM = () => {
          let totalBytes = 0

          // Geometría y materiales de cada mesh
          instancesRef.current.forEach(({ mesh, mat }) => {
            // Geometría: indices + vertices
            if (mesh.geometry) {
              const indices = mesh.geometry.getIndices()
              const vertices = mesh.geometry.getVerticesData(BABYLON.VertexBuffer.PositionKind)
              if (indices) totalBytes += indices.length * 4 // Uint32
              if (vertices) totalBytes += vertices.length * 4 // Float32 positions
              const normals = mesh.geometry.getVerticesData(BABYLON.VertexBuffer.NormalKind)
              if (normals) totalBytes += normals.length * 4 // Float32 normals
              const uvs = mesh.geometry.getVerticesData(BABYLON.VertexBuffer.UVKind)
              if (uvs) totalBytes += uvs.length * 4 // Float32 UVs
            }
          })

          // Todos los RenderTargetTextures (customRenderTargets)
          scene.customRenderTargets.forEach(rt => {
            if (rt instanceof BABYLON.RenderTargetTexture) {
              const size = rt.getSize()
              totalBytes += size.width * size.height * 4 * 4 // RGBA32F por cada RTT
            }
          })

          // Entorno HDRI (si existe)
          if (scene.environmentTexture) {
            const env = scene.environmentTexture as any
            if (env._size) {
              totalBytes += env._size * env._size * 4 * 6 // Cube map
            }
          }

          return totalBytes / (1024 * 1024)
        }
        const vramMB = estimateVRAM()

        console.log(
          `%c[PBR Shaders] ${instancesRef.current.length.toLocaleString()} Materiales Complejos`,
          'color:#f43f5e;font-weight:bold;font-size:12px',
        )
        console.log(`%cMotor%c Babylon.js`,                                                       'color:#94a3b8', 'color:#e2e8f0;font-weight:600')
        console.log(`%cEntidades%c ${instancesRef.current.length}`,                               'color:#94a3b8', 'color:#e2e8f0;font-weight:600')
        console.log(`%cFPS%c ${Math.round(currentFps)}`,                                          'color:#94a3b8', 'color:#e2e8f0;font-weight:600')
        console.log(`%cCPU (ms)%c ${cpuMs.toFixed(2)} ms`,                                       'color:#94a3b8', 'color:#38bdf8;font-weight:600')
        console.log(`%cFrame Time (ms)%c ${meanMs.toFixed(2)} ms`,                               'color:#94a3b8', 'color:#e2e8f0;font-weight:600')
        console.log(`%cVRAM (mb)%c ${vramMB.toFixed(1)} MB`,                                     'color:#94a3b8', 'color:#a78bfa;font-weight:600')
        console.log(`%cJitter — steady state (ms)%c ${metricsCalculator.jitter().toFixed(2)} ms`,'color:#94a3b8', 'color:#fbbf24;font-weight:600')
        console.log(`%cCompilation spike (ms)%c ${metricsCalculator.compilationSpike.toFixed(2)} ms`, 'color:#94a3b8', 'color:#f87171;font-weight:600')
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
  }, [])

  // ─── Rebuild cuando cambia count ──────────────────────────────────────────
  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return
    rebuildMaterials(scene, count)
  }, [count])

  return (
    <main className="relative w-full h-screen bg-[#050505] overflow-hidden">
      <PerformanceOverlay
        title={`Babylon PBR: ${count} Shaders Complejos`}
        input={true}
        count={count}
        setCount={setCount}
        inputConfig={{ unit: 'normal', type: 'values', values: [8, 16, 32, 64, 128] }}
      />
      <div className="absolute inset-0 pointer-events-none z-10">
        {isLoading && <Loader3D />}
      </div>
      <canvas ref={canvasRef} className="w-full h-full outline-none block" />
    </main>
  )
}