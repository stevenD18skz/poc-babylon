'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Engine,
  Scene,
  ArcRotateCamera,
  Vector3,
  Color3,
  Color4,
  DirectionalLight,
  HemisphericLight,
  MeshBuilder,
  StandardMaterial,
  ShadowGenerator,
  TransformNode
} from '@babylonjs/core'
import * as GUI from '@babylonjs/gui'
import PerformanceOverlay from '@/components/test/PerformanceOverlay'
import DebugTools from '@/components/DebugTools'

const simulateAiApi = async (): Promise<string> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const actions = ['walk', 'idle', 'jump']
      resolve(actions[Math.floor(Math.random() * actions.length)])
    }, 1500)
  })
}

export default function NpcAiTest() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [sceneState, setSceneState] = useState<{ scene: Scene, engine: Engine } | null>(null)

  useEffect(() => {
    if (!canvasRef.current) return

    const canvas = canvasRef.current
    const engine = new Engine(canvas, true)
    const scene = new Scene(engine)
    scene.clearColor = Color4.FromColor3(Color3.FromHexString("#050505"), 1)

    const camera = new ArcRotateCamera("camera", Math.PI / 4, Math.PI / 3, 15, Vector3.Zero(), scene)
    camera.setPosition(new Vector3(0, 8, 15))
    camera.attachControl(canvas, true)
    camera.upperBetaLimit = Math.PI / 2 - 0.1

    const ambientLight = new HemisphericLight("ambient", new Vector3(0, 1, 0), scene)
    ambientLight.intensity = 0.5

    const dirLight = new DirectionalLight("dirLight", new Vector3(-1, -2, -1), scene)
    dirLight.position = new Vector3(10, 10, 10)
    dirLight.intensity = 2
    
    const shadowGenerator = new ShadowGenerator(1024, dirLight)
    shadowGenerator.useBlurExponentialShadowMap = true

    // Paddock
    const ground = MeshBuilder.CreateGround("ground", { width: 20, height: 20 }, scene)
    ground.position.y = -0.01
    const groundMat = new StandardMaterial("groundMat", scene)
    groundMat.diffuseColor = Color3.FromHexString("#064e3b")
    ground.material = groundMat
    ground.receiveShadows = true

    // Grid (lines)
    const gridMat = new StandardMaterial("gridMat", scene)
    gridMat.wireframe = true
    gridMat.emissiveColor = Color3.White()
    const grid = MeshBuilder.CreateGround("grid", { width: 20, height: 20, subdivisions: 20 }, scene)
    grid.position.y = 0
    grid.material = gridMat

    // Npc Cat
    const group = new TransformNode("catGroup", scene)
    const bodyPivot = new TransformNode("bodyPivot", scene)
    bodyPivot.parent = group
    
    const bodyMat = new StandardMaterial("bodyMat", scene)
    bodyMat.diffuseColor = Color3.FromHexString("#ea580c")
    const headMat = new StandardMaterial("headMat", scene)
    headMat.diffuseColor = Color3.FromHexString("#f97316")
    const earMat = new StandardMaterial("earMat", scene)
    earMat.diffuseColor = Color3.FromHexString("#c2410c")

    const head = MeshBuilder.CreateBox("head", { size: 1 }, scene)
    head.position = new Vector3(0, 1, 0.5)
    head.material = headMat
    head.parent = bodyPivot
    shadowGenerator.addShadowCaster(head)

    const leftEar = MeshBuilder.CreateCylinder("lear", { diameterBottom: 0.4, diameterTop: 0, height: 0.5, tessellation: 4 }, scene)
    leftEar.position = new Vector3(-0.3, 0.6, 0)
    leftEar.material = earMat
    leftEar.parent = head

    const rightEar = MeshBuilder.CreateCylinder("rear", { diameterBottom: 0.4, diameterTop: 0, height: 0.5, tessellation: 4 }, scene)
    rightEar.position = new Vector3(0.3, 0.6, 0)
    rightEar.material = earMat
    rightEar.parent = head

    const body = MeshBuilder.CreateBox("body", { width: 1.2, height: 0.8, depth: 1.8 }, scene)
    body.position = new Vector3(0, 0.5, -0.5)
    body.material = bodyMat
    body.parent = bodyPivot
    shadowGenerator.addShadowCaster(body)

    // GUI for Status Label
    const advancedTexture = GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI")
    const label = new GUI.TextBlock()
    label.text = "Acción: IDLE"
    label.color = "#4ade80"
    label.fontSize = 24
    label.outlineWidth = 4
    label.outlineColor = "black"
    advancedTexture.addControl(label)
    label.linkWithMesh(body)   
    label.linkOffsetY = -100

    // NPC State
    let action = 'idle'
    let isThinking = false
    let targetPos = new Vector3(0, 0, 0)
    let isDestroyed = false

    const aiLoop = async () => {
      while (!isDestroyed) {
        isThinking = true
        label.text = "Pensando..."
        label.color = "#facc15"
        
        const nextAction = await simulateAiApi()
        if (isDestroyed) break

        isThinking = false
        action = nextAction
        
        label.text = `Acción: ${action.toUpperCase()}`
        label.color = "#4ade80"
        
        if (nextAction === 'walk') {
            targetPos.set(
              (Math.random() - 0.5) * 10,
              0,
              (Math.random() - 0.5) * 10
            )
        }
        
        await new Promise(r => setTimeout(r, 4000))
      }
    }
    
    aiLoop()

    let startTime = performance.now()
    scene.onBeforeRenderObservable.add(() => {
        const t = (performance.now() - startTime) / 1000

        switch (action) {
            case 'idle':
                bodyPivot.position.y = Math.sin(t * 2) * 0.1
                bodyPivot.rotation.z = Math.sin(t) * 0.05
                break
      
            case 'jump':
                bodyPivot.position.y = Math.abs(Math.sin(t * 8)) * 2
                bodyPivot.rotation.x = t * 4
                break
      
            case 'walk':
                const currentPos = group.position
                
                // Rotation
                const angle = Math.atan2(targetPos.x - currentPos.x, targetPos.z - currentPos.z)
                group.rotation.y += (angle - group.rotation.y) * 0.1
                
                // Movement
                currentPos.x += (targetPos.x - currentPos.x) * 0.02
                currentPos.z += (targetPos.z - currentPos.z) * 0.02
                
                // Animation
                bodyPivot.position.y = Math.abs(Math.sin(t * 10)) * 0.5
                bodyPivot.rotation.z = Math.sin(t * 10) * 0.2
                break
          }
    })

    engine.runRenderLoop(() => {
      scene.render()
    })

    setSceneState({ scene, engine })

    const handleResize = () => engine.resize()
    window.addEventListener('resize', handleResize)

    return () => {
      isDestroyed = true
      window.removeEventListener('resize', handleResize)
      scene.dispose()
      engine.dispose()
    }
  }, [])

  return (
    <main className="w-full h-screen bg-[#050505] overflow-hidden relative">
      <PerformanceOverlay title="Simulación NPC + IA Contextual" />

      {sceneState && <DebugTools scene={sceneState.scene} engine={sceneState.engine} />}

      <canvas
        ref={canvasRef}
        className="block w-full h-full outline-none touch-none"
      />

      <div className="fixed bottom-0 left-0 w-full p-8 text-white/30 text-xs pointer-events-none text-center font-mono">
        ASYNC LOGIC STRESS - PROMISE RESOLUTION IN RENDER LOOP (BABYLON ENGINE)
      </div>
    </main>
  )
}
