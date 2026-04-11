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
  SpotLight,
  PointLight,
  MeshBuilder,
  StandardMaterial,
  ShadowGenerator,
  Texture,
  NodeMaterial
} from '@babylonjs/core'
import PerformanceOverlay from '@/components/test/PerformanceOverlay'
import DebugTools from '@/components/DebugTools'

export default function DynamicLightsTest() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [sceneState, setSceneState] = useState<{ scene: Scene, engine: Engine } | null>(null)

  useEffect(() => {
    if (!canvasRef.current) return

    const canvas = canvasRef.current
    const engine = new Engine(canvas, true)
    const scene = new Scene(engine)
    scene.clearColor = Color4.FromColor3(Color3.FromHexString("#050505"), 1)

    const camera = new ArcRotateCamera("camera", 0, Math.PI / 3, 35, Vector3.Zero(), scene)
    camera.setPosition(new Vector3(0, 20, 35))
    camera.attachControl(canvas, true)

    const ambientLight = new HemisphericLight("ambient", new Vector3(0, 1, 0), scene)
    ambientLight.intensity = 0.3

    // Directional Light
    const dirLight = new DirectionalLight("dirLight", new Vector3(-1, -1, -1), scene)
    dirLight.position = new Vector3(20, 30, 20)
    dirLight.intensity = 1.5
    dirLight.diffuse = Color3.FromHexString("#a5b4fc")

    const shadowGenerator = new ShadowGenerator(2048, dirLight)
    shadowGenerator.useBlurExponentialShadowMap = true
    shadowGenerator.blurKernel = 32
    shadowGenerator.bias = 0.00005 // Adjusted bias

    const shadowGenerators: ShadowGenerator[] = [shadowGenerator]

    // Create a rotating SpotLight Factory
    const spotLights: { light: SpotLight, speed: number, target: Vector3 }[] = []
    
    // rotating spotlights implementation
    const createSpotlight = (id: string, colorHex: string, speed: number, position: Vector3) => {
        const spotLight = new SpotLight(id, position, new Vector3(0, -1, 0), Math.PI / 5, 0.5, scene)
        spotLight.diffuse = Color3.FromHexString(colorHex)
        spotLight.intensity = 15
        
        const spotShadows = new ShadowGenerator(512, spotLight)
        spotShadows.useBlurExponentialShadowMap = true
        spotShadows.blurKernel = 16
        shadowGenerators.push(spotShadows)
        
        spotLights.push({ light: spotLight, speed, target: new Vector3(0, 0, 0) })
    }

    createSpotlight("s1", "#fb7185", 0.5, new Vector3(15, 15, 0))
    createSpotlight("s2", "#38bdf8", 0.7, new Vector3(-15, 15, 0))
    createSpotlight("s3", "#34d399", 0.4, new Vector3(0, 15, 15))

    // Moving PointLights
    const pointLights: { light: PointLight, speed: number, radius: number, initialPos: Vector3 }[] = []
    
    for(let i=0; i<30; i++) {
        const color = Color3.FromHSV((i / 30) * 360, 1, 0.6)
        const pos = new Vector3((Math.random() - 0.5) * 30, 2 + Math.random() * 5, (Math.random() - 0.5) * 30)
        
        const plight = new PointLight(`pl_${i}`, pos.clone(), scene)
        plight.diffuse = color
        plight.intensity = 8
        plight.range = 20

        const sphere = MeshBuilder.CreateSphere(`pls_${i}`, { diameter: 0.4 }, scene)
        sphere.position = pos.clone()
        sphere.parent = plight // the sphere follows the light automatically
        
        const mat = new StandardMaterial(`plmat_${i}`, scene)
        mat.emissiveColor = color
        mat.disableLighting = true
        sphere.material = mat

        pointLights.push({
            light: plight,
            initialPos: pos,
            speed: 0.2 + Math.random() * 1.5,
            radius: 2 + Math.random() * 5
        })
    }

    // Detailed Floor
    const ground = MeshBuilder.CreateGround("ground", { width: 100, height: 100, subdivisions: 64 }, scene)
    ground.position.y = -0.5
    const groundMat = new StandardMaterial("groundMat", scene)
    groundMat.diffuseColor = Color3.FromHexString("#101015")
    groundMat.specularColor = new Color3(0.2, 0.2, 0.2)
    groundMat.roughness = 0.2
    ground.material = groundMat
    ground.receiveShadows = true

    // Animal Herd (100)
    const animalCount = 100
    
    // We create an original mesh and instance it to save resources instead of full separate meshes
    const originalAnimalGroup = new BABYLON.TransformNode("animalGroup", scene)
    
    const bodyMat = new StandardMaterial("bodyMat", scene)
    bodyMat.diffuseColor = Color3.Gray()
    const headMat = new StandardMaterial("headMat", scene)
    const earMat = new StandardMaterial("earMat", scene)
    earMat.diffuseColor = Color3.FromHexString("#c2410c")

    const body = MeshBuilder.CreateBox("body", { width: 1.2, height: 0.8, depth: 1.8 }, scene)
    body.position = new Vector3(0, 0.5, -0.5)
    body.material = bodyMat
    body.setParent(originalAnimalGroup)

    const head = MeshBuilder.CreateBox("head", { size: 1 }, scene)
    head.position = new Vector3(0, 1, 0.5)
    head.material = headMat
    head.setParent(originalAnimalGroup)

    const leftEar = MeshBuilder.CreateCylinder("lear", { diameterBottom: 0.4, diameterTop: 0, height: 0.5, tessellation: 4 }, scene)
    leftEar.position = new Vector3(-0.3, 0.6, 0)
    leftEar.material = earMat
    leftEar.setParent(head)

    const rightEar = MeshBuilder.CreateCylinder("rear", { diameterBottom: 0.4, diameterTop: 0, height: 0.5, tessellation: 4 }, scene)
    rightEar.position = new Vector3(0.3, 0.6, 0)
    rightEar.material = earMat
    rightEar.setParent(head)

    const meshesToAddShadows = [body, head, leftEar, rightEar]
    
    // Since instancing with custom colors per instance requires specialized buffer or ThinInstances, 
    // we just clone them to easily change material colors. In stress testing, 100 clones is fine.
    originalAnimalGroup.setEnabled(false) // Hide the original
    
    for(let i=0; i<animalCount; i++) {
        const x = (Math.random() - 0.5) * 40
        const z = (Math.random() - 0.5) * 40
        const rY = Math.random() * Math.PI * 2
        const s = 0.8 + Math.random() * 0.5

        const clone = originalAnimalGroup.instantiateHierarchy() as BABYLON.TransformNode
        clone.position.set(x, 0, z)
        clone.rotation.set(0, rY, 0)
        clone.scaling.setAll(s)
        
        // Add clones to shadows
        clone.getChildMeshes(false).forEach(m => {
            if (m.name.includes("body") || m.name.includes("head")) {
                const subMat = new StandardMaterial(`animMat_${i}`, scene)
                subMat.diffuseColor = Color3.FromHSV(Math.random() * 50 + 20, 0.9, 0.5)
                m.material = subMat
            }
            m.receiveShadows = true
            shadowGenerators.forEach(sg => sg.addShadowCaster(m, false))
        })
    }

    let startTime = performance.now()
    scene.onBeforeRenderObservable.add(() => {
        const t = (performance.now() - startTime) / 1000

        spotLights.forEach(sl => {
            const time = t * sl.speed
            sl.target.x = Math.sin(time) * 10
            sl.target.z = Math.cos(time) * 10
            sl.light.setDirectionToTarget(sl.target)
        })

        pointLights.forEach(pl => {
            const time = t * pl.speed
            pl.light.position.x = pl.initialPos.x + Math.sin(time) * pl.radius
            pl.light.position.z = pl.initialPos.z + Math.cos(time * 0.8) * pl.radius
            pl.light.position.y = pl.initialPos.y + Math.sin(time * 1.5) * 2
        })
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
      <PerformanceOverlay title="ILUMINACIÓN EXHAUSTIVA: Múltiples Luces y Sombras" />

      {sceneState && <DebugTools scene={sceneState.scene} engine={sceneState.engine} />}

      <canvas
        ref={canvasRef}
        className="block w-full h-full outline-none touch-none"
      />

      <div className="fixed bottom-0 left-0 w-full p-8 text-white/30 text-xs pointer-events-none text-center font-mono z-50">
        GPU STRESS - DIRECTIONAL + SPOTLIGHTS + POINTLIGHTS + SHADOWS ON COMPLEX GEOMETRIES (BABYLON ENGINE)
      </div>
    </main>
  )
}
