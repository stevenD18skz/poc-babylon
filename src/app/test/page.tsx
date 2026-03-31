import Link from 'next/link';

export default function TestDashboard() {
  const tests = [
    {
      id: 'scene_idle',
      title: 'Escena Idle (60s)',
      description: 'Mide el rendimiento base de la plataforma con la escena principal cargada sin interacción.',
      path: '/test/scene_idle',
      icon: '🧊'
    },
    {
      id: 'triangles_static',
      title: '512,000 Triángulos Estáticos',
      description: 'Prueba de renderizado masivo y gestión de buffers en WebGL.',
      path: '/test/triangles_static',
      icon: '📐'
    },
    {
      id: 'triangles_rotating',
      title: '4,000 Triángulos Rotando',
      description: 'Prueba de estrés de CPU/GPU mediante el procesamiento de transformaciones en tiempo real.',
      path: '/test/triangles_rotating',
      icon: '🌀'
    },
    {
      id: 'dynamic_lights',
      title: 'Luces Dinámicas',
      description: 'Prueba de carga sobre GPU con mapeo de sombras dinámicas y shaders.',
      path: '/test/dynamic_lights',
      icon: '💡'
    },
    {
      id: 'raycasting',
      title: '500 Objetos - Eventos',
      description: 'Prueba el sistema de interactividad nativo en múltiples intersecciones concurrentes.',
      path: '/test/raycasting',
      icon: '🖱️'
    },
    {
      id: 'animation_stress',
      title: '500 Animaciones (useFrame)',
      description: 'Prueba de sobrecarga del ciclo de renderizado R3F por ref independientes.',
      path: '/test/animation_stress',
      icon: '☄️'
    },
    {
      id: 'npc_ai',
      title: 'Simulación NPC (IA Asincrónica)',
      description: 'Mide la eficiencia de resolver eventos asincrónicos (APIs de IA) y alterar matrices continuas.',
      path: '/test/npc_ai',
      icon: '🐈'
    },
    {
      id: 'physics_stress',
      title: 'Estrés de Física (200 RigidBodies)',
      description: 'Prueba de estrés de CPU/GPU mediante el procesamiento de transformaciones en tiempo real.',
      path: '/test/physics_stress',
      icon: '🪨'
    },
    {
      id: 'vram_stress',
      title: 'Estrés de Memoria (200 Texturas)',
      description: 'Prueba de estrés de VRAM mediante el procesamiento de texturas en tiempo real.',
      path: '/test/vram_stress',
      icon: '💽'
    }
  ];

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white p-8 md:p-16 flex flex-col items-center justify-center font-sans overflow-hidden relative">
      {/* Background Decorative Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/20 blur-[120px] rounded-full pointer-events-none" />


      <div className='absolute top-4 left-4 z-10'>
        <Link
          href="/"
          className="group relative bg-white/5 backdrop-blur-xl border border-white/10 p-3 rounded-2xl transition-all duration-500 hover:bg-white/10 hover:border-white/20  flex flex-col"
        >
          <div className="flex items-center text-blue-400 font-medium transition-transform">
            <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Volver
          </div>
          <div className="absolute inset-0 bg-linear-to-br from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 rounded-2xl transition-opacity duration-500 pointer-events-none" />
        </Link>
      </div>

      <header className="text-center mb-16 relative z-10">
        <h1 className="text-5xl md:text-7xl font-bold bg-linear-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent mb-4 tracking-tight">
          Panel de Pruebas R3F
        </h1>
        <p className="text-gray-400 text-lg md:text-xl max-w-2xl mx-auto border-b border-white/10 pb-6">
          Métricas de rendimiento para investigación de grado: Plataformas Web 3D para Psicología.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-6xl relative z-10">
        {tests.map((test) => (
          <Link
            key={test.id}
            href={test.path}
            target="_blank"
            className="group relative bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-3xl transition-all duration-500 hover:bg-white/10 hover:border-white/20 hover:-translate-y-2 flex flex-col h-full"
          >
            <div className="text-4xl mb-6 group-hover:scale-110 transition-transform duration-500">
              {test.icon}
            </div>
            <h2 className="text-2xl font-semibold mb-4 text-white group-hover:text-blue-400 transition-colors">
              {test.title}
            </h2>
            <p className="text-gray-400 leading-relaxed mb-8 grow">
              {test.description}
            </p>
            <div className="flex items-center text-blue-400 font-medium group-hover:translate-x-2 transition-transform">
              Iniciar prueba
              <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </div>

            {/* Hover Glow Effect */}
            <div className="absolute inset-0 bg-linear-to-br from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 rounded-3xl transition-opacity duration-500 pointer-events-none" />
          </Link>
        ))}
      </div>

      <footer className="mt-20 text-gray-500 flex flex-col items-center gap-4">
        <Link href="/" className="hover:text-white transition-colors flex items-center gap-2">
          <svg className="w-4 h-4 rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
          Volver a la Casa
        </Link>
        <p className="text-sm">Tesis Grado © 2026 - Análisis de Performance WebGL</p>
      </footer>
    </main>
  );
}
