'use client'

import { useEffect, useRef } from 'react'
import * as BABYLON from '@babylonjs/core'
import '@babylonjs/core/Helpers/sceneHelpers'
import '@babylonjs/core/Rendering/edgesRenderer'

// ─── Tipos helpers ──────────────────────────────────────────────────────────
interface PerfMemory extends Performance {
  memory?: {
    usedJSHeapSize: number
    totalJSHeapSize: number
    jsHeapSizeLimit: number
  }
}

// ─── Estimación VRAM: suma de todas las texturas activas ────────────────────
function estimateVRAM(scene: BABYLON.Scene): number {
  let bytes = 0
  for (const tex of scene.textures) {
    if (!tex || !(tex instanceof BABYLON.Texture)) continue
    const size = (tex as BABYLON.Texture).getSize?.()
    if (!size) continue
    // RGBA8 = 4 bytes/px, mipmap factor ~1.33
    bytes += size.width * size.height * 4 * 1.33
  }
  // CubeTextures cuentan x6 caras
  for (const tex of scene.textures) {
    if (tex instanceof BABYLON.CubeTexture) {
      const size = (tex as any)._size ?? 256
      bytes += size * size * 4 * 6
    }
  }
  return bytes / 1_048_576
}

// ─── Triángulos activos en escena ───────────────────────────────────────────
function countTriangles(scene: BABYLON.Scene): number {
  let total = 0
  scene.getActiveMeshes().data.forEach((mesh: BABYLON.AbstractMesh) => {
    if (!mesh || !mesh.isEnabled() || !mesh.isVisible) return
    if ('getTotalIndices' in mesh) {
      total += (mesh as BABYLON.Mesh).getTotalIndices() / 3
    }
  })
  return Math.round(total)
}

