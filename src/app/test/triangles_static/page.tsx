'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Engine,
  Scene,
  ArcRotateCamera,
  Vector3,
  Color3,
  Color4,
  HemisphericLight,
  PointLight,
  MeshBuilder,
  StandardMaterial,
  Matrix
} from '@babylonjs/core'
import PerformanceOverlay from '@/components/test/PerformanceOverlay'
import DebugTools, { useDebugControls } from '@/components/DebugTools'

export default function TrianglesStaticTest() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [sceneState, setSceneState] = useState<{ scene: Scene, engine: Engine } | null>(null)
  const { triangles: countBase } = useDebugControls()
  
  // Hardcoded for the static stress test
  const count = 512_000 

  useEffect(() => {
    if (!canvasRef.current) return

    const canvas = canvasRef.current
    const engine = new Engine(canvas, true)
    const scene = new Scene(engine)
    scene.clearColor = Color4.FromColor3(Color3.FromHexString("#050505"), 1)

    const camera = new ArcRotateCamera("camera", 0, Math.PI / 2, 20, Vector3.Zero(), scene)
    camera.setPosition(new Vector3(20, 20, 20))
    camera.attachControl(canvas, true)
    camera.useAutoRotationBehavior = true
    if (camera.autoRotationBehavior) {
      camera.autoRotationBehavior.idleRotationSpeed = 0.5
    }

    const ambientLight = new HemisphericLight("ambient", new Vector3(0, 1, 0), scene)
    ambientLight.intensity = 0.5

    const p1 = new PointLight("p1", new Vector3(10, 10, 10), scene)
    p1.intensity = 2
    p1.diffuse = Color3.FromHexString("#4f46e5")

    const p2 = new PointLight("p2", new Vector3(-10, -10, -10), scene)
    p2.intensity = 1
    p2.diffuse = Color3.FromHexString("#9333ea")

    // Crear el mesh base
    const baseMesh = MeshBuilder.CreateCylinder("baseCone", { diameterTop: 0, diameterBottom: 0.2, height: 3, tessellation: 4 }, scene)
    const mat = new StandardMaterial("mat", scene)
    baseMesh.material = mat

    // Thin Instances (Extremely fast render of identical objects)
    const bufferMatrices = new Float32Array(count * 16)
    const bufferColors = new Float32Array(count * 4)

    const dummyMatrix = Matrix.Identity()
    for (let i = 0; i < count; i++) {
        const radius = 10 + Math.random() * 15
        const theta = Math.random() * Math.PI * 2
        const phi = Math.random() * Math.PI
        
        const x = radius * Math.sin(phi) * Math.cos(theta)
        const y = radius * Math.sin(phi) * Math.sin(theta)
        const z = radius * Math.cos(phi)

        Matrix.RotationYawPitchRollToRef(
            Math.random() * Math.PI, 
            Math.random() * Math.PI, 
            Math.random() * Math.PI, 
            dummyMatrix
        )
        dummyMatrix.setTranslationFromFloats(x, y, z)
        dummyMatrix.copyToArray(bufferMatrices, i * 16)

        // Color
        const hslColor = Color3.FromHSV(Math.random() * 50 + 200, 0.8, 0.5)
        bufferColors[i * 4] = hslColor.r
        bufferColors[i * 4 + 1] = hslColor.g
        bufferColors[i * 4 + 2] = hslColor.b
        bufferColors[i * 4 + 3] = 1.0 // Alpha
    }

    baseMesh.thinInstanceSetBuffer("matrix", bufferMatrices, 16, false)
    baseMesh.thinInstanceSetBuffer("color", bufferColors, 4, false)

    // Animación global sutil
    let startTime = performance.now()
    scene.onBeforeRenderObservable.add(() => {
        const t = (performance.now() - startTime) / 1000
        baseMesh.rotation.y = t * 0.05
    })

    engine.runRenderLoop(() => {
      scene.render()
    })

    setSceneState({ scene, engine })

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
      <PerformanceOverlay title={`${count} Triángulos Estáticos`} />

      {sceneState && <DebugTools scene={sceneState.scene} engine={sceneState.engine} />}

      <canvas
        ref={canvasRef}
        className="block w-full h-full outline-none touch-none"
      />

      <div className="fixed bottom-0 left-0 w-full p-8 text-white/30 text-xs pointer-events-none text-center font-mono">
        THIN INSTANCES RENDERING - SINGLE DRAW CALL - GPGPU OPTIMIZED (BABYLON ENGINE)
      </div>
    </main>
  )
}
