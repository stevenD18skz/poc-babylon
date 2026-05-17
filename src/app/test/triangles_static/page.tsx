'use client'

import { useRef, useEffect, useState } from 'react'
import * as BABYLON from '@babylonjs/core'
import PerformanceOverlay from '@/components/test/PerformanceOverlay'

const SAMPLE_SIZE = 180 // 1.8s a 100Hz


// Helper para convertir HSL a RGB en rango [0, 1]
function hslToRgb(h: number, s: number, l: number) {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  let r = 0, g = 0, b = 0

  if (h >= 0 && h < 60) { r = c; g = x; b = 0 }
  else if (h >= 60 && h < 120) { r = x; g = c; b = 0 }
  else if (h >= 120 && h < 180) { r = 0; g = c; b = x }
  else if (h >= 180 && h < 240) { r = 0; g = x; b = c }
  else if (h >= 240 && h < 300) { r = x; g = 0; b = c }
  else if (h >= 300 && h < 360) { r = c; g = 0; b = x }

  return { r: r + m, g: g + m, b: b + m }
}

export default function TrianglesStaticTest() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [count, setCount] = useState(10200)

  const engineRef = useRef<BABYLON.Engine | null>(null)
  const meshRef = useRef<BABYLON.Mesh | null>(null)
  const stateRef = useRef({ pendingLoadTime: true })

  const metricsRef = useRef({
    loadTime: 0,
    startTime: performance.now(),
    samples: new Float32Array(SAMPLE_SIZE),
    sampleIndex: 0,
    sampleFilled: 0,
    lastLogTime: performance.now(),
    periodMaxFrameTime: 0, // pico del período actual, no acumulativo
  })


  // Inicialización de la escena (solo una vez)
  useEffect(() => {



    if (!canvasRef.current) return

    if (!engineRef.current) {
      metricsRef.current.startTime = performance.now()

      const engine = new BABYLON.Engine(canvasRef.current, true, {
        stencil: true,
        antialias: true
      })
      engineRef.current = engine

      const scene = new BABYLON.Scene(engine)
      scene.clearColor = BABYLON.Color4.FromHexString("#050505FF")

      const sceneInstrumentation = new BABYLON.SceneInstrumentation(scene)
      sceneInstrumentation.captureActiveMeshesEvaluationTime = true
      sceneInstrumentation.captureRenderTargetsRenderTime = true
      sceneInstrumentation.captureFrameTime = true  // tiempo total del frame en CPU
      sceneInstrumentation.captureRenderTime = true  // tiempo del render() en CPU


      // Cámara
      const camera = new BABYLON.ArcRotateCamera(
        "camera",
        Math.PI / 4,
        Math.PI / 4,
        34.64,
        BABYLON.Vector3.Zero(),
        scene
      )
      camera.setPosition(new BABYLON.Vector3(0, 65, 0))
      camera.fov = 50 * (Math.PI / 180)

      // Iluminación (equivalente a ambientLight intensity=1)
      const light = new BABYLON.HemisphericLight("ambient", new BABYLON.Vector3(0, 1, 0), scene)
      light.diffuse = new BABYLON.Color3(1, 1, 1)
      light.groundColor = new BABYLON.Color3(1, 1, 1)
      light.specular = new BABYLON.Color3(0, 0, 0)
      light.intensity = 1

      // Geometría: cono radio 0.2 (diametro 0.4), altura 0.4, 8 segmentos
      const cone = BABYLON.MeshBuilder.CreateCylinder("cone", {
        diameterTop: 0,
        diameterBottom: 0.4,
        height: 0.4,
        tessellation: 8
      }, scene)

      const material = new BABYLON.StandardMaterial("coneMat", scene)
      cone.material = material

      meshRef.current = cone

      // Instrumentación para métricas
      // (Se accede a los draw calls directamente desde el engine en Babylon)      
      const engineInstrumentation = new BABYLON.EngineInstrumentation(engine)
      engineInstrumentation.captureGPUFrameTime = true

      // Reemplaza el engine.runRenderLoop completo por esto:
      engine.runRenderLoop(() => {
        scene.render()

        const now = performance.now()
        const delta = engine.getDeltaTime() // ms reales entre frames

        if (stateRef.current.pendingLoadTime) {
          metricsRef.current.loadTime = now - metricsRef.current.startTime
          stateRef.current.pendingLoadTime = false
        }

        const m = metricsRef.current

        // Acumular muestras de delta real
        m.samples[m.sampleIndex] = delta
        m.sampleIndex = (m.sampleIndex + 1) % SAMPLE_SIZE
        m.sampleFilled = Math.min(m.sampleFilled + 1, SAMPLE_SIZE)

        // Pico del período actual
        if (delta > m.periodMaxFrameTime) m.periodMaxFrameTime = delta

        if (now - m.lastLogTime >= 10_000) {
          m.lastLogTime = now

          // ── Frame time y jitter desde muestras reales ──
          let frameTime = 0
          let jitter = 0
          let p95 = 0

          if (m.sampleFilled >= 2) {
            let sum = 0
            for (let i = 0; i < m.sampleFilled; i++) sum += m.samples[i]
            frameTime = sum / m.sampleFilled

            let variance = 0
            for (let i = 0; i < m.sampleFilled; i++) {
              const diff = m.samples[i] - frameTime
              variance += diff * diff
            }
            jitter = Math.sqrt(variance / m.sampleFilled)

            // P95
            const sorted = m.samples.slice(0, m.sampleFilled).sort()
            p95 = sorted[Math.floor(m.sampleFilled * 0.95)]
          }

          // FPS promedio real (desde frameTime medio, no getFps())
          const avgFps = frameTime > 0 ? 1000 / frameTime : 0

          // GPU time: solo reportar si el valor es > 0 (el driver lo soporta)
          // En Vega 7 casi siempre será 0 — se reporta como N/A para ser honesto
          const gpuRaw = (engineInstrumentation.gpuFrameTimeCounter?.current || 0) / 1_000_000
          const gpuMs = gpuRaw > 0.01 ? gpuRaw.toFixed(2) + ' ms' : 'N/A (driver)'

          // RAM
          const perf = performance as any
          const ramMB = perf.memory ? (perf.memory.usedJSHeapSize / 1_048_576).toFixed(1) : 'N/A'

          // Draw calls via SceneInstrumentation (API pública correcta)
          const drawCalls = sceneInstrumentation.drawCallsCounter?.current ?? 0

          const currentCount = cone.thinInstanceCount || 0

          // VRAM: posiciones + normales + UVs + índices + matrices + colores
          const totalVerts = cone.getTotalVertices()
          const totalIdx = cone.getTotalIndices()
          const posBytes = totalVerts * 3 * 4  // vec3 float
          const normalBytes = totalVerts * 3 * 4  // vec3 float
          const uvBytes = totalVerts * 2 * 4  // vec2 float
          const idxBytes = totalIdx * 2        // uint16
          const matBytes = currentCount * 16 * 4 // mat4 float
          const colBytes = currentCount * 4 * 4  // vec4 float
          const vramMB = ((posBytes + normalBytes + uvBytes + idxBytes + matBytes + colBytes) / 1_048_576).toFixed(2)

          const triangles = (totalIdx / 3) * currentCount

          const cpuFrameMs = sceneInstrumentation.frameTimeCounter?.current ?? 0
          const cpuRenderMs = sceneInstrumentation.renderTimeCounter?.current ?? 0

          console.log(
            `%c[Babylon Static] ${currentCount.toLocaleString()} instancias — ${new Date().toLocaleTimeString()}`,
            'color:#3b82f6;font-weight:700;font-size:12px',
          )
          console.log(`%cFPS Promedio         %c${avgFps.toFixed(1)}`, 'color:#94a3b8', 'color:#f1f5f9;font-weight:600')
          console.log(`%cRAM                  %c${ramMB} MB`, 'color:#94a3b8', 'color:#f1f5f9;font-weight:600')
          console.log(`%cVRAM Estimada        %c${vramMB} MB`, 'color:#94a3b8', 'color:#f1f5f9;font-weight:600')
          console.log(`%cGPU (ms/frame)       %c${gpuMs}`, 'color:#94a3b8', 'color:#60a5fa;font-weight:600')
          console.log(`%cCPU Frame total      %c${cpuFrameMs.toFixed(2)} ms`, 'color:#94a3b8', 'color:#f1f5f9;font-weight:600')
          console.log(`%cCPU Render           %c${cpuRenderMs.toFixed(2)} ms`, 'color:#94a3b8', 'color:#f1f5f9;font-weight:600')
          console.log(`%cFrame Time (media)   %c${frameTime.toFixed(2)} ms`, 'color:#94a3b8', 'color:#f1f5f9;font-weight:600')
          console.log(`%cFrame Time (P95)     %c${p95.toFixed(2)} ms`, 'color:#94a3b8', 'color:#fbbf24;font-weight:600')
          console.log(`%cJitter               %c${jitter.toFixed(2)} ms`, 'color:#94a3b8', 'color:#f1f5f9;font-weight:600')
          console.log(`%cLoad Time            %c${m.loadTime.toFixed(1)} ms`, 'color:#94a3b8', 'color:#f1f5f9;font-weight:600')
          console.log(`%cDraw Calls           %c${drawCalls}`, 'color:#94a3b8', 'color:#f1f5f9;font-weight:600')
          console.log(`%cTriángulos GPU       %c${triangles.toLocaleString()}`, 'color:#94a3b8', 'color:#f1f5f9;font-weight:600')
          console.log(`%cPico latencia (10s)  %c${m.periodMaxFrameTime.toFixed(2)} ms`, 'color:#94a3b8', 'color:#f87171;font-weight:600')
          //console.groupEnd()

          // Reset pico del período
          m.periodMaxFrameTime = 0
        }
      })

      const resizeHandler = () => engine.resize()
      window.addEventListener('resize', resizeHandler)

      return () => {
        window.removeEventListener('resize', resizeHandler)
        engine.dispose()
        engineRef.current = null
      }
    }
  }, []) // Se ejecuta una sola vez al montar

  // Actualización de las instancias (Thin Instances) al cambiar el count
  useEffect(() => {
    if (!meshRef.current) return

    // Reiniciar medición de tiempo de carga para esta nueva cantidad
    metricsRef.current.startTime = performance.now()
    stateRef.current.pendingLoadTime = true

    const cone = meshRef.current
    const matricesData = new Float32Array(16 * count)
    const colorData = new Float32Array(4 * count)
    const tempMatrix = BABYLON.Matrix.Identity()

    for (let i = 0; i < count; i++) {
      const radius = 10 + Math.random() * 15
      const theta = Math.random() * Math.PI * 2
      const phi = Math.random() * Math.PI

      const x = radius * Math.sin(phi) * Math.cos(theta)
      const y = radius * Math.sin(phi) * Math.sin(theta)
      const z = radius * Math.cos(phi)

      const rx = Math.random() * Math.PI
      const ry = Math.random() * Math.PI
      const rz = Math.random() * Math.PI

      BABYLON.Matrix.RotationYawPitchRollToRef(ry, rx, rz, tempMatrix)
      tempMatrix.setTranslationFromFloats(x, y, z)
      tempMatrix.copyToArray(matricesData, i * 16)

      const h = Math.random() * 50 + 200
      const { r, g, b } = hslToRgb(h, 0.8, 0.5)
      colorData[i * 4] = r
      colorData[i * 4 + 1] = g
      colorData[i * 4 + 2] = b
      colorData[i * 4 + 3] = 1.0
    }

    // Actualizar los buffers de las thin instances de forma estática
    cone.thinInstanceSetBuffer("matrix", matricesData, 16, true)
    cone.thinInstanceSetBuffer("color", colorData, 4, true)

  }, [count])

  return (
    <main className="relative w-full h-screen bg-[#050505] overflow-hidden">
      <PerformanceOverlay
        title={`${count} Triángulos Estáticos`}
        input={true}
        count={count}
        setCount={setCount}
        inputConfig={{
          unit: 'thousands',
          type: 'values',
          step: 1000,
          values: [1000, 4000, 16000, 64000, 256000, 1024000],
        }}
      />
      <canvas ref={canvasRef} className="w-full h-full outline-none" />
    </main>
  )
}