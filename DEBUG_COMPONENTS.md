# Componentes Debug Babylon.js

He recodificado tus componentes de React Three Fiber para que funcionen con Babylon.js, manteniendo las mismas estadísticas y funcionalidades.

## DebugTools.tsx

Componente que proporciona herramientas de debug interactivas para Babylon.js con controles Leva.

### Características

- **Stats Manager**: Sistema de estadísticas personalizado que muestra:
  - FPS (Frames Per Second)
  - MS (Latencia del frame en milisegundos)
  - MB (Memoria RAM usada)

- **Grid**: Malla de cuadrícula visual para referencia espacial
- **Axes Viewer**: Ejes XYZ para visualizar orientación
- **Inspector**: Acceso al Inspector completo de Babylon.js
- **Gizmo Manager**: Herramientas de manipulación 3D

### Uso

```tsx
import DebugTools from '@/components/DebugTools'
import * as BABYLON from '@babylonjs/core'

export default function YourScene() {
  const [scene, setScene] = useState<BABYLON.Scene | null>(null)
  const [engine, setEngine] = useState<BABYLON.Engine | null>(null)

  return (
    <>
      {/* Tu canvas y setup de Babylon */}
      {scene && engine && <DebugTools scene={scene} engine={engine} />}
    </>
  )
}
```

### Controles Leva

Accede a los controles a través del panel Leva (esquina superior derecha):

- `showAxes`: Toggle de los ejes XYZ
- `showGrid`: Toggle de la malla de cuadrícula
- `showStats`: Toggle del panel de estadísticas
- `statPanel`: Selecciona qué estadística mostrar (FPS, MS, MB)
- `showInspector`: Abre el Inspector completo de Babylon.js
- `showGizmo`: Toggle del Gizmo Manager
- `triangles`: Ajusta el número de triángulos (1k - 32k)

## PerformanceOverlay.tsx

Componente de overlay que muestra el título de la escena y botón de navegación.

### Uso

```tsx
import PerformanceOverlay from '@/components/test/PerformanceOverlay'

export default function TestScene() {
  return (
    <>
      <PerformanceOverlay title="Mi Escena de Prueba" />
      {/* Tu contenido */}
    </>
  )
}
```

## Cambios Principales

### De R3F → Babylon.js

| R3F | Babylon.js |
|-----|-----------|
| `@react-three/drei` Stats | Custom StatsManager |
| `Grid` component | GridMaterial + Ground |
| `GizmoHelper` | GizmoManager |
| `AxesHelper` | AxesViewer |
| N/A | Inspector widget |

### Estadísticas

Las estadísticas se actualizan en cada frame del engine de Babylon.js y se mostrado en la esquina superior izquierda con el mismo diseño visual.

## Instalación

Ya está instalado en el proyecto:

```bash
npm install leva @babylonjs/core @babylonjs/loaders
```

## Notas

- El `StatsManager` utiliza `performance.memory` para memoria RAM (solo disponible en Chrome con extensiones de herramientas)
- Puedes cambiar el modo de estadísticas en tiempo real usando el control `statPanel` en Leva
- El Inspector de Babylon.js abre en modo `embedMode` cuando se habilita

## Equivalentes Próximos

Si necesitas agregar más funcionalidades:

- **Performance Monitor**: Usa el Inspector de Babylon.js (showInspector)
- **Lighting Analysis**: Viewer de Babylon.js
- **Texture Inspector**: Inspector de Babylon.js
- **Physics Debugger**: Inspector + modo de debug de física

---

Todos los componentes están listos para usar. Solo asegúrate de pasar `scene` y `engine` válidos a `DebugTools`.