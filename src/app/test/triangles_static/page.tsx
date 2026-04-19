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
  MeshBuilder,
  StandardMaterial,
  Matrix
} from '@babylonjs/core'
import PerformanceOverlay from '@/components/test/PerformanceOverlay'
import DebugTools from '@/components/DebugTools'
 
// ✅ Mismo count que R3F
const COUNT = 32_000
 
export default function TrianglesStaticTestBabylon() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [sceneState, setSceneState] = useState<{ scene: Scene; engine: Engine } | null>(null)
 
  useEffect(() => {
    if (!canvasRef.current) return
 
    const canvas = canvasRef.current
    const engine = new Engine(canvas, true)
    const scene = new Scene(engine)
 
    // ✅ Mismo fondo que R3F
    scene.clearColor = Color4.FromColor3(Color3.FromHexString('#050505'), 1)
 
    // ✅ Misma posición de cámara que R3F (20, 20, 20), mismo fov 50
    const camera = new ArcRotateCamera('camera', 0, Math.PI / 4, 34.6, Vector3.Zero(), scene)
    // Nota: radio 34.6 ≈ distancia euclidiana de (20,20,20) al origen
    camera.fov = 0.872 // 50 grados en radianes
    camera.attachControl(canvas, true)
    // ✅ Sin autoRotate (R3F tampoco lo tiene)
 
    // ✅ Solo ambient light, misma intensidad que R3F (intensity: 1)
    const ambientLight = new HemisphericLight('ambient', new Vector3(0, 1, 0), scene)
    ambientLight.intensity = 1.0
 
    // ✅ Geometría idéntica a R3F:
    // coneGeometry args: [0.2, 0.4, 8]
    // → radio: 0.2 → diámetro: 0.4
    // → altura: 0.4
    // → segmentos: 8
    const baseMesh = MeshBuilder.CreateCylinder(
      'baseCone',
      {
        diameterTop: 0,       // Es un cono
        diameterBottom: 0.4,  // 2 * radio (0.2)
        height: 0.4,          // Mismo que R3F
        tessellation: 8,      // Mismo que R3F (radialSegments)
      },
      scene
    )
 
    // ✅ Material simple, sin colores fancy (igual que R3F meshStandardMaterial sin props)
    const mat = new StandardMaterial('mat', scene)
    baseMesh.material = mat
 
    // ✅ Thin Instances = InstancedMesh de Three.js (ambos son 1 draw call)
    const bufferMatrices = new Float32Array(COUNT * 16)
 
    const dummyMatrix = Matrix.Identity()
    for (let i = 0; i < COUNT; i++) {
      // ✅ Mismo rango de radio que R3F (10 + random * 15)
      const radius = 10 + Math.random() * 15
      const theta = Math.random() * Math.PI * 2
      const phi = Math.random() * Math.PI
 
      const x = radius * Math.sin(phi) * Math.cos(theta)
      const y = radius * Math.sin(phi) * Math.sin(theta)
      const z = radius * Math.cos(phi)
 
      // ✅ Misma rotación aleatoria que R3F
      Matrix.RotationYawPitchRollToRef(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        dummyMatrix
      )
      dummyMatrix.setTranslationFromFloats(x, y, z)
      dummyMatrix.copyToArray(bufferMatrices, i * 16)
    }
 
    // ✅ Sin buffer de colores (R3F tampoco tiene en la versión estática)
    baseMesh.thinInstanceSetBuffer('matrix', bufferMatrices, 16, false)
 
    // ✅ Sin animación (R3F tampoco tiene)
 
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
      <PerformanceOverlay title={`${COUNT} Triángulos Estáticos (Babylon)`} />
      
      {sceneState && <DebugTools scene={sceneState.scene} engine={sceneState.engine} title="triangles_static" entityCount={COUNT} />}
 
      <canvas
        ref={canvasRef}
        className="block w-full h-full outline-none touch-none"
      />
    </main>
  )
}
 