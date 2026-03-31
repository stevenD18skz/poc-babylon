'use client'

import { Canvas, useFrame } from '@react-three/fiber'
import { useRef, useMemo } from 'react'
import * as THREE from 'three'
import PerformanceOverlay from '@/components/test/PerformanceOverlay'
import DebugTools, { useDebugControls } from '@/components/DebugTools'
import { OrbitControls } from '@react-three/drei'

function RotatingTriangle({ position, color, rotationSpeed }: { position: [number, number, number], color: string, rotationSpeed: number }) {
  const meshRef = useRef<THREE.Mesh>(null!)
  
  useFrame((state, delta) => {
    meshRef.current.rotation.x += delta * rotationSpeed
    meshRef.current.rotation.y += delta * (rotationSpeed / 2)
  })

  return (
    <mesh ref={meshRef} position={position}>
      <coneGeometry args={[0.2, 0.4, 3]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.2} />
    </mesh>
  )
}

function TriangleScene({ numTriangles }: { numTriangles: number }) {
  const triangles = (() => {
    const list = []
    for (let i = 0; i < numTriangles; i++) {
      const theta = Math.random() * Math.PI * 2
      const phi = Math.random() * Math.PI
      const r = 5 + Math.random() * 5
      
      const x = r * Math.sin(phi) * Math.cos(theta)
      const y = r * Math.sin(phi) * Math.sin(theta)
      const z = r * Math.cos(phi)
      
      list.push({
        position: [x, y, z] as [number, number, number],
        color: `hsl(${Math.random() * 360}, 70%, 50%)`,
        rotationSpeed: (Math.random() - 0.5) * 5
      })
    }
    return list
  })()

  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={1} />
      {triangles.map((t, i) => (
        <RotatingTriangle key={i} {...t} />
      ))}
    </>
  )
}

export default function TrianglesRotatingTest() {
  const { triangles } = useDebugControls()

  return (
    <main className="w-full h-screen bg-[#050505] overflow-hidden">
      <PerformanceOverlay title={`Triángulos Rotando (${triangles})`} />
      
      <Canvas camera={{ position: [0, 0, 15], fov: 50 }}>
          <DebugTools />
          <OrbitControls makeDefault />
          <TriangleScene numTriangles={triangles} />
      </Canvas>

      <div className="fixed bottom-0 left-0 w-full p-8 text-white/30 text-xs pointer-events-none text-center font-mono">
        STRESS TEST - INDIVIDUAL MATRIX UPDATES - {triangles} OBJECTS
      </div>
    </main>
  )
}
