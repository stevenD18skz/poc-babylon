'use client'

import { useRef, useEffect, useState } from 'react'
import * as BABYLON from '@babylonjs/core'
import PerformanceOverlay from '@/components/test/PerformanceOverlay'

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
  const [count, setCount] = useState(1024000)
  
  const engineRef = useRef<BABYLON.Engine | null>(null)
  const meshRef = useRef<BABYLON.Mesh | null>(null)
  const stateRef = useRef({ pendingLoadTime: true })

  const metricsRef = useRef({
    loadTime: 0,
    startTime: performance.now(),
    samples: new Float32Array(60),
    sampleIndex: 0,
    sampleFilled: 0,
    lastLogTime: performance.now()
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

      engine.runRenderLoop(() => {
        scene.render()
        
        const now = performance.now()
        
        if (stateRef.current.pendingLoadTime) {
          metricsRef.current.loadTime = now - metricsRef.current.startTime
          stateRef.current.pendingLoadTime = false
        }

        const delta = engine.getDeltaTime()
        const m = metricsRef.current
        
        m.samples[m.sampleIndex] = delta
        m.sampleIndex = (m.sampleIndex + 1) % 60
        m.sampleFilled = Math.min(m.sampleFilled + 1, 60)

        // Console log cada 3 segundos
        if (now - m.lastLogTime >= 10_000) {
          m.lastLogTime = now

          let jitter = 0
          let frameTime = 0
          
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
          }

          const fps = engine.getFps()
          const gpuMs = (engineInstrumentation.gpuFrameTimeCounter?.current || 0) / 1000000
          const cpuMs = Math.max(0, frameTime - gpuMs)
          
          // Memoria RAM (si está disponible en el navegador, ej. Chrome)
          const perf = performance as any
          const ramMb = perf.memory ? perf.memory.usedJSHeapSize / 1048576 : 0
          
          const drawCalls = (engine as any)._drawCalls?.current || 1
          const currentCount = meshRef.current?.thinInstanceCount || 0

          const avgFps = fps
          const ramMB = ramMb > 0 ? ramMb.toFixed(1) : 'N/A'
          
          // Estimación simple de VRAM: (Indices + Posiciones + Colores) * instancias
          const indicesSize = (meshRef.current?.getTotalIndices() || 0) * 2
          const vertexSize = (meshRef.current?.getTotalVertices() || 0) * (3 * 4)
          const thinInstanceSize = currentCount * (16 * 4 + 4 * 4)
          const vramMB = ((indicesSize + vertexSize + thinInstanceSize) / 1048576).toFixed(2)
          
          const triangles = (meshRef.current?.getTotalIndices() || 0) / 3 * currentCount

          console.groupCollapsed(
            `%c[Babylon Static] ${new Date().toLocaleTimeString()}`,
            'color:#3b82f6;font-weight:700;font-size:12px',
          )
          console.log(`%cFPS Promedio     %c${avgFps.toFixed(1)}`, 'color:#94a3b8', 'color:#f1f5f9;font-weight:600')
          console.log(`%cGPU (ms/frame)   %c${gpuMs.toFixed(2)} ms`, 'color:#94a3b8', 'color:#f1f5f9;font-weight:600')
          console.log(`%cCPU (ms/frame)   %c${cpuMs.toFixed(2)} ms`, 'color:#94a3b8', 'color:#f1f5f9;font-weight:600')
          console.log(`%cRAM              %c${ramMB} MB`, 'color:#94a3b8', 'color:#f1f5f9;font-weight:600')
          console.log(`%cVRAM Estimada    %c${vramMB} MB`, 'color:#94a3b8', 'color:#f1f5f9;font-weight:600')
          console.log(`%cDraw Calls       %c${drawCalls}`, 'color:#94a3b8', 'color:#f1f5f9;font-weight:600')
          console.log(`%cTriángulos       %c${triangles.toLocaleString()}`, 'color:#94a3b8', 'color:#f1f5f9;font-weight:600')

          console.log(`%cFrame Time       %c${frameTime.toFixed(2)} ms`, 'color:#94a3b8', 'color:#f1f5f9;font-weight:600')
          console.log(`%cJitter           %c${jitter.toFixed(2)} ms`, 'color:#94a3b8', 'color:#f1f5f9;font-weight:600')
          console.log(`%cLoad Time        %c${metricsRef.current.loadTime.toFixed(1)} ms`, 'color:#94a3b8', 'color:#f1f5f9;font-weight:600')
          console.groupEnd()
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