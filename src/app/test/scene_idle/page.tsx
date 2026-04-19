'use client'

import { useEffect, useRef, useState } from 'react'
import {
  ArcRotateCamera,
  Color4,
  Engine,
  HemisphericLight,
  Scene,
  Vector3,
} from '@babylonjs/core'

import PerformanceOverlay from '@/components/test/PerformanceOverlay'
import DebugTools from '@/components/DebugTools'

export default function SceneIdleTest() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [sceneState, setSceneState] = useState<{ scene: Scene; engine: Engine } | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const engine = new Engine(canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
    })

    const scene = new Scene(engine)
    scene.clearColor = new Color4(0.02, 0.02, 0.02, 1)

    // Cámara equivalente a OrbitControls + cámara lateral
    const camera = new ArcRotateCamera(
      'camera',
      0, // alpha
      Math.PI / 2, // beta
      120, // radius
      Vector3.Zero(),
      scene
    )

    camera.fov = 50 * (Math.PI / 180)
    camera.attachControl(canvas, true)

    // Luz suave para mantener la escena consistente
    const light = new HemisphericLight('hemLight', new Vector3(0, 1, 0), scene)
    light.intensity = 0.6

    // Entorno base. Si luego quieres un look más "forest", aquí puedes enchufar
    // un env texture/HDR propio.
    scene.createDefaultEnvironment({
      createGround: false,
      createSkybox: true,
      skyboxSize: 1000,
    })

    setSceneState({ scene, engine })

    engine.runRenderLoop(() => {
      scene.render()
    })

    const handleResize = () => {
      engine.resize()
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      setSceneState(null)
      scene.dispose()
      engine.dispose()
    }
  }, [])

  return (
    <main className="w-full h-screen bg-[#050505] overflow-hidden">
      <PerformanceOverlay title="Escena Idle (60s)" />
      {sceneState && <DebugTools scene={sceneState.scene} engine={sceneState.engine} title="scene_idle" />}

      <canvas
        ref={canvasRef}
        className="w-full h-full block outline-none"
      />
    </main>
  )
}