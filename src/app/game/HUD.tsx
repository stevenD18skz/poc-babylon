"use client";

import { useEffect, useState } from "react";
import { getState, subscribe, RoomName } from "./gameState";

export function HUD() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentRoom, setCurrentRoom] = useState<RoomName>("Exterior");
  const [isDebug, setIsDebug] = useState(false);
  const [fps, setFps] = useState(0);

  const [targetItem, setTargetItem] = useState<string | null>(null);

  useEffect(() => {
    // Sincronizar estado global con React
    const unsubscribe = subscribe((state) => {
      setIsPlaying(state.isPlaying);
      setCurrentRoom(state.currentRoom);
      setIsDebug(state.isDebugMode);
      setFps(Math.round(state.fps));
      setTargetItem(state.targetItem);
    });

    setIsPlaying(getState().isPlaying);
    setCurrentRoom(getState().currentRoom);
    setIsDebug(getState().isDebugMode);
    setTargetItem(getState().targetItem);

    return unsubscribe;
  }, []);

  return (
    <div
      className="absolute inset-0 pointer-events-none select-none z-10"
      style={{
        zIndex: 10, // Asegurar que está encima del canvas
      }}
    >
      {/* Retícula (Crosshair) para modo FPS */}
      {isPlaying && !isDebug && (
        <div className="absolute inset-0 flex items-center justify-center flex-col gap-2">
          <div className={`w-1.5 h-1.5 rounded-full transition-colors ${targetItem ? "bg-orange-500 scale-150 shadow-[0_0_10px_rgba(249,115,22,0.8)]" : "bg-white opacity-70"}`}></div>
          {targetItem && (
            <div className="absolute top-1/2 mt-4 text-orange-400 font-bold text-sm bg-black/50 px-3 py-1 rounded-full backdrop-blur-sm border border-orange-500/30">
              Interaccionar con {targetItem} [Click]
            </div>
          )}
        </div>
      )}

      {/* Pantalla de inicio / Menú de Pausa */}
      {!isPlaying && !isDebug && (
        <div 
          className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm pointer-events-auto cursor-pointer"
          onClick={() => {
            const canvas = document.querySelector('canvas');
            if (canvas) canvas.requestPointerLock();
          }}
        >
          <h1 className="text-4xl font-bold text-white mb-4">Exploración de Casa</h1>
          <p className="text-xl text-zinc-300 mb-8">Haz clic para comenzar</p>
          <div className="bg-zinc-900/80 p-6 rounded-2xl border border-zinc-700/50 shadow-2xl space-y-3">
            <h2 className="text-orange-400 font-bold uppercase text-sm mb-4">Controles</h2>
            <div className="flex justify-between gap-8 text-white"><span className="text-zinc-400">Moverse</span> <span className="font-mono bg-zinc-800 px-2 py-1 rounded">W A S D</span></div>
            <div className="flex justify-between gap-8 text-white"><span className="text-zinc-400">Mirar</span> <span className="font-mono bg-zinc-800 px-2 py-1 rounded">Ratón</span></div>
            <div className="flex justify-between gap-8 text-white"><span className="text-zinc-400">Debug Cam</span> <span className="font-mono bg-zinc-800 px-2 py-1 rounded">C</span></div>
            <div className="flex justify-between gap-8 text-white"><span className="text-zinc-400">Pausa/Salir</span> <span className="font-mono bg-zinc-800 px-2 py-1 rounded">ESC</span></div>
          </div>
        </div>
      )}

      {/* Interfaz In-Game (HUD) */}
      {(isPlaying || isDebug) && (
        <div className="absolute top-0 w-full p-6 flex justify-between items-start">
          <div className="bg-black/40 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/10 shadow-lg">
            <p className="text-sm text-zinc-400 uppercase font-bold tracking-widest mb-1">Ubicación</p>
            <p className="text-3xl font-black text-white">{currentRoom}</p>
          </div>
          
          <div className="flex flex-col gap-3 items-end">
            <div className="bg-black/40 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 shadow-lg flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${fps > 50 ? "bg-green-500" : fps > 30 ? "bg-yellow-500" : "bg-red-500"}`}></div>
              <p className="font-mono text-white text-sm">{fps} FPS</p>
            </div>
            {isDebug && (
              <div className="bg-orange-500/20 backdrop-blur-md border border-orange-500/50 px-4 py-2 rounded-xl text-orange-400 font-bold text-sm select-none animate-pulse">
                DEBUG MODE ACTIVE
              </div>
            )}
            <div className="bg-black/40 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 text-xs text-zinc-300 pointer-events-auto">
              [C] Toggle Debug | [ESC] Pause
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
