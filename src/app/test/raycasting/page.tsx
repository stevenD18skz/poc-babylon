'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
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
  ActionManager,
  ExecuteCodeAction
} from '@babylonjs/core'
import PerformanceOverlay from '@/components/test/PerformanceOverlay'
import DebugTools from '@/components/DebugTools'

export default function RaycastTest() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [sceneState, setSceneState] = useState<{ scene: Scene, engine: Engine } | null>(null)
  const [hitCount, setHitCount] = useState(0)
  const totalObjects = 500

  useEffect(() => {
    if (!canvasRef.current) return

    const canvas = canvasRef.current
    const engine = new Engine(canvas, true)
    const scene = new Scene(engine)
    scene.clearColor = Color4.FromColor3(Color3.FromHexString("#050505"), 1)

    const camera = new ArcRotateCamera("camera", Math.PI / 4, Math.PI / 3, 20, Vector3.Zero(), scene)
    camera.setPosition(new Vector3(0, 20, 20))
    camera.attachControl(canvas, true)

    const ambientLight = new HemisphericLight("ambient", new Vector3(0, 1, 0), scene)
    ambientLight.intensity = 0.4

    const dirLight = new DirectionalLight("dirLight", new Vector3(0, -1, -0.5), scene)
    dirLight.position = new Vector3(10, 10, 5)
    dirLight.intensity = 1

    const ground = MeshBuilder.CreateGround("ground", { width: 50, height: 50 }, scene)
    ground.position.y = -0.01
    const groundMat = new StandardMaterial("groundMat", scene)
    groundMat.diffuseColor = Color3.FromHexString("#111127")
    ground.material = groundMat

    // Materiales predefinidos para mejor rendimiento
    const matNormal = new StandardMaterial("matNormal", scene)
    matNormal.diffuseColor = Color3.FromHexString("#6366f1")

    const matHovered = new StandardMaterial("matHovered", scene)
    matHovered.diffuseColor = Color3.FromHexString("#3b82f6")
    matHovered.emissiveColor = Color3.FromHexString("#3b82f6")
    matHovered.emissiveIntensity = 0.4

    const matClicked = new StandardMaterial("matClicked", scene)
    matClicked.diffuseColor = Color3.FromHexString("#22c55e")

    const cols = Math.ceil(Math.sqrt(totalObjects))
    for (let i = 0; i < totalObjects; i++) {
        const x = (i % cols) * 1.2 - (cols * 1.2) / 2
        const z = Math.floor(i / cols) * 1.2 - (cols * 1.2) / 2
        
        const box = MeshBuilder.CreateBox(`box_${i}`, { size: 0.6 }, scene)
        box.position.set(x, 0.3, z)
        box.material = matNormal

        box.actionManager = new ActionManager(scene)
        
        // Estado local manual
        let isClicked = false

        box.actionManager.registerAction(new ExecuteCodeAction(ActionManager.OnPointerOverTrigger, () => {
            if (!isClicked) {
                box.material = matHovered
                box.scaling.setAll(1.3)
            }
        }))
        
        box.actionManager.registerAction(new ExecuteCodeAction(ActionManager.OnPointerOutTrigger, () => {
            if (!isClicked) {
                box.material = matNormal
                box.scaling.setAll(1)
            }
        }))

        box.actionManager.registerAction(new ExecuteCodeAction(ActionManager.OnPickTrigger, () => {
            if (!isClicked) {
                isClicked = true
                box.material = matClicked
                box.scaling.setAll(0.5)
                setHitCount(prev => prev + 1)
            }
        }))
    }

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
      <PerformanceOverlay title={`Raycasting: ${totalObjects} Objetos Interactivos`} />

      <div className="fixed top-6 right-6 z-50 bg-black/80 backdrop-blur-xl border border-white/10 px-6 py-4 rounded-2xl">
        <p className="text-gray-400 text-xs uppercase tracking-widest mb-1">Objetos Clickeados</p>
        <p className="text-3xl font-mono font-black text-emerald-400">{hitCount} <span className="text-gray-500 text-sm">/ {totalObjects}</span></p>
      </div>

      {sceneState && <DebugTools scene={sceneState.scene} engine={sceneState.engine} />}

      <canvas
        ref={canvasRef}
        className="block w-full h-full outline-none touch-none"
      />

      <div className="fixed bottom-0 left-0 w-full p-8 text-white/30 text-xs pointer-events-none text-center font-mono">
        EVENT SYSTEM STRESS - ACTION MANAGER ON {totalObjects} OBJECTS (BABYLON ENGINE)
      </div>
    </main>
  )
}
