'use client'

import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useRef, useMemo, useState, useEffect } from 'react'
import * as THREE from 'three'
import PerformanceOverlay from '@/components/test/PerformanceOverlay'
import DebugTools from '@/components/DebugTools'
import { OrbitControls, Environment } from '@react-three/drei'

function AnimatedSphere({ position, delay }: { position: [number, number, number], delay: number }) {
  const ref = useRef<THREE.Mesh>(null!)
  const materialRef = useRef<THREE.MeshStandardMaterial>(null!)

  useFrame((state) => {
    const t = state.clock.getElapsedTime() + delay
    ref.current.position.y = position[1] + Math.sin(t * 2) * 1.5
    ref.current.scale.setScalar(0.8 + Math.sin(t * 3) * 0.3)
    ref.current.rotation.x = t * 0.5
    ref.current.rotation.z = t * 0.3
    materialRef.current.emissiveIntensity = 0.3 + Math.sin(t * 4) * 0.3
  })

  return (
    <mesh ref={ref} position={position}>
      <icosahedronGeometry args={[0.3, 1]} />
      <meshStandardMaterial
        ref={materialRef}
        color={`hsl(${delay * 50}, 70%, 50%)`}
        emissive={`hsl(${delay * 50}, 70%, 30%)`}
        roughness={0.3}
        metalness={0.7}
      />
    </mesh>
  )
}

function AnimationScene({ count }: { count: number }) {
  const spheres = useMemo(() => {
    const list = []
    for (let i = 0; i < count; i++) {
      const theta = (i / count) * Math.PI * 8
      const ring = Math.floor(i / 50)
      const r = 3 + ring * 1
      list.push({
        position: [Math.cos(theta) * r, 0, Math.sin(theta) * r] as [number, number, number],
        delay: i * 0.15
      })
    }
    return list
  }, [count])

  return (
    <>
      <ambientLight intensity={0.3} />
      <pointLight position={[0, 10, 0]} intensity={5} color="#8b5cf6" />
      <pointLight position={[10, 5, 10]} intensity={3} color="#3b82f6" />
      {spheres.map((s, i) => (
        <AnimatedSphere key={i} position={s.position} delay={s.delay} />
      ))}
    </>
  )
}

export default function AnimationStressTest() {
  return (
    <main className="w-full h-screen bg-[#050505] overflow-hidden">
      <PerformanceOverlay title="500 Objetos Animados (useFrame)" />

      <Canvas camera={{ position: [0, 15, 25], fov: 50 }}>
        <DebugTools />
        <OrbitControls makeDefault />
        <AnimationScene count={2000} />
      </Canvas>

      <div className="fixed bottom-0 left-0 w-full p-8 text-white/30 text-xs pointer-events-none text-center font-mono">
        ANIMATION LOOP STRESS - useFrame() ON 500 INDIVIDUAL REFS
      </div>
    </main>
  )
}
