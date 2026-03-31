'use client'

import { Canvas, useFrame } from '@react-three/fiber'
import { useState, useMemo, useRef } from 'react'
import { Physics, RigidBody, CuboidCollider } from '@react-three/rapier'
import PerformanceOverlay from '@/components/test/PerformanceOverlay'
import DebugTools from '@/components/DebugTools'
import { OrbitControls, Environment } from '@react-three/drei'

function FallingObjects({ count }: { count: number }) {
  const instances = useMemo(() => {
    return Array.from({ length: count }).map((_, i) => ({
      id: i,
      position: [(Math.random() - 0.5) * 8, 10 + i * 0.5, (Math.random() - 0.5) * 8] as [number, number, number],
      color: `hsl(${Math.random() * 360}, 70%, 50%)`,
      type: Math.random() > 0.5 ? 'box' : 'sphere'
    }))
  }, [count])

  return (
    <>
      {instances.map((obj) => (
        <RigidBody key={obj.id} position={obj.position} colliders={obj.type === 'box' ? 'cuboid' : 'ball'}>
          <mesh castShadow>
            {obj.type === 'box' ? <boxGeometry args={[1, 1, 1]} /> : <sphereGeometry args={[0.6, 16, 16]} />}
            <meshStandardMaterial color={obj.color} />
          </mesh>
        </RigidBody>
      ))}
    </>
  )
}

export default function PhysicsStressTest() {
  return (
    <main className="w-full h-screen bg-[#050505] overflow-hidden">
      <PerformanceOverlay title="Estrés de Física (200 RigidBodies)" />

      <Canvas shadows camera={{ position: [15, 15, 15], fov: 45 }}>
        <DebugTools />
        <OrbitControls makeDefault />
        <Environment preset="city" />
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 10]} intensity={1.5} castShadow />

        <Physics gravity={[0, -9.81, 0]}>
          <FallingObjects count={200} />
          
          {/* Suelo Kinematic */}
          <RigidBody type="fixed">
            <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[30, 30]} />
              <meshStandardMaterial color="#222" />
            </mesh>
            <CuboidCollider args={[15, 0.1, 15]} />
          </RigidBody>
          
          {/* Paredes Invisibles para contener los objetos */}
          <RigidBody type="fixed">
             <CuboidCollider args={[15, 10, 0.1]} position={[0, 5, 15]} />
             <CuboidCollider args={[15, 10, 0.1]} position={[0, 5, -15]} />
             <CuboidCollider args={[0.1, 10, 15]} position={[15, 5, 0]} />
             <CuboidCollider args={[0.1, 10, 15]} position={[-15, 5, 0]} />
          </RigidBody>
        </Physics>
      </Canvas>

      <div className="fixed bottom-0 left-0 w-full p-8 text-white/30 text-xs pointer-events-none text-center font-mono">
        CPU/WASM STRESS - RAPIER PHYSICS ENGINE WITH 200 INTERACTING RIGIDBODIES
      </div>
    </main>
  )
}
