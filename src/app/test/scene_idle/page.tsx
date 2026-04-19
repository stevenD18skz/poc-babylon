'use client'

import { useEffect, useRef, useState } from 'react'
import { 
  Engine, 
  Scene, 
  Vector3, 
  HemisphericLight, 
  Color3, 
  Color4,
  ArcRotateCamera,
  MeshBuilder,
  StandardMaterial
} from '@babylonjs/core'
import PerformanceOverlay from '@/components/test/PerformanceOverlay'
import dynamic from 'next/dynamic'
const DebugTools = dynamic(() => import('@/components/DebugTools'), { ssr: false })
import { setState } from '@/app/game/gameState'

export default function SceneIdleTest() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [sceneState, setSceneState] = useState<{ scene: Scene, engine: Engine } | null>(null)

  useEffect(() => {
    if (!canvasRef.current) return
    
    const canvas = canvasRef.current
    const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true })
    
    // Create the scene
    const scene = new Scene(engine)
    scene.clearColor = Color4.FromColor3(Color3.FromHexString("#050505"), 1)
    
    // Setup Camera
    const camera = new ArcRotateCamera(
      "camera", 
      -Math.PI / 2, 
      Math.PI / 2.5, 
      10, 
      new Vector3(0, 0, 0), 
      scene
    )
    camera.attachControl(canvas, true)

    // Lighting
    const light = new HemisphericLight("light", new Vector3(0, 1, 0), scene)
    light.intensity = 0.7

    // Environment
    scene.createDefaultEnvironment({
        createGround: true,
        groundSize: 100,
        skyboxSize: 100,
        groundColor: new Color3(0.02, 0.02, 0.02)
    })

    // Central Square (Cube)
    const box = MeshBuilder.CreateBox("box", { size: 2 }, scene)
    const boxMaterial = new StandardMaterial("boxMat", scene)
    boxMaterial.diffuseColor = new Color3(0.4, 0.4, 1)
    box.material = boxMaterial
    box.position.y = 1

    // Render loop
    engine.runRenderLoop(() => {
      setState({ fps: engine.getFps() })
      scene.render()
    })

    // Resize handler
    const handleResize = () => engine.resize()
    window.addEventListener('resize', handleResize)

    setSceneState({ scene, engine })

    return () => {
      window.removeEventListener('resize', handleResize)
      scene.dispose()
      engine.dispose()
    }
  }, [])

  return (
    <main className="w-full h-screen bg-[#050505] overflow-hidden relative">
      <PerformanceOverlay title="Escena Vacía con Cubo" />
      {sceneState && <DebugTools scene={sceneState.scene} engine={sceneState.engine} />}
      
      <canvas
        ref={canvasRef}
        className="block w-full h-full outline-none touch-none"
      />
    </main>
  )
}
