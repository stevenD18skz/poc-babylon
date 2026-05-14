'use client'

import { useEffect, useRef, useState } from 'react'
import * as BABYLON from '@babylonjs/core'
import PerformanceOverlay from '@/components/test/PerformanceOverlay'
import DebugTools from '@/components/DebugTools'
import Loader3D from '@/components/ui/Loader3D'

// ─── MÉTRICAS Y HUD (Idénticos al test de R3F) ───────────────────────────────
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

function DynamicLightsHUD({ metrics, count }: { metrics: any, count: number }) {
  const stats = useRef({ ftSum: 0, jSum: 0, samples: 0 })

  useEffect(() => {
    stats.current.ftSum += metrics.frameTime
    stats.current.jSum += metrics.jitter
    stats.current.samples++
  }, [metrics])

  useEffect(() => {
    const interval = setInterval(() => {
      if (stats.current.samples > 0) {
        const n = stats.current.samples
        const avgFT = stats.current.ftSum / n
        const avgJ = stats.current.jSum / n

        console.log(
          `%c[5s Avg - Dynamic Lights] FT: ${avgFT.toFixed(2)}ms | Scripting Time: ~0.5ms | Shader Complexity: ${count} Luces | Pixel Fill Rate: ${avgFT.toFixed(2)}ms | Jitter: ${avgJ.toFixed(2)}ms`,
          'color: #facc15; font-weight: bold;'
        )

        stats.current.ftSum = 0
        stats.current.jSum = 0
        stats.current.samples = 0
      }
    }, 5000)
    return () => clearInterval(interval)
  }, [count])

  const jitterColor = metrics.jitter < 1 ? 'text-emerald-400' : metrics.jitter < 3 ? 'text-yellow-400' : 'text-red-400'

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 min-w-[190px]">
      <div className="bg-black/80 backdrop-blur-xl border border-slate-500/40 px-4 py-3 rounded-xl">
        <p className="text-gray-400 text-xs uppercase tracking-widest mb-1">Frame Time</p>
        <p className="text-2xl font-mono font-black text-slate-300">
          {metrics.frameTime.toFixed(2)}<span className="text-xs text-gray-500 ml-1">ms</span>
        </p>
      </div>
      <div className="bg-black/80 backdrop-blur-xl border border-yellow-500/40 px-4 py-3 rounded-xl">
        <p className="text-gray-400 text-xs uppercase tracking-widest mb-1">Shader Complexity</p>
        <p className="text-2xl font-mono font-black text-yellow-400">
          {count}<span className="text-xs text-gray-500 ml-1">Luces</span>
        </p>
      </div>
      <div className="bg-black/80 backdrop-blur-xl border border-blue-500/40 px-4 py-3 rounded-xl">
        <p className="text-gray-400 text-xs uppercase tracking-widest mb-1">Pixel Fill Rate (GPU)</p>
        <p className="text-2xl font-mono font-black text-blue-400">
          ~{metrics.frameTime.toFixed(2)}<span className="text-xs text-gray-500 ml-1">ms</span>
        </p>
      </div>
      <div className="bg-black/80 backdrop-blur-xl border border-yellow-500/40 px-4 py-3 rounded-xl">
        <p className="text-gray-400 text-xs uppercase tracking-widest mb-1">Jitter</p>
        <p className={`text-2xl font-mono font-black ${jitterColor}`}>
          {metrics.jitter.toFixed(2)}<span className="text-xs text-gray-500 ml-1">ms</span>
        </p>
      </div>
    </div>
  )
}

// ─── CONFIGURACIÓN DE PARÁMETROS ─────────────────────────────────────────────
const LIGHT_TYPE_OPTIONS: Record<string, number> = { PointLight: 0, SpotLight: 0, DirectionalLight: 0, HemisphereLight: 0 }
const LIGHT_RANGES: Record<string, number[]> = { PointLight: [1, 2, 4, 7], SpotLight: [1, 2, 4, 7], DirectionalLight: [1, 2, 4, 7], HemisphereLight: [1, 144, 320] }
const LIGHT_LABELS: Record<string, string> = { PointLight: 'Point Light', SpotLight: 'Spot Light', DirectionalLight: 'Directional Light', HemisphereLight: 'Hemisphere Light' }