// ─── Componente principal ───────────────────────────────────────────────────
export default function SceneIdleTestBabylon() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!canvasRef.current) return

    // ── Engine ──────────────────────────────────────────────────────────────
    const engine = new BABYLON.Engine(canvasRef.current, true, {
      preserveDrawingBuffer: true,
      stencil: true,
      powerPreference: 'high-performance',
    })

    // ── Scene ───────────────────────────────────────────────────────────────
    const scene = new BABYLON.Scene(engine)
    scene.clearColor = new BABYLON.Color4(0.02, 0.02, 0.02, 1)

    // ── Camera (equivalente a camera={{ position: [120,0,0], fov:50 }}) ─────
    const camera = new BABYLON.ArcRotateCamera(
      'camera',
      -Math.PI / 2,   // alpha  → apunta al frente
      Math.PI / 2,    // beta   → altura media
      120,            // radius → misma distancia que el R3F
      BABYLON.Vector3.Zero(),
      scene,
    )
    camera.fov = 50 * (Math.PI / 180)          // 50° en radianes
    camera.minZ = 0.1
    camera.maxZ = 10_000
    camera.attachControl(canvasRef.current, true)
    // Damping suave (similar al OrbitControls default)
    camera.inertia = 0.6
    camera.panningInertia = 0.6

    // ── HDR Texture ─────────────────────────────────────────────────────────────
    const hdrTexture = new BABYLON.HDRCubeTexture(
      '/textures/forest_slope_1k.hdr',
      scene,
      256,    // Three.js PMREMGenerator usa 256 internamente
      false,  // noMipmap: false → genera mipmaps (igual que Three.js)
      true,   // generateHarmonics: true → IBL difuso (equivalente al SH de Three.js)
      // si lo pones false pierdes la iluminación ambiental suave
      false,  // gammaSpace: false → HDR es espacio lineal, no gamma
      false,  // prefiltered: false → el archivo no está pre-filtrado
    )
    scene.environmentIntensity = 1.0  // R3F default es 1.0
    scene.environmentTexture = hdrTexture

    // ── Skybox ───────────────────────────────────────────────────────────────────
    const skybox = BABYLON.MeshBuilder.CreateBox(
      'skyBox',
      { size: 5_000 },
      scene,
    )
    const skyboxMat = new BABYLON.StandardMaterial('skyBoxMat', scene)
    skyboxMat.backFaceCulling = false
    skyboxMat.reflectionTexture = hdrTexture.clone()
    skyboxMat.reflectionTexture.coordinatesMode = BABYLON.Texture.SKYBOX_MODE
    skyboxMat.diffuseColor = new BABYLON.Color3(0, 0, 0)
    skyboxMat.specularColor = new BABYLON.Color3(0, 0, 0)
    skybox.material = skyboxMat
    skybox.isPickable = false

    // ── Instrumentación de la Escena (CPU) ──────────────────────────────────
    const sceneInst = new BABYLON.SceneInstrumentation(scene)
    sceneInst.captureFrameTime = true       // CPU total frame (ms)
    sceneInst.captureRenderTime = true      // render-only CPU (ms)

    // ── Instrumentación del Motor (GPU) ─────────────────────────────────────
    const engineInst = new BABYLON.EngineInstrumentation(engine)
    engineInst.captureGPUFrameTime = true   // Habilita la lectura de la GPU


    // Draw calls: se capturan en el observable afterRenderObservable
    let drawCallsSnapshot = 0
    scene.onAfterRenderObservable.add(() => {
      // engine._drawCalls es interno pero confiable en Babylon ≥ 5
      drawCallsSnapshot = (engine as any)._drawCalls?.current ?? 0
    })

    // ── Buffer de FPS para promedio ──────────────────────────────────────────
    const fpsSamples: number[] = []

    // ── Loop de render ───────────────────────────────────────────────────────
    engine.runRenderLoop(() => scene.render())

    // ── Métricas cada 3 s ────────────────────────────────────────────────────
    const INTERVAL_MS = 5_000
    const metricInterval = setInterval(() => {
      // FPS promedio (ventana de últimas 10 muestras)
      const currentFps = engine.getFps()
      fpsSamples.push(currentFps)
      if (fpsSamples.length > 10) fpsSamples.shift()
      const avgFps =
        fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length

      // AHORA:
      const gpuNs = engineInst.gpuFrameTimeCounter.current
      const gpuMs = gpuNs > 0 ? (gpuNs / 1_000_000) : 0

      // CPU ms/frame (tiempo total por frame incluyendo JS + render)
      const cpuMs = sceneInst.frameTimeCounter.current

      // RAM (Chrome / Edge solamente; otros devuelven N/A)
      const mem = (performance as PerfMemory).memory
      const ramMB = mem
        ? (mem.usedJSHeapSize / 1_048_576).toFixed(1)
        : 'N/A (API no disponible)'

      // VRAM estimada
      const vramMB = estimateVRAM(scene).toFixed(1)

      // Draw calls
      const drawCalls = drawCallsSnapshot

      // Triángulos
      const triangles = countTriangles(scene)

      console.groupCollapsed(
        `%c[Babylon Baseline] ${new Date().toLocaleTimeString()}`,
        'color:#7c3aed;font-weight:700;font-size:12px',
      )
      console.log(`%cFPS Promedio     %c${avgFps.toFixed(1)}`, 'color:#94a3b8', 'color:#f1f5f9;font-weight:600')
      console.log(`%cGPU (ms/frame)   %c${gpuMs.toFixed(2)} ms`, 'color:#94a3b8', 'color:#f1f5f9;font-weight:600')
      console.log(`%cCPU (ms/frame)   %c${cpuMs.toFixed(2)} ms`, 'color:#94a3b8', 'color:#f1f5f9;font-weight:600')
      console.log(`%cRAM              %c${ramMB} MB`, 'color:#94a3b8', 'color:#f1f5f9;font-weight:600')
      console.log(`%cVRAM Estimada    %c${vramMB} MB`, 'color:#94a3b8', 'color:#f1f5f9;font-weight:600')
      console.log(`%cDraw Calls       %c${drawCalls}`, 'color:#94a3b8', 'color:#f1f5f9;font-weight:600')
      console.log(`%cTriángulos       %c${triangles.toLocaleString()}`, 'color:#94a3b8', 'color:#f1f5f9;font-weight:600')
      console.groupEnd()
    }, INTERVAL_MS)

    // ── Resize ───────────────────────────────────────────────────────────────
    const handleResize = () => engine.resize()
    window.addEventListener('resize', handleResize)

    // ── Cleanup ───────────────────────────────────────────────────────────────
    return () => {
      clearInterval(metricInterval)
      window.removeEventListener('resize', handleResize)
      sceneInst.dispose()
      engineInst.dispose()
      scene.dispose()
      engine.dispose()
    }
  }, [])

  return (
    <main className="w-full h-screen bg-[#050505] overflow-hidden">
      <canvas
        ref={canvasRef}
        className="w-full h-full outline-none"
        style={{ touchAction: 'none' }} // necesario para pointer events en Babylon
      />
    </main>
  )
}