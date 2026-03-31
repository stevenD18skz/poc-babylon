'use client'

import { Canvas, useFrame } from '@react-three/fiber'
import { useRef, useMemo, useEffect } from 'react'
import * as THREE from 'three'
import PerformanceOverlay from '@/components/test/PerformanceOverlay'
import DebugTools, { useDebugControls } from '@/components/DebugTools'
import { OrbitControls, Sparkles } from '@react-three/drei'

function InstancedTriangles({ count = 10000 }) {
  const meshRef = useRef<THREE.InstancedMesh>(null!)
  const tempObject = new THREE.Object3D()

  useEffect(() => {
    for (let i = 0; i < count; i++) {
      const radius = 10 + Math.random() * 15
      const theta = Math.random() * Math.PI * 2
      const phi = Math.random() * Math.PI
      
      tempObject.position.set(
        radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.sin(phi) * Math.sin(theta),
        radius * Math.cos(phi)
      )
      
      tempObject.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI)
      tempObject.updateMatrix()
      meshRef.current.setMatrixAt(i, tempObject.matrix)
      
      // Random colors for aesthetics
      meshRef.current.setColorAt(i, new THREE.Color(`hsl(${Math.random() * 50 + 200}, 80%, 50%)`))
    }
    meshRef.current.instanceMatrix.needsUpdate = true
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true
  }, [count])

  // Optional: Gentle vibration/oscillation
  useFrame((state) => {
    const t = state.clock.getElapsedTime()
    meshRef.current.rotation.y = t * 0.05
  })

  return (
    <instancedMesh ref={meshRef} args={[null!, null!, count]}>
      <coneGeometry args={[0.1, 0.2, 3]} />
      <meshStandardMaterial />
    </instancedMesh>
  )
}

export default function TrianglesStaticTest() {
  const { triangles } = useDebugControls()

  return (
    <main className="w-full h-screen bg-[#050505] overflow-hidden">
      <PerformanceOverlay title={`${512_000} Triángulos Estáticos`} />
      
      <Canvas camera={{ position: [20, 20, 20], fov: 50 }}>
          <DebugTools />
          <OrbitControls makeDefault autoRotate autoRotateSpeed={0.5} />
          
          <ambientLight intensity={0.5} />
          <pointLight position={[10, 10, 10]} intensity={2} color="#4f46e5" />
          <pointLight position={[-10, -10, -10]} intensity={1} color="#9333ea" />
          
          <Sparkles count={500} size={5} speed={0.5} scale={30} opacity={0.3} color="#ffffff" />
          <InstancedTriangles count={512_000} />
      </Canvas>

      <div className="fixed bottom-0 left-0 w-full p-8 text-white/30 text-xs pointer-events-none text-center font-mono">
        INSTANCED RENDERING - SINGLE DRAW CALL - GPGPU OPTIMIZED
      </div>
    </main>
  )
}
