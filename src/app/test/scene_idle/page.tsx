'use client'

import { useEffect, useRef } from 'react'
import { 
  Engine, 
  Scene, 
  Vector3, 
  HemisphericLight, 
  SpotLight, 
  Color3, 
  Color4,
  ShadowGenerator,
  ArcRotateCamera
} from '@babylonjs/core'
import { RoomGenerator } from '@/app/game/RoomGenerator'
import PerformanceOverlay from '@/components/test/PerformanceOverlay'
import DebugTools from '@/components/DebugTools'
import { setState } from '@/app/game/gameState'

export default function SceneIdleTest() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!canvasRef.current) return
    
    const canvas = canvasRef.current
    const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true })
    
    // Create the scene
    const scene = new Scene(engine)
    scene.clearColor = Color4.FromColor3(Color3.FromHexString("#050505"), 1)
    
    // Setup Camera (Converting from R3F [5, 1.6, 5] position)
    // In R3F it's a perspective camera. In Babylon we use ArcRotateCamera for idle views normally,
    // but here we want a static camera.
    const camera = new ArcRotateCamera(
      "camera", 
      Math.PI / 4, 
      Math.PI / 3, 
      Math.sqrt(5*5 + 1.6*1.6 + 5*5), 
      new Vector3(0, 0, 0), 
      scene
    )
    camera.setPosition(new Vector3(5, 1.6, 5))
    // No interaction as set in the original OrbitControls
    camera.detachControl()

    // Lighting
    // Ambient Light (0.5 intensity)
    const ambientLight = new HemisphericLight("ambient", new Vector3(0, 1, 0), scene)
    ambientLight.intensity = 0.5
    ambientLight.diffuse = new Color3(1, 1, 1)

    // Spot Light (position [10, 10, 10], intensity 2, shadows)
    const spotLight = new SpotLight(
      "spotLight", 
      new Vector3(10, 10, 10), 
      new Vector3(-1, -1, -1), // Looking towards origin
      0.15 * 2, // Babylon angle is full angle, R3F angle is half angle? Actually R3F angle is full angle too?
      1, // Penumbra
      scene
    )
    spotLight.intensity = 2
    
    // Shadows
    const shadowGenerator = new ShadowGenerator(1024, spotLight)
    shadowGenerator.useBlurExponentialShadowMap = true
    shadowGenerator.blurKernel = 32

    // Load Room (if we want to measure "escena principal cargada")
    // Note: The original R3F code didn't actually mount the RoomGenerator in the return!
    // But since the description says "scene loaded", we should load it.
    new RoomGenerator(scene, shadowGenerator)

    // Render loop
    engine.runRenderLoop(() => {
      // Update FPS state for the overlay
      setState({ fps: engine.getFps() })
      scene.render()
    })

    // Resize handler
    const handleResize = () => engine.resize()
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      scene.dispose()
      engine.dispose()
    }
  }, [])

  return (
    <main className="w-full h-screen bg-[#050505] overflow-hidden relative">
      <PerformanceOverlay title="Escena Idle (60s)" />
      <DebugTools />
      
      <canvas
        ref={canvasRef}
        className="block w-full h-full outline-none touch-none"
      />

      <div className="fixed bottom-0 left-0 w-full p-8 text-white/10 text-[10px] pointer-events-none text-center font-mono">
        STABLE MAPPED GEOMETRY - IDLE NO-INPUT MODE (BABYLON ENGINE)
      </div>
    </main>
  )
}
