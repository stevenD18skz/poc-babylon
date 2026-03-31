import Link from 'next/link'

export default function Home() {
  const sections = [
    {
      id: 'tests',
      title: 'Pruebas Técnicas',
      description: 'Benchmark de rendimiento WebGL: FPS, latencia, draw calls, triángulos y memoria bajo distintas cargas de estrés.',
      path: '/test',
      icon: '📊',
      cta: 'Ir al Laboratorio'
    },
    {
      id: 'poc',
      title: 'POC - Game Interactivo',
      description: 'Prueba de concepto funcional: exploración FPS en primera persona con generación procedural de habitaciones, física y mascotas.',
      path: '/poc',
      icon: '🎮',
      cta: 'Explorar la Casa'
    }
  ]

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white p-8 md:p-16 flex flex-col items-center justify-center font-sans overflow-hidden relative">
      {/* Background Decorative Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute top-[50%] left-[50%] -translate-x-1/2 -translate-y-1/2 w-[30%] h-[30%] bg-indigo-600/10 blur-[150px] rounded-full pointer-events-none" />

      {/* Hero */}
      <header className="text-center mb-20 relative z-10 max-w-4xl">
        <div className="inline-block bg-white/5 border border-white/10 rounded-full px-5 py-2 text-xs font-bold uppercase tracking-widest text-blue-400 mb-8">
          Trabajo de Grado — 2026
        </div>
        <h1 className="text-5xl md:text-7xl font-black bg-linear-to-r from-blue-400 via-indigo-400 to-purple-500 bg-clip-text text-transparent mb-6 tracking-tight leading-tight">
          POC Babylon.js
        </h1>
        <p className="text-gray-400 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
          Prueba de concepto para evaluar <span className="text-white font-semibold">Babylon.js</span> como motor de renderizado 3D en una plataforma web orientada a <span className="text-white font-semibold">psicología</span>.
        </p>
        <div className="mt-6 border-t border-white/10 pt-6 text-gray-500 text-sm max-w-lg mx-auto">
          Incluye pruebas de rendimiento con métricas reales y un prototipo jugable que demuestra las capacidades de la librería.
        </div>
      </header>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl relative z-10">
        {sections.map((section) => (
          <Link
            key={section.id}
            href={section.path}
            className="group relative bg-white/5 backdrop-blur-xl border border-white/10 p-10 rounded-3xl transition-all duration-500 hover:bg-white/10 hover:border-white/20 hover:-translate-y-2 flex flex-col"
          >
            <div className="text-5xl mb-6 group-hover:scale-110 transition-transform duration-500">
              {section.icon}
            </div>
            <h2 className="text-2xl font-bold mb-4 text-white group-hover:text-blue-400 transition-colors">
              {section.title}
            </h2>
            <p className="text-gray-400 leading-relaxed mb-8 grow">
              {section.description}
            </p>
            <div className="flex items-center text-blue-400 font-semibold group-hover:translate-x-2 transition-transform">
              {section.cta}
              <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </div>

            <div className="absolute inset-0 bg-linear-to-br from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 rounded-3xl transition-opacity duration-500 pointer-events-none" />
          </Link>
        ))}
      </div>

      {/* Footer */}
      <footer className="mt-20 text-gray-500 flex flex-col items-center gap-2 relative z-10">
        <p className="text-sm">Plataforma Web 3D para Psicología — Análisis de Performance WebGL</p>
        <p className="text-xs text-gray-600">Tesis de Grado © 2026</p>
      </footer>
    </main>
  )
}