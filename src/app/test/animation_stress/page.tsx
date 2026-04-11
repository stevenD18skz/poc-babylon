'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Engine,
  Scene,
  ArcRotateCamera,
  Vector3,
  HemisphericLight,
  PointLight,
  Color3,
  Color4,
  MeshBuilder,
  StandardMaterial,
  Mesh
} from '@babylonjs/core'
import '@babylonjs/core/Meshes/meshBuilder'
import PerformanceOverlay from '@/components/test/PerformanceOverlay'
// Aseguramos que DebugTools reciba scene y engine
// En el componente de R3F original no se pasaba scene/engine, pero en Babylon
// nuestro DebugTools.tsx requiere `scene` y `engine`
import DebugTools from '@/components/DebugTools'

export default function AnimationStressTest() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [sceneState, setSceneState] = useState<{ scene: Scene, engine: Engine } | null>(null)

  useEffect(() => {
    if (!canvasRef.current) return

    const canvas = canvasRef.current
    const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true })
    const scene = new Scene(engine)
    scene.clearColor = Color4.FromColor3(Color3.FromHexString("#050505"), 1)

    // Camera
    const camera = new ArcRotateCamera("camera", Math.PI / 4, Math.PI / 3, 25, Vector3.Zero(), scene)
    camera.setPosition(new Vector3(0, 15, 25))
    camera.attachControl(canvas, true)

    // Lights
    const ambientLight = new HemisphericLight("ambientLight", new Vector3(0, 1, 0), scene)
    ambientLight.intensity = 0.3

    const pointLight1 = new PointLight("pt1", new Vector3(0, 10, 0), scene)
    pointLight1.intensity = 5
    pointLight1.diffuse = Color3.FromHexString("#8b5cf6")

    const pointLight2 = new PointLight("pt2", new Vector3(10, 5, 10), scene)
    pointLight2.intensity = 3
    pointLight2.diffuse = Color3.FromHexString("#3b82f6")

    // Spheres
    const count = 2000
    const spheres: { mesh: Mesh, delay: number, basePos: number[] }[] = []

    for (let i = 0; i < count; i++) {
      const theta = (i / count) * Math.PI * 8
      const ring = Math.floor(i / 50)
      const r = 3 + ring * 1
      const delay = i * 0.15

      const mesh = MeshBuilder.CreateIcosahedron(`sphere_${i}`, { radius: 0.3, subdivisions: 1 }, scene)
      const x = Math.cos(theta) * r
      const z = Math.sin(theta) * r
      
      mesh.position.set(x, 0, z)

      const mat = new StandardMaterial(`mat_${i}`, scene)
      const hue = (delay * 50) % 360
      // Usar HSV manual para simplificar hsl() a rgb de Babylon
      mat.diffuseColor = Color3.FromHSV(hue, 0.7, 0.5)
      mat.emissiveColor = Color3.FromHSV(hue, 0.7, 0.3)
      mat.specularPower = 64
      mesh.material = mat

      spheres.push({ mesh, delay, basePos: [x, 0, z] })
    }

    // Animación en el loop
    let startTime = performance.now()
    scene.onBeforeRenderObservable.add(() => {
      const t = (performance.now() - startTime) / 1000
      
      for (const s of spheres) {
        const time = t + s.delay
        s.mesh.position.y = s.basePos[1] + Math.sin(time * 2) * 1.5
        const scale = 0.8 + Math.sin(time * 3) * 0.3
        s.mesh.scaling.setAll(scale)
        s.mesh.rotation.x = time * 0.5
        s.mesh.rotation.z = time * 0.3
      }
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
      <PerformanceOverlay title="500 Objetos Animados (onBeforeRender)" />

      {sceneState && <DebugTools scene={sceneState.scene} engine={sceneState.engine} />}

      <canvas
        ref={canvasRef}
        className="block w-full h-full outline-none touch-none"
      />

      <div className="fixed bottom-0 left-0 w-full p-8 text-white/30 text-xs pointer-events-none text-center font-mono">
        ANIMATION LOOP STRESS - OBSERVABLE ON 2000 INDIVIDUAL MESHES (BABYLON ENGINE)
      </div>
    </main>
  )
}
