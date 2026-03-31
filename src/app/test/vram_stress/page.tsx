'use client'

import { Canvas, useFrame } from '@react-three/fiber'
import { useState, useMemo, useRef, Suspense } from 'react'
import * as THREE from 'three'
import PerformanceOverlay from '@/components/test/PerformanceOverlay'
import DebugTools from '@/components/DebugTools'
import { OrbitControls, Environment, Sphere, Text } from '@react-three/drei'

// Generador de texturas procedurales pesadas para simular VRAM
function VramObject({ index, count }: { index: number, count: number }) {
  // Crear una textura procedural "ruidosa" que sea única para cada objeto
  // Esto obliga al navegador a guardarlas por separado en la memoria de video
  const texture = useMemo(() => {
    const size = 1024 // Texturas de 1K
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')!
    
    // Dibujo aleatorio complejo para forzar datos en memoria
    for (let i = 0; i < 500; i++) {
        ctx.fillStyle = `hsl(${Math.random() * 360}, 100%, 50%)`
        ctx.fillRect(Math.random() * size, Math.random() * size, size/10, size/10)
    }
    
    const tex = new THREE.CanvasTexture(canvas)
    tex.anisotropy = 16
    return tex
  }, [index])

  const position: [number, number, number] = [
    (Math.random() - 0.5) * 20,
    (Math.random() - 0.5) * 20,
    (Math.random() - 0.5) * 20
  ]

  return (
    <mesh position={position} rotation={[Math.random() * Math.PI, 0, 0]}>
      <sphereGeometry args={[1, 32, 32]} />
      <meshStandardMaterial map={texture} roughness={0.3} metalness={0.7} />
    </mesh>
  )
}

function VramManager({ numTextures }: { numTextures: number }) {
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 10]} />
      {Array.from({ length: numTextures }).map((_, i) => (
        <VramObject key={i} index={i} count={numTextures} />
      ))}
    </>
  )
}

export default function VramStressTest() {
  const [numTextures, setNumTextures] = useState(20)

  return (
    <main className="w-full h-screen bg-[#050505] overflow-hidden">
      <PerformanceOverlay title={`Estrés de Memoria: ${numTextures} Textura(s) 1K`} />

      {/* Control Manual para aumentar VRAM */}
      <div className="fixed top-8 right-8 z-50 bg-black/80 backdrop-blur-xl border border-white/10 p-6 rounded-3xl flex flex-col gap-4">
        <label className="text-gray-400 text-xs uppercase tracking-widest font-bold">Carga de VRAM (Lento)</label>
        <div className="flex gap-2">
            {[20, 50, 100].map(n => (
                <button 
                  key={n}
                  onClick={() => setNumTextures(n)}
                  className={`px-4 py-2 rounded-xl transition-all ${numTextures === n ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'bg-white/5 hover:bg-white/10 text-gray-400'}`}
                >
                    {n} Texturas
                </button>
            ))}
        </div>
        <p className="text-[10px] text-gray-500 italic max-w-xs leading-tight">
          Cada botón carga más texturas únicas en el GPU. 100 texturas de 1K pueden ocupar aprox. ~400MB-600MB de VRAM.
        </p>
      </div>

      <Canvas camera={{ position: [0, 0, 30], fov: 45 }}>
        <DebugTools />
        <OrbitControls makeDefault autoRotate autoRotateSpeed={0.5} />
        <Suspense fallback={null}>
          <VramManager numTextures={numTextures} />
        </Suspense>
      </Canvas>

      <div className="fixed bottom-0 left-0 w-full p-8 text-white/30 text-xs pointer-events-none text-center font-mono">
        GPU VRAM STRESS - CUSTOM CANVAS TEXTURE ALLOCATION PER OBJECT
      </div>
    </main>
  )
}
