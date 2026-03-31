'use client'

import { Canvas } from '@react-three/fiber'
import { useState, useMemo, useCallback } from 'react'
import * as THREE from 'three'
import PerformanceOverlay from '@/components/test/PerformanceOverlay'
import DebugTools from '@/components/DebugTools'
import { OrbitControls, Text } from '@react-three/drei'

function InteractiveBox({ position, index, onHit }: { position: [number, number, number], index: number, onHit: (i: number) => void }) {
  const [hovered, setHovered] = useState(false)
  const [clicked, setClicked] = useState(false)

  return (
    <mesh
      position={position}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true) }}
      onPointerOut={() => setHovered(false)}
      onClick={(e) => { e.stopPropagation(); setClicked(true); onHit(index) }}
      scale={clicked ? 0.5 : hovered ? 1.3 : 1}
    >
      <boxGeometry args={[0.6, 0.6, 0.6]} />
      <meshStandardMaterial
        color={clicked ? '#22c55e' : hovered ? '#3b82f6' : '#6366f1'}
        emissive={hovered ? '#3b82f6' : '#000000'}
        emissiveIntensity={hovered ? 0.4 : 0}
      />
    </mesh>
  )
}

function RaycastScene({ count, onHit }: { count: number, onHit: (i: number) => void }) {
  const boxes = useMemo(() => {
    const list = []
    const cols = Math.ceil(Math.sqrt(count))
    for (let i = 0; i < count; i++) {
      const x = (i % cols) * 1.2 - (cols * 1.2) / 2
      const z = Math.floor(i / cols) * 1.2 - (cols * 1.2) / 2
      list.push([x, 0.3, z] as [number, number, number])
    }
    return list
  }, [count])

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.01, 0]}>
        <planeGeometry args={[50, 50]} />
        <meshStandardMaterial color="#111127" />
      </mesh>
      {boxes.map((pos, i) => (
        <InteractiveBox key={i} position={pos} index={i} onHit={onHit} />
      ))}
    </>
  )
}

export default function RaycastTest() {
  const [hitCount, setHitCount] = useState(0)
  const totalObjects = 500

  const handleHit = useCallback((i: number) => {
    setHitCount((prev) => prev + 1)
  }, [])

  return (
    <main className="w-full h-screen bg-[#050505] overflow-hidden">
      <PerformanceOverlay title={`Raycasting: ${totalObjects} Objetos Interactivos`} />

      {/* Hit Counter */}
      <div className="fixed top-6 right-6 z-50 bg-black/80 backdrop-blur-xl border border-white/10 px-6 py-4 rounded-2xl">
        <p className="text-gray-400 text-xs uppercase tracking-widest mb-1">Objetos Clickeados</p>
        <p className="text-3xl font-mono font-black text-emerald-400">{hitCount} <span className="text-gray-500 text-sm">/ {totalObjects}</span></p>
      </div>

      <Canvas camera={{ position: [0, 20, 20], fov: 50 }} raycaster={{ params: {
        Line: { threshold: 0.1 },
        Mesh: undefined,
        LOD: undefined,
        Points: {
          threshold: 0
        },
        Sprite: undefined
      } }}>
        <DebugTools />
        <OrbitControls makeDefault />
        <RaycastScene count={totalObjects} onHit={handleHit} />
      </Canvas>

      <div className="fixed bottom-0 left-0 w-full p-8 text-white/30 text-xs pointer-events-none text-center font-mono">
        EVENT SYSTEM STRESS - POINTER RAYCASTING ON {totalObjects} OBJECTS
      </div>
    </main>
  )
}
