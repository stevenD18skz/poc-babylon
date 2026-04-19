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
  Mesh
} from '@babylonjs/core'
import PerformanceOverlay from '@/components/test/PerformanceOverlay'
import DebugTools from '@/components/DebugTools'

export default function TrianglesRotatingTest() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [sceneState, setSceneState] = useState<{ scene: Scene, engine: Engine } | null>(null)
  const [triangles, setTriangles] = useState(1_000)

  // Referencia para mantener el control de los meshes actuales y poder eliminarlos
  const currentMeshesRef = useRef<Mesh[]>([])
  const observerRef = useRef<any>(null)

  useEffect(() => {
    if (!canvasRef.current) return

    const canvas = canvasRef.current
    const engine = new Engine(canvas, true)
    const scene = new Scene(engine)
    scene.clearColor = Color4.FromColor3(Color3.FromHexString("#050505"), 1)

    const camera = new ArcRotateCamera("camera", Math.PI/2, Math.PI/2, 15, Vector3.Zero(), scene)
    camera.setPosition(new Vector3(0, 0, 15))
    camera.attachControl(canvas, true)

    const ambientLight = new HemisphericLight("ambient", new Vector3(0, 1, 0), scene)
    ambientLight.intensity = 0.5

    const pointLight = new PointLight("pt1", new Vector3(10, 10, 10), scene)
    pointLight.intensity = 1

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

  // Actualizador dinámico basado en la cantidad de "triángulos" (conos)
  useEffect(() => {
    if (!sceneState) return
    const { scene } = sceneState

    // Limpiar meshes y observables anteriores
    currentMeshesRef.current.forEach(m => m.dispose())
    currentMeshesRef.current = []
    if (observerRef.current) {
        scene.onBeforeRenderObservable.remove(observerRef.current)
        observerRef.current = null
    }

    const newMeshes: { mesh: Mesh, rotSpeed: number }[] = []

    for (let i = 0; i < triangles; i++) {
        const theta = Math.random() * Math.PI * 2
        const phi = Math.random() * Math.PI
        const r = 5 + Math.random() * 5
        
        const x = r * Math.sin(phi) * Math.cos(theta)
        const y = r * Math.sin(phi) * Math.sin(theta)
        const z = r * Math.cos(phi)

        const cone = MeshBuilder.CreateCylinder(`cone_${i}`, { diameterTop: 0, diameterBottom: 0.4, height: 3, tessellation: 8 }, scene)
        cone.position.set(x, y, z)

        const mat = new StandardMaterial(`mat_${i}`, scene)
        const color = Color3.FromHSV(Math.random() * 360, 0.7, 0.5)
        mat.diffuseColor = color
        mat.emissiveColor = color
        cone.material = mat

        newMeshes.push({
            mesh: cone,
            rotSpeed: (Math.random() - 0.5) * 5
        })
        currentMeshesRef.current.push(cone)
    }

    let lastTime = performance.now()
    observerRef.current = scene.onBeforeRenderObservable.add(() => {
        const now = performance.now()
        const delta = (now - lastTime) / 1000
        lastTime = now

        for (const item of newMeshes) {
            item.mesh.rotation.x += delta * item.rotSpeed
            item.mesh.rotation.y += delta * (item.rotSpeed / 2)
        }
    })

  }, [triangles, sceneState])

  return (
    <main className="w-full h-screen bg-[#050505] overflow-hidden relative">
      <PerformanceOverlay title={`Triángulos Rotando (${triangles})`} />

      {sceneState && <DebugTools scene={sceneState.scene} engine={sceneState.engine} title="triangles_rotating" entityCount={triangles} />}

      <canvas
        ref={canvasRef}
        className="block w-full h-full outline-none touch-none"
      />

      <div style={{
        position: 'fixed', bottom: 16, left: 16, zIndex: 9999,
        background: 'rgba(0,0,0,0.8)', padding: '10px 16px',
        borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)',
        fontFamily: "'Courier New', monospace", fontSize: 12, color: '#ccc',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <label>Triángulos: <strong style={{ color: '#00ff88' }}>{triangles.toLocaleString()}</strong></label>
        <input
          type="range"
          min={1000} max={32000} step={1000}
          value={triangles}
          onChange={(e) => setTriangles(Number(e.target.value))}
          style={{ width: 160, accentColor: '#00ff88' }}
        />
      </div>

      <div className="fixed bottom-0 left-0 w-full p-2 text-white/20 text-xs pointer-events-none text-center font-mono">
        STRESS TEST - INDIVIDUAL MATRIX UPDATES - {triangles} OBJECTS (BABYLON ENGINE)
      </div>
    </main>
  )
}
