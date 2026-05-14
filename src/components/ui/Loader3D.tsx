'use client'

import React from 'react'

/**
 * Loader3D Component
 * A premium, visually stunning 3D loading overlay with glassmorphism and animated geometric elements.
 * Designed to be used as a fallback for 3D scene initialization.
 */
export default function Loader3D() {
  return (
    <div className="absolute inset-0 z-100 flex items-center justify-center bg-black/60 backdrop-blur-xl transition-opacity duration-700">
      <div className="relative group">
        {/* Animated Background Glows */}
        <div className="absolute -inset-16 bg-blue-600/20 rounded-full blur-[80px] animate-pulse" />
        <div className="absolute -inset-16 bg-emerald-600/10 rounded-full blur-[60px] animate-pulse delay-700" />
        
        {/* Central Loader Container */}
        <div className="relative flex flex-col items-center p-12 rounded-[2.5rem] bg-white/3 border border-white/10 shadow-2xl backdrop-blur-2xl">
          
          {/* Geometric Spinner */}
          <div className="relative w-32 h-32 mb-10">
            {/* Outer Ring */}
            <div className="absolute inset-0 rounded-full border-2 border-slate-700/50" />
            <div className="absolute inset-0 rounded-full border-t-2 border-blue-500 animate-[spin_3s_linear_infinite]" />
            
            {/* Middle Ring */}
            <div className="absolute inset-4 rounded-full border-2 border-slate-700/30" />
            <div className="absolute inset-4 rounded-full border-r-2 border-emerald-400 animate-[spin_2s_linear_infinite_reverse]" />
            
            {/* Inner Ring */}
            <div className="absolute inset-8 rounded-full border-2 border-slate-700/20" />
            <div className="absolute inset-8 rounded-full border-l-2 border-orange-400 animate-[spin_1.5s_linear_infinite]" />
            
            {/* Core Pulse */}
            <div className="absolute inset-[42%] bg-white rounded-full shadow-[0_0_20px_rgba(255,255,255,0.6)] animate-pulse" />
          </div>

          {/* Text Content */}
          <div className="flex flex-col items-center gap-3">
            <h2 className="text-3xl font-black text-white tracking-tight uppercase italic flex items-center gap-2">
              <span className="bg-linear-to-r from-blue-400 via-emerald-400 to-orange-400 bg-clip-text text-transparent">
                Syncing
              </span>
              <span className="text-slate-500">Engine</span>
            </h2>
            
            <div className="flex items-center gap-1.5">
              {[0, 1, 2].map((i) => (
                <div 
                  key={i}
                  className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
            
            <p className="mt-4 text-[10px] font-mono text-slate-500 uppercase tracking-[0.3em]">
              Initializing 3D Geometry
            </p>
          </div>

          {/* Progress Bar Decorator */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/2 h-px bg-linear-to-r from-transparent via-blue-500/50 to-transparent" />
      </div>
    </div>
    </div>
  )
}
