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
  DirectionalLight,
  MeshBuilder,
  StandardMaterial,
  DynamicTexture,
  Mesh
} from '@babylonjs/core'
import PerformanceOverlay from '@/components/test/PerformanceOverlay'
import DebugTools from '@/components/DebugTools'

export default function VramStressTest() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [sceneState, setSceneState] = useState<{ scene: Scene, engine: Engine } | null>(null)
  const [numTextures, setNumTextures] = useState(20)

  // Refs de estado
  const currentObjectsRef = useRef<{ mesh: Mesh, mat: StandardMaterial, tex: DynamicTexture }[]>([])

  useEffect(() => {
    if (!canvasRef.current) return

    const canvas = canvasRef.current
    const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true })
    const scene = new Scene(engine)
    scene.clearColor = Color4.FromColor3(Color3.FromHexString("#050505"), 1)

    const camera = new ArcRotateCamera("camera", 0, Math.PI / 2, 30, Vector3.Zero(), scene)
    camera.setPosition(new Vector3(0, 0, 30))
    camera.attachControl(canvas, true)
    
    // Auto rotación
    camera.useAutoRotationBehavior = true
    if (camera.autoRotationBehavior) {
      camera.autoRotationBehavior.idleRotationSpeed = 0.5
    }

    const ambientLight = new HemisphericLight("ambient", new Vector3(0, 1, 0), scene)
    ambientLight.intensity = 0.5

    const dirLight = new DirectionalLight("dirLight", new Vector3(-1, -1, -1), scene)
    dirLight.position = new Vector3(10, 10, 10)

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

  // Hook que maneja el cambio manual de texturas
  useEffect(() => {
    if (!sceneState) return
    const { scene } = sceneState

    // Cleanup anterior
    currentObjectsRef.current.forEach(obj => {
        obj.tex.dispose()
        obj.mat.dispose()
        obj.mesh.dispose()
    })
    currentObjectsRef.current = []

    for (let i = 0; i < numTextures; i++) {
        // Textura dinámica ruidosa para llenar memoria
        const size = 1024
        const dynamicTexture = new DynamicTexture(`tex_${i}`, size, scene, true)
        const ctx = dynamicTexture.getContext()

        for (let j = 0; j < 500; j++) {
            ctx.fillStyle = `hsl(${Math.random() * 360}, 100%, 50%)`
            ctx.fillRect(Math.random() * size, Math.random() * size, size/10, size/10)
        }
        dynamicTexture.update()

        const pos = new Vector3(
            (Math.random() - 0.5) * 20,
            (Math.random() - 0.5) * 20,
            (Math.random() - 0.5) * 20
        )

        const sphere = MeshBuilder.CreateSphere(`sphere_${i}`, { diameter: 2, segments: 32 }, scene)
        sphere.position = pos
        sphere.rotation = new Vector3(Math.random() * Math.PI, 0, 0)

        const mat = new StandardMaterial(`mat_${i}`, scene)
        mat.diffuseTexture = dynamicTexture
        mat.roughness = 0.3
        mat.specularPower = 16
        sphere.material = mat

        currentObjectsRef.current.push({ mesh: sphere, mat, tex: dynamicTexture })
    }

  }, [numTextures, sceneState])

  return (
    <main className="w-full h-screen bg-[#050505] overflow-hidden relative">
      <PerformanceOverlay title={`Estrés de Memoria: ${numTextures} Textura(s) 1K`} />

      <div className="fixed top-8 right-8 z-50 bg-black/80 backdrop-blur-xl border border-white/10 p-6 rounded-3xl flex flex-col gap-4">
        <label className="text-gray-400 text-xs uppercase tracking-widest font-bold">Carga de VRAM (Lento)</label>
        <div className="flex gap-2">
            {[20, 50, 100].map(n => (
                <button 
                  key={n}
                  onClick={() => setNumTextures(n)}
                  className={`px-4 py-2 rounded-xl transition-all ${numTextures === n ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'bg-white/5 hover:bg-white/10 text-gray-400'}`}
                >
                    {n} Texturas
                </button>
            ))}
        </div>
        <p className="text-[10px] text-gray-500 italic max-w-xs leading-tight">
          Cada botón carga más texturas únicas en el GPU. 100 texturas de 1K pueden ocupar aprox. ~400MB-600MB de VRAM.
        </p>
      </div>

      {sceneState && <DebugTools scene={sceneState.scene} engine={sceneState.engine} />}

      <canvas
        ref={canvasRef}
        className="block w-full h-full outline-none touch-none"
      />

      <div className="fixed bottom-0 left-0 w-full p-8 text-white/30 text-xs pointer-events-none text-center font-mono z-0">
        GPU VRAM STRESS - CUSTOM CANVAS TEXTURE ALLOCATION PER OBJECT (BABYLON ENGINE)
      </div>
    </main>
  )
}