// ─── COMPONENTE PRINCIPAL BABYLON ────────────────────────────────────────────
export default function DynamicLightsBabylonTest() {
  const [count, setCount] = useState(1)
  const [selectedLightType, setSelectedLightType] = useState<string>('PointLight')
  const [metrics, setMetrics] = useState({ jitter: 0, frameTime: 0 })
  const [isLoading, setIsLoading] = useState(true)

  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Referencias para limpiar y actualizar recursos sin recrear el motor
  const sceneRef = useRef<BABYLON.Scene | null>(null)
  const materialsRef = useRef<BABYLON.PBRMaterial[]>([])
  const shadowCastersRef = useRef<BABYLON.Mesh[]>([])
  const activeLightsData = useRef<any[]>([])

  // 1. Inicialización Base (Geometría Fija y Motor)
  useEffect(() => {
    if (!canvasRef.current) return

    const engine = new BABYLON.Engine(canvasRef.current, true, { preserveDrawingBuffer: true, stencil: true })
    const scene = new BABYLON.Scene(engine)
    scene.clearColor = new BABYLON.Color4(0.02, 0.02, 0.02, 1)
    sceneRef.current = scene

    // Cámara equivalente a position [0, 15, 25], fov: 50
    const camera = new BABYLON.ArcRotateCamera("camera", -Math.PI / 2, Math.PI / 3, 29.15, BABYLON.Vector3.Zero(), scene)
    camera.setPosition(new BABYLON.Vector3(0, 15, 25))
    camera.fov = 50 * (Math.PI / 180)
    camera.maxZ = 1000
    // Límite de ángulo polar maxPolarAngle={Math.PI / 2 - 0.05}
    camera.upperBetaLimit = Math.PI / 2 - 0.05
    camera.attachControl(canvasRef.current, true)

    // Helper para PBR Materials
    const createPBR = (name: string, hexColor: string, roughness: number, metallic: number) => {
      const mat = new BABYLON.PBRMaterial(name, scene)
      mat.albedoColor = BABYLON.Color3.FromHexString(hexColor)
      mat.roughness = roughness
      mat.metallic = metallic
      materialsRef.current.push(mat)
      return mat
    }

    // Geometría Estática
    const ground = BABYLON.MeshBuilder.CreatePlane("ground", { size: 40 }, scene)
    ground.rotation.x = Math.PI / 2 // Babylon plano rota invertido respecto a R3F
    ground.receiveShadows = true
    ground.material = createPBR("groundMat", "#111118", 0.4, 0.6)

    const createMesh = (type: string, name: string, pos: number[], args: any, matParams: any) => {
      let mesh;
      if (type === 'box') mesh = BABYLON.MeshBuilder.CreateBox(name, args, scene)
      else if (type === 'sphere') mesh = BABYLON.MeshBuilder.CreateSphere(name, args, scene)
      else if (type === 'cylinder') mesh = BABYLON.MeshBuilder.CreateCylinder(name, args, scene)

      if (mesh) {
        mesh.position.set(pos[0], pos[1], pos[2])
        mesh.receiveShadows = true
        mesh.material = createPBR(`${name}Mat`, matParams.c, matParams.r, matParams.m)
        shadowCastersRef.current.push(mesh)
      }
    }

    // 3 Boxes
    createMesh('box', 'b1', [-4, 1, -4], { width: 2, height: 2, depth: 2 }, { c: "#6366f1", r: 0.4, m: 0.3 })
    createMesh('box', 'b2', [0, 1.5, -4], { width: 2, height: 3, depth: 2 }, { c: "#8b5cf6", r: 0.4, m: 0.6 })
    createMesh('box', 'b3', [4, 1, -4], { width: 2, height: 2, depth: 2 }, { c: "#a78bfa", r: 0.4, m: 0.9 })

    // 3 Spheres
    createMesh('sphere', 's1', [-4, 1, 0], { diameter: 2, segments: 32 }, { c: "#ec4899", r: 0.2, m: 0.5 })
    createMesh('sphere', 's2', [0, 1, 0], { diameter: 2, segments: 32 }, { c: "#f43f5e", r: 0.2, m: 0.75 })
    createMesh('sphere', 's3', [4, 1, 0], { diameter: 2, segments: 32 }, { c: "#fb7185", r: 0.2, m: 1 })

    // 3 Cylinders
    createMesh('cylinder', 'c1', [-4, 1.5, 4], { diameter: 1.6, height: 3, tessellation: 32 }, { c: "#06b6d4", r: 0.3, m: 1 })
    createMesh('cylinder', 'c2', [0, 1.5, 4], { diameter: 1.6, height: 3, tessellation: 32 }, { c: "#0ea5e9", r: 0.3, m: 2 })
    createMesh('cylinder', 'c3', [4, 1.5, 4], { diameter: 1.6, height: 3, tessellation: 32 }, { c: "#38bdf8", r: 0.3, m: 3 })

    // Render Loop & Animation de luces CPU
    let frameCount = 0
    let lastTime = performance.now()
    const startAnimTime = performance.now()

    scene.onBeforeRenderObservable.add(() => {
      const now = performance.now()
      const delta = (now - lastTime) / 1000
      lastTime = now

      metricsCalculator.push(delta)
      frameCount++

      if (frameCount === 1) setIsLoading(false)
      if (frameCount % 10 === 0) setMetrics(metricsCalculator.compute())

      const t = (now - startAnimTime) * 0.001

      // Animación de luces activas
      activeLightsData.current.forEach(data => {
        const { type, light, mesh, index, total, speed } = data
        const localT = t * speed
        const angle = (index / total) * Math.PI * 2

        if (type === 'PointLight') {
          const radius = 8
          light.position.x = Math.cos(localT + angle) * radius
          light.position.z = Math.sin(localT + angle) * radius
          light.position.y = 3 + Math.sin(localT * 1.5 + angle) * 1.5
          if (mesh) mesh.position.copyFrom(light.position)
        }
        else if (type === 'SpotLight') {
          const radius = 10
          light.position.x = Math.cos(localT + angle) * radius
          light.position.z = Math.sin(localT + angle) * radius
          light.position.y = 8 + Math.sin(localT * 1.2 + angle) * 2

          if (mesh) mesh.position.copyFrom(light.position)

          // Mover objetivo y recalcular dirección
          const tx = Math.sin(localT * 0.5 + angle) * 2
          const tz = Math.cos(localT * 0.5 + angle) * 2
          light.direction = new BABYLON.Vector3(tx - light.position.x, 0 - light.position.y, tz - light.position.z).normalize()
        }
        else if (type === 'DirectionalLight') {
          light.position.x = Math.cos(localT + angle) * 15
          light.position.z = Math.sin(localT + angle) * 15
          light.position.y = 12 + Math.sin(localT * 0.8 + angle) * 4

          if (mesh) mesh.position.copyFrom(light.position)
          // Apuntar al centro (0,0,0)
          light.direction = BABYLON.Vector3.Zero().subtract(light.position).normalize()
        }
        else if (type === 'HemisphereLight') {
          const hue = (((index / total) * 360 + localT * 20) % 360)
          // Conversión rápida HSL a RGB en Babylon vía HSV (S=1, V=1)
          light.diffuse = BABYLON.Color3.FromHSV(hue, 1, 1)
          light.groundColor = BABYLON.Color3.FromHSV((hue + 180) % 360, 0.8, 0.3)
        }
      })
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
  }, []) // Solo se ejecuta una vez

  // 2. Lógica Dinámica de Luces (Se ejecuta al cambiar count o selectedLightType)
  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return

    // Ajustar Límite de PBR Materials para que todas las luces hagan efecto a la vez
    materialsRef.current.forEach(mat => {
      mat.maxSimultaneousLights = Math.max(4, count)
    })

    // Generar nuevas luces
    for (let i = 0; i < count; i++) {
      const speed = 0.3 + (i % 5) * 0.1
      const hue = (i / count) * 360
      const color = BABYLON.Color3.FromHSV(hue, 1, 1)

      let light: any
      let mesh: any
      let shadowGen: BABYLON.ShadowGenerator | null = null
      let mat: BABYLON.StandardMaterial | null = null

      if (selectedLightType !== 'HemisphereLight') {
        mat = new BABYLON.StandardMaterial(`lmat-${i}`, scene)
        mat.emissiveColor = color
        mat.disableLighting = true
      }

      if (selectedLightType === 'PointLight') {
        light = new BABYLON.PointLight(`pl-${i}`, BABYLON.Vector3.Zero(), scene)
        light.diffuse = color
        light.intensity = 10
        // Sphere visual helper
        mesh = BABYLON.MeshBuilder.CreateSphere(`pm-${i}`, { diameter: 0.3, segments: 8 }, scene)
        mesh.material = mat

        shadowGen = new BABYLON.ShadowGenerator(256, light)
        shadowGen.bias = 0.001

      } else if (selectedLightType === 'SpotLight') {
        // En Babylon SpotLight necesita dirección inicial
        light = new BABYLON.SpotLight(`sl-${i}`, BABYLON.Vector3.Zero(), new BABYLON.Vector3(0, -1, 0), Math.PI / 3, 2, scene)
        light.diffuse = color
        light.intensity = 30

        // Cone visual helper
        mesh = BABYLON.MeshBuilder.CreateCylinder(`sm-${i}`, { diameterTop: 0, diameterBottom: 0.3, height: 0.3, tessellation: 8 }, scene)
        mesh.material = mat
        mesh.rotation.x = Math.PI / 2

        shadowGen = new BABYLON.ShadowGenerator(256, light)
        shadowGen.bias = 0.001

      } else if (selectedLightType === 'DirectionalLight') {
        light = new BABYLON.DirectionalLight(`dl-${i}`, new BABYLON.Vector3(0, -1, 0), scene)
        light.diffuse = color
        light.intensity = 1.5

        // Box visual helper
        mesh = BABYLON.MeshBuilder.CreateBox(`dm-${i}`, { size: 0.25 }, scene)
        mesh.material = mat

        shadowGen = new BABYLON.ShadowGenerator(256, light)
        // Orthographic box bounds para la DirectionalLight
        light.autoUpdateExtends = false
        light.orthoLeft = -15
        light.orthoRight = 15
        light.orthoTop = 15
        light.orthoBottom = -15
        shadowGen.bias = 0.001

      } else if (selectedLightType === 'HemisphereLight') {
        light = new BABYLON.HemisphericLight(`hl-${i}`, new BABYLON.Vector3(0, 1, 0), scene)
        light.intensity = 0.8
      }

      // Añadir caster objects al shadow generator
      if (shadowGen) {
        shadowCastersRef.current.forEach(caster => {
          shadowGen!.addShadowCaster(caster)
        })
      }

      activeLightsData.current.push({
        type: selectedLightType,
        index: i,
        total: count,
        speed,
        light,
        mesh,
        shadowGen,
        mat
      })
    }

    return () => {
    const scene = sceneRef.current;
    
    // 1. CHEQUEO CRÍTICO: Si el motor ya destruyó la escena, no hacemos nada.
    if (!scene || scene.isDisposed) {
      activeLightsData.current = [];
      return;
    }

    // 2. ORDEN ESTRICTO DE DESTRUCCIÓN (Dependencias primero, base después)
    activeLightsData.current.forEach(data => {
      // A. Sombras y materiales primero
      if (data.shadowGen) data.shadowGen.dispose();
      if (data.mat) data.mat.dispose();
      
      // B. Mallas auxiliares (validando que sigan vivas)
      if (data.mesh && !data.mesh.isDisposed()) data.mesh.dispose();
      
      // C. Luces al final (cuando ya nada depende de ellas)
      if (data.light && !data.light.isDisposed()) data.light.dispose();
    });
    
    activeLightsData.current = [];
  }
  }, [count, selectedLightType])

  const selectOptions: Record<string, number> = Object.fromEntries(
    Object.keys(LIGHT_TYPE_OPTIONS).map((key) => [key, key === selectedLightType ? count : 0])
  )

  const handleLightTypeChange = (key: string) => {
    setSelectedLightType(key)
    const newRange = LIGHT_RANGES[key]
    if (!newRange.includes(count)) {
      setCount(newRange[0])
    }
  }

  return (
    <main className="relative w-full h-screen bg-[#050505] overflow-hidden">
      <PerformanceOverlay
        title={`${count} ${LIGHT_LABELS[selectedLightType]}s Dinámicas (Babylon)`}
        input={true}
        count={count}
        setCount={setCount}
        
        
        
      />

      <DynamicLightsHUD metrics={metrics} count={count} />

      <div className="absolute inset-0 pointer-events-none z-10">
        {isLoading && <Loader3D />}
      </div>

      <canvas
        ref={canvasRef}
        className="w-full h-full outline-none block"
      />
    </main>
  )
}