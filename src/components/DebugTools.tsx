'use client'

import { useEffect, useRef, useState } from 'react'
import * as ReactDOM from 'react-dom'

// --- SHIM PARA COMPATIBILIDAD CON REACT 19 ---
// Algunas librerías como Babylon Inspector aún buscan ReactDOM.render que fue eliminado en React 19.
if (typeof window !== 'undefined') {
    const rd = ReactDOM as any;
    if (!rd.render || (rd.default && !rd.default.render)) {
        import('react-dom/client').then(({ createRoot }) => {
            const renderShim = (element: any, container: any) => {
                const root = createRoot(container);
                root.render(element);
                return root;
            };
            if (rd.default) rd.default.render = renderShim;
            rd.render = renderShim;
        }).catch(err => console.error('Error al cargar el shim de React 19:', err));
    }
}
// --- FIN DEL SHIM ---

import { useControls } from 'leva'
import * as BABYLON from '@babylonjs/core'
import { GridMaterial } from '@babylonjs/materials'

interface DebugStats {
  fps: number
  ms: number
  mb: number
}

// Hook para crear el contexto de debug
export function useDebugControls() {
    return useControls('Debug', {
        showAxes: true,
        showGrid: true,
        showStats: true,
        statPanel: { 
            value: 0, 
            options: { 'FPS': 0, 'MS (Latencia)': 1, 'MB (Memoria RAM)': 2 },
            label: 'Métrica Stats.js'
        },
        showInspector: false,
        showGizmo: true,
        triangles: {
            value: 1_000,
            min: 1_000,
            max: 32_000,
            step: 1_000,
            label: 'Triángulos'
        }
    })
}

interface StatsPanel {
  fps: HTMLDivElement
  ms: HTMLDivElement
  mb: HTMLDivElement
  container: HTMLDivElement
}

class DebugStatsManager {
  private lastTime = performance.now()
  private frames = 0
  private fps = 60
  private ms = 0
  private lastMemory = 0
  private statsPanel: StatsPanel | null = null
  private statsMode = 0

  constructor() {
    this.createStatsPanel()
  }

  private createStatsPanel() {
    const container = document.createElement('div')
    container.style.cssText = `
      position: fixed;
      top: 64px;
      left: 16px;
      background: rgba(0, 0, 0, 0.7);
      color: #0f0;
      font-family: 'Courier New', monospace;
      font-size: 12px;
      padding: 8px;
      border-radius: 4px;
      z-index: 100;
      min-width: 80px;
      text-align: center;
      border: 1px solid #0f0;
      backdrop-filter: blur(4px);
    `

    const fps = document.createElement('div')
    const ms = document.createElement('div')
    const mb = document.createElement('div')

    container.appendChild(fps)
    container.appendChild(ms)
    container.appendChild(mb)
    document.body.appendChild(container)

    this.statsPanel = { fps, ms, mb, container }
  }

  update(engine: BABYLON.Engine) {
    const now = performance.now()
    this.ms = now - this.lastTime
    this.lastTime = now

    this.frames++
    if (this.frames >= 30) {
      this.fps = Math.round((1000 * this.frames) / (now - this.lastTime))
      this.frames = 0
    }

    // Memoria estimada (si está disponible)
    if (performance.memory) {
      this.lastMemory = Math.round(performance.memory.usedJSHeapSize / 1048576)
    }

    this.updateDisplay()
  }

  private updateDisplay() {
    if (!this.statsPanel) return

    switch (this.statsMode) {
      case 0:
        this.statsPanel.fps.textContent = `FPS\n${this.fps}`
        this.statsPanel.ms.innerHTML = ''
        this.statsPanel.mb.innerHTML = ''
        break
      case 1:
        this.statsPanel.ms.textContent = `MS\n${this.ms.toFixed(2)}`
        this.statsPanel.fps.innerHTML = ''
        this.statsPanel.mb.innerHTML = ''
        break
      case 2:
        this.statsPanel.mb.textContent = `MB\n${this.lastMemory}`
        this.statsPanel.fps.innerHTML = ''
        this.statsPanel.ms.innerHTML = ''
        break
    }
  }

  setMode(mode: number) {
    this.statsMode = mode
  }

  hide() {
    if (this.statsPanel) {
      this.statsPanel.container.style.display = 'none'
    }
  }

  show() {
    if (this.statsPanel) {
      this.statsPanel.container.style.display = 'block'
    }
  }

  dispose() {
    if (this.statsPanel) {
      this.statsPanel.container.remove()
    }
  }
}

interface DebugToolsProps {
  scene: BABYLON.Scene
  engine: BABYLON.Engine
}

export default function DebugTools({ scene, engine }: DebugToolsProps) {
    const { showAxes, showGrid, showStats, statPanel, showInspector, showGizmo } = useDebugControls()
    const statsManagerRef = useRef<DebugStatsManager | null>(null)
    const gridRef = useRef<BABYLON.Mesh | null>(null)
    const axesRef = useRef<BABYLON.AxesViewer | null>(null)
    const gizmoRef = useRef<BABYLON.GizmoManager | null>(null)

    // Inicializar Stats Manager
    useEffect(() => {
        if (showStats && !statsManagerRef.current) {
            statsManagerRef.current = new DebugStatsManager()
        } else if (!showStats && statsManagerRef.current) {
            statsManagerRef.current.dispose()
            statsManagerRef.current = null
        }
    }, [showStats])

    // Actualizar stats mode
    useEffect(() => {
        if (statsManagerRef.current) {
            statsManagerRef.current.setMode(statPanel)
        }
    }, [statPanel])

    // Mostrar/Ocultar Stats
    useEffect(() => {
        if (statsManagerRef.current) {
            if (showStats) {
                statsManagerRef.current.show()
            } else {
                statsManagerRef.current.hide()
            }
        }
    }, [showStats])

    // Actualizar stats en cada frame
    useEffect(() => {
        if (!statsManagerRef.current) return

        const observer = scene.onBeforeRenderObservable.add(() => {
            statsManagerRef.current?.update(engine)
        })

        return () => {
            scene.onBeforeRenderObservable.remove(observer)
        }
    }, [scene, engine])

    // Crear/Destruir Grid
    useEffect(() => {
        if (showGrid && !gridRef.current) {
            const grid = BABYLON.MeshBuilder.CreateGround('grid', { width: 20, height: 20, subdivisions: 20 }, scene)
            const gridMat = new GridMaterial('gridMat', scene)
            grid.material = gridMat
            gridRef.current = grid
        } else if (!showGrid && gridRef.current) {
            gridRef.current.dispose()
            gridRef.current = null
        }
    }, [showGrid, scene])

    // Crear/Destruir Axes
    useEffect(() => {
        if (showAxes && !axesRef.current) {
            axesRef.current = new BABYLON.AxesViewer(scene, 10)
        } else if (!showAxes && axesRef.current) {
            axesRef.current.dispose()
            axesRef.current = null
        }
    }, [showAxes, scene])

    useEffect(() => {
        if (showInspector) {
            import('@babylonjs/inspector').then(({ Inspector }) => {
                Inspector.Show(scene, {
                    embedMode: true,
                    globalRoot: document.body as any
                })
            })
        }
    }, [showInspector, scene])

    // Crear/Destruir Gizmo
    useEffect(() => {
        if (showGizmo && !gizmoRef.current) {
            const gizmoManager = new BABYLON.GizmoManager(scene)
            gizmoRef.current = gizmoManager
        } else if (!showGizmo && gizmoRef.current) {
            gizmoRef.current.dispose()
            gizmoRef.current = null
        }
    }, [showGizmo, scene])

    return null
}

