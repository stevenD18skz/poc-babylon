'use client'

import { Canvas, useFrame } from '@react-three/fiber'
import { useState, useEffect, useRef } from 'react'
import * as THREE from 'three'
import PerformanceOverlay from '@/components/test/PerformanceOverlay'
import DebugTools from '@/components/DebugTools'
import { OrbitControls, Text } from '@react-three/drei'

// API Falsa que simula una IA devolviendo acciones basadas en algún contexto
const simulateAiApi = async (): Promise<string> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const actions = ['walk', 'idle', 'jump']
      resolve(actions[Math.floor(Math.random() * actions.length)])
    }, 1500) // Simula la latencia de una petición a OpenAI/Claude
  })
}

function NpcCat() {
  const group = useRef<THREE.Group>(null!)
  const bodyRef = useRef<THREE.Mesh>(null!)
  const [action, setAction] = useState('idle')
  const [isThinking, setIsThinking] = useState(false)
  
  // Posición objetivo para caminar
  const targetPos = useRef(new THREE.Vector3(0, 0, 0))

  useEffect(() => {
    const aiLoop = async () => {
      while (true) {
        setIsThinking(true)
        const nextAction = await simulateAiApi()
        
        setIsThinking(false)
        setAction(nextAction)
        
        if (nextAction === 'walk') {
            // Elige un nuevo punto aleatorio para caminar
            targetPos.current.set(
              (Math.random() - 0.5) * 10,
              0,
              (Math.random() - 0.5) * 10
            )
        }
        
        // Espera un rato antes de la siguiente "decisión"
        await new Promise(r => setTimeout(r, 4000))
      }
    }
    
    aiLoop()
  }, [])

  useFrame((state, delta) => {
    if (!group.current || !bodyRef.current) return
    const t = state.clock.getElapsedTime()

    switch (action) {
      case 'idle':
        // Respiración suave
        bodyRef.current.position.y = Math.sin(t * 2) * 0.1
        bodyRef.current.rotation.z = Math.sin(t) * 0.05
        break

      case 'jump':
        // Salto
        bodyRef.current.position.y = Math.abs(Math.sin(t * 8)) * 2
        bodyRef.current.rotation.x = t * 4
        break

      case 'walk':
        // Caminar hacia targetPos
        const currentPos = group.current.position
        
        // Rotar hacia el objetivo suavemente
        const angle = Math.atan2(targetPos.current.x - currentPos.x, targetPos.current.z - currentPos.z)
        group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, angle, 0.1)
        
        // Moverse
        currentPos.lerp(targetPos.current, 0.02)
        
        // Animación de caminado (bamboleo)
        bodyRef.current.position.y = Math.abs(Math.sin(t * 10)) * 0.5
        bodyRef.current.rotation.z = Math.sin(t * 10) * 0.2
        group.current.position.copy(currentPos)
        break
    }
  })

  return (
    <group ref={group}>
      {/* Indicador de estado por encima del gato */}
      <Text position={[0, 3, 0]} fontSize={0.5} outlineWidth={0.05} outlineColor="#000" color={isThinking ? "#facc15" : "#4ade80"}>
        {isThinking ? "Pensando..." : `Acción: ${action.toUpperCase()}`}
      </Text>

      {/* Cuerpo del gato (simplificado) */}
      <mesh ref={bodyRef} position={[0, 0, 0]}>
        {/* Cabeza */}
        <mesh position={[0, 1, 0.5]}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="#f97316" />
            {/* Orejas */}
            <mesh position={[-0.3, 0.6, 0]}>
                <coneGeometry args={[0.2, 0.5, 4]} />
                <meshStandardMaterial color="#c2410c" />
            </mesh>
            <mesh position={[0.3, 0.6, 0]}>
                <coneGeometry args={[0.2, 0.5, 4]} />
                <meshStandardMaterial color="#c2410c" />
            </mesh>
        </mesh>
        
        {/* Cuerpo */}
        <mesh position={[0, 0.5, -0.5]}>
            <boxGeometry args={[1.2, 0.8, 1.8]} />
            <meshStandardMaterial color="#ea580c" />
        </mesh>
      </mesh>
    </group>
  )
}

function Paddock() {
    return (
        <mesh rotation-x={-Math.PI / 2} position={[0, -0.01, 0]}>
            <planeGeometry args={[20, 20]} />
            <meshStandardMaterial color="#064e3b" />
            <gridHelper args={[20, 20, 0xffffff, 0xffffff]} />
        </mesh>
    )
}

export default function NpcAiTest() {
  return (
    <main className="w-full h-screen bg-[#050505] overflow-hidden">
      <PerformanceOverlay title="Simulación NPC + IA Contextual" />

      <Canvas camera={{ position: [0, 8, 15], fov: 50 }}>
        <DebugTools />
        <OrbitControls makeDefault maxPolarAngle={Math.PI / 2 - 0.1} />
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 10]} intensity={2} castShadow />
        
        <Paddock />
        <NpcCat />
      </Canvas>

      <div className="fixed bottom-0 left-0 w-full p-8 text-white/30 text-xs pointer-events-none text-center font-mono">
        ASYNC LOGIC STRESS - PROMISE RESOLUTION IN RENDER LOOP
      </div>
    </main>
  )
}
