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
  ShadowGenerator,
  HavokPlugin,
  PhysicsAggregate,
  PhysicsShapeType
} from '@babylonjs/core'
import HavokPhysics from '@babylonjs/havok'
import PerformanceOverlay from '@/components/test/PerformanceOverlay'
import DebugTools from '@/components/DebugTools'

export default function PhysicsStressTest() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [sceneState, setSceneState] = useState<{ scene: Scene, engine: Engine } | null>(null)
  
  // Havok state
  const [havokInitialized, setHavokInitialized] = useState(false)

  useEffect(() => {
    if (!canvasRef.current) return

    const canvas = canvasRef.current
    const engine = new Engine(canvas, true)
    const scene = new Scene(engine)
    scene.clearColor = Color4.FromColor3(Color3.FromHexString("#050505"), 1)

    const camera = new ArcRotateCamera("camera", Math.PI/4, Math.PI/3, 25, Vector3.Zero(), scene)
    camera.setPosition(new Vector3(15, 15, 15))
    camera.attachControl(canvas, true)

    const ambientLight = new HemisphericLight("ambient", new Vector3(0, 1, 0), scene)
    ambientLight.intensity = 0.5

    const dirLight = new DirectionalLight("dirLight", new Vector3(-1, -2, -1), scene)
    dirLight.position = new Vector3(10, 10, 10)
    dirLight.intensity = 1.5

    const shadowGenerator = new ShadowGenerator(1024, dirLight)
    shadowGenerator.useBlurExponentialShadowMap = true

    // Initialize Physics inside async flow
    let isMounted = true
    const initEngine = async () => {
        try {
            const havokInstance = await HavokPhysics()
            if (!isMounted) return
            
            const hkPlugin = new HavokPlugin(true, havokInstance)
            scene.enablePhysics(new Vector3(0, -9.81, 0), hkPlugin)

            // Setup environment post-physics
            const ground = MeshBuilder.CreateGround("ground", { width: 30, height: 30 }, scene)
            const gMat = new StandardMaterial("gMat", scene)
            gMat.diffuseColor = Color3.FromHexString("#222222")
            ground.material = gMat
            ground.receiveShadows = true
            // Static aggregate for ground
            new PhysicsAggregate(ground, PhysicsShapeType.BOX, { mass: 0, restitution: 0.9 }, scene)

            // Invisible walls
            const createWall = (name: string, width: number, height: number, depth: number, pos: Vector3) => {
                const wall = MeshBuilder.CreateBox(name, { width, height, depth }, scene)
                wall.position = pos
                wall.isVisible = false
                new PhysicsAggregate(wall, PhysicsShapeType.BOX, { mass: 0 }, scene)
            }

            createWall("w1", 30, 10, 0.1, new Vector3(0, 5, 15))
            createWall("w2", 30, 10, 0.1, new Vector3(0, 5, -15))
            createWall("w3", 0.1, 10, 30, new Vector3(15, 5, 0))
            createWall("w4", 0.1, 10, 30, new Vector3(-15, 5, 0))

            // Falling objects
            const count = 200
            for(let i=0; i<count; i++) {
                const x = (Math.random() - 0.5) * 8
                const y = 10 + i * 0.5
                const z = (Math.random() - 0.5) * 8
                
                const type = Math.random() > 0.5 ? 'box' : 'sphere'
                const mat = new StandardMaterial(`m_${i}`, scene)
                mat.diffuseColor = Color3.FromHSV(Math.random() * 360, 0.7, 0.5)

                if (type === 'box') {
                    const b = MeshBuilder.CreateBox(`b_${i}`, { size: 1 }, scene)
                    b.position.set(x, y, z)
                    b.material = mat
                    shadowGenerator.addShadowCaster(b)
                    new PhysicsAggregate(b, PhysicsShapeType.BOX, { mass: 1, restitution: 0.5 }, scene)
                } else {
                    const s = MeshBuilder.CreateSphere(`s_${i}`, { diameter: 1.2, segments: 16 }, scene)
                    s.position.set(x, y, z)
                    s.material = mat
                    shadowGenerator.addShadowCaster(s)
                    new PhysicsAggregate(s, PhysicsShapeType.SPHERE, { mass: 1, restitution: 0.5 }, scene)
                }
            }

            setHavokInitialized(true)
        } catch (e) {
            console.error("Havok init failed:", e)
        }
    }

    initEngine()

    engine.runRenderLoop(() => {
      scene.render()
    })

    setSceneState({ scene, engine })

    const handleResize = () => engine.resize()
    window.addEventListener('resize', handleResize)

    return () => {
      isMounted = false
      window.removeEventListener('resize', handleResize)
      scene.dispose()
      engine.dispose()
    }
  }, [])

  return (
    <main className="w-full h-screen bg-[#050505] overflow-hidden relative">
      <PerformanceOverlay title="Estrés de Física (200 RigidBodies)" />

      {sceneState && <DebugTools scene={sceneState.scene} engine={sceneState.engine} />}

      <canvas
        ref={canvasRef}
        className="block w-full h-full outline-none touch-none"
      />

      <div className="fixed bottom-0 left-0 w-full p-8 text-white/30 text-xs pointer-events-none text-center font-mono">
        {havokInitialized ? 
            "CPU/WASM STRESS - HAVOK PHYSICS ENGINE WITH 200 INTERACTING RIGIDBODIES" : 
            "LOADING HAVOK PHYSICS ENGINE..."}
      </div>
    </main>
  )
}
