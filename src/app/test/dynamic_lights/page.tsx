'use client'

import { Canvas, useFrame } from '@react-three/fiber'
import { useRef, useMemo } from 'react'
import * as THREE from 'three'
import PerformanceOverlay from '@/components/test/PerformanceOverlay'
import DebugTools from '@/components/DebugTools'
import { OrbitControls, SoftShadows, Box, Sphere, Torus, Cylinder } from '@react-three/drei'

// Animación de Luces Puntuales (PointLights)
function MovingPointLight({ initialPosition, color, speed, radius }: { initialPosition: [number, number, number], color: string, speed: number, radius: number }) {
  const ref = useRef<THREE.PointLight>(null!)

  useFrame((state) => {
    const t = state.clock.getElapsedTime() * speed
    ref.current.position.x = initialPosition[0] + Math.sin(t) * radius
    ref.current.position.z = initialPosition[2] + Math.cos(t * 0.8) * radius
    ref.current.position.y = initialPosition[1] + Math.sin(t * 1.5) * 2
  })

  return (
    <pointLight 
      ref={ref} 
      color={color} 
      intensity={8} 
      distance={20} 
      castShadow
      shadow-bias={-0.001}
      shadow-mapSize={[512, 512]}
    >
      {/* Pequeña esfera para visualizar la luz */}
      <mesh>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </pointLight>
  )
}

// Animación de Focos (SpotLights)
function RotatingSpotLight({ position, color, speed }: { position: [number, number, number], color: string, speed: number }) {
  const ref = useRef<THREE.SpotLight>(null!)
  // En R3F, pasar ref.current como prop en el primer render lanza error de null matrixWorld
  // Es mejor crear el Object3D una sola vez y pasarlo directo como target
  const target = useMemo(() => new THREE.Object3D(), [])

  useFrame((state) => {
    const t = state.clock.getElapsedTime() * speed
    target.position.x = Math.sin(t) * 10
    target.position.z = Math.cos(t) * 10
  })

  return (
    <>
        <spotLight 
        ref={ref} 
        position={position} 
        color={color} 
        intensity={15} 
        angle={Math.PI / 5} 
        penumbra={0.5} 
        castShadow
        shadow-bias={-0.0005}
        target={target}
        />
        <primitive object={target} />
    </>
  )
}

// Suelo detallado
function DetailedFloor() {
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, -0.5, 0]} receiveShadow>
      <planeGeometry args={[100, 100, 64, 64]} />
      <meshStandardMaterial 
        color="#101015" 
        roughness={0.2} 
        metalness={0.8} 
        // Generamos un pequeño bump map procedural con wireframe false
        wireframe={false}
      />
    </mesh>
  )
}

// Generador de Mascotas instanciadas (AnimalHerd)
// Utilizamos el mismo diseño del "Gato" o mascota simple para crear una manada.
function AnimalHerd({ count }: { count: number }) {
  const animals = useMemo(() => {
    const list = []
    for (let i = 0; i < count; i++) {
        // Posiciones aleatorias en el plano
      list.push({
        position: [(Math.random() - 0.5) * 40, 0, (Math.random() - 0.5) * 40] as [number, number, number],
        rotation: [0, Math.random() * Math.PI * 2, 0] as [number, number, number],
        // Variedad de colores para la manada
        color: `hsl(${Math.random() * 50 + 20}, 90%, 50%)`,
        scale: 0.8 + Math.random() * 0.5
      })
    }
    return list
  }, [count])

  return (
    <>
      {animals.map((anim, i) => (
        <group key={i} position={anim.position} rotation={anim.rotation} scale={anim.scale}>
            {/* Cuerpo del Animal que lanza/recibe sombras */}
            <mesh position={[0, 0.5, -0.5]} castShadow receiveShadow>
                <boxGeometry args={[1.2, 0.8, 1.8]} />
                <meshStandardMaterial color={anim.color} roughness={0.6} metalness={0.1} />
            </mesh>
            
            {/* Cabeza */}
            <mesh position={[0, 1, 0.5]} castShadow receiveShadow>
                <boxGeometry args={[1, 1, 1]} />
                <meshStandardMaterial color={anim.color} roughness={0.5} metalness={0.1} />
                {/* Orejas */}
                <mesh position={[-0.3, 0.6, 0]} castShadow>
                    <coneGeometry args={[0.2, 0.5, 4]} />
                    <meshStandardMaterial color="#c2410c" />
                </mesh>
                <mesh position={[0.3, 0.6, 0]} castShadow>
                    <coneGeometry args={[0.2, 0.5, 4]} />
                    <meshStandardMaterial color="#c2410c" />
                </mesh>
            </mesh>
        </group>
      ))}
    </>
  )
}

function ExhaustiveDynamicLightsScene() {
  return (
    <>
    <ambientLight intensity={3}  />
      
      {/* Luz Direccional Principal (Sol/Luna) */}
      <directionalLight 
        position={[20, 30, 20]} 
        intensity={1.5} 
        castShadow 
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
        shadow-bias={-0.0005}
        color="#a5b4fc"
      />

      {/* Focos Dinámicos (SpotLights) */}
      <RotatingSpotLight position={[15, 15, 0]} color="#fb7185" speed={0.5} />
      <RotatingSpotLight position={[-15, 15, 0]} color="#38bdf8" speed={0.7} />
      <RotatingSpotLight position={[0, 15, 15]} color="#34d399" speed={0.4} />

      {/* Luces Puntuales Dinámicas (PointLights) - Reducimos cantidad a 30 por ser muy exhaustivas */}
      {Array.from({ length: 30 }).map((_, i) => (
        <MovingPointLight 
            key={i} 
            initialPosition={[(Math.random() - 0.5) * 30, 2 + Math.random() * 5, (Math.random() - 0.5) * 30]} 
            color={`hsl(${(i / 30) * 360}, 100%, 60%)`} 
            speed={0.2 + Math.random() * 1.5} 
            radius={2 + Math.random() * 5}
        />
      ))}

      <DetailedFloor />
      
      {/* 100 Animales arrojando y recibiendo sombras complejas */}
      <AnimalHerd count={100} />
    </>
  )
}

export default function DynamicLightsTest() {
  return (
    <main className="w-full h-screen bg-[#050505] overflow-hidden">
      <PerformanceOverlay title="ILUMINACIÓN EXHAUSTIVA: Múltiples Luces y Sombras" />

      <Canvas camera={{ position: [0, 20, 35], fov: 50 }} shadows>
        <DebugTools />
        {/* SoftShadows incrementa drásticamente el costo de cálculo de sombras para la GPU */}
        <SoftShadows size={15} samples={10} focus={0.5} />
        
        <OrbitControls makeDefault maxPolarAngle={Math.PI / 2 - 0.05} />
        <ExhaustiveDynamicLightsScene />
      </Canvas>

      <div className="fixed bottom-0 left-0 w-full p-8 text-white/30 text-xs pointer-events-none text-center font-mono z-50">
        GPU STRESS - DIRECTIONAL + SPOTLIGHTS + POINTLIGHTS + SOFTSHADOWS ON 200 COMPLEX GEOMETRIES
      </div>
    </main>
  )
}
