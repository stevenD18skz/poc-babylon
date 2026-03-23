import Image from "next/image";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 font-sans dark:bg-[#0a0a0a] text-zinc-900 dark:text-zinc-100 selection:bg-orange-200 dark:selection:bg-orange-800">
      {/* Navbar Placeholder */}
      <nav className="fixed top-0 z-50 w-full px-6 py-4 backdrop-blur-md bg-white/30 dark:bg-black/30 border-b border-zinc-200/50 dark:border-zinc-800/50">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-linear-to-tr from-orange-500 to-amber-400 shadow-lg" />
            <span className="text-xl font-bold tracking-tight">BabylonPet<span className="text-orange-500 underline decoration-2 underline-offset-4">POC</span></span>
          </div>
          <div className="hidden gap-8 text-sm font-medium sm:flex">
            <a href="#about" className="hover:text-orange-500 transition-colors">About</a>
            <a href="#parameters" className="hover:text-orange-500 transition-colors">Parameters</a>
            <a href="#tech" className="hover:text-orange-500 transition-colors">Technology</a>
          </div>
          <button className="rounded-full bg-zinc-900 px-6 py-2 text-sm font-semibold text-white transition-all hover:bg-orange-600 dark:bg-zinc-100 dark:text-black dark:hover:bg-orange-400 shadow-md cursor-pointer">
            Enter Simulation
          </button>
        </div>
      </nav>

      <main className="flex-1 pt-24">
        {/* Hero Section */}
        <section className="relative px-6 py-24 sm:py-32 overflow-hidden">
          <div className="mx-auto max-w-7xl grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="flex flex-col gap-8">
              <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-600 dark:border-orange-900/30 dark:bg-orange-900/20 dark:text-orange-400 w-fit">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
                </span>
                Active Experiment
              </div>
              <h1 className="text-5xl font-extrabold tracking-tight sm:text-7xl leading-[1.1]">
                Testing <span className="text-transparent bg-clip-text bg-linear-to-r from-orange-500 via-amber-500 to-yellow-400">Babylon.js</span> in a Cozy Pet Home
              </h1>
              <p className="text-lg leading-relaxed text-zinc-600 dark:text-zinc-400 max-w-xl">
                A Proof of Concept designed to push the boundaries of real-time 3D web rendering. We are simulating a pet feeding game within a detailed house environment to test complex parameters including physics, AI pathfinding, and PBR materials.
              </p>
              <div className="flex flex-col gap-4 sm:flex-row">
                <button className="group relative flex h-14 items-center justify-center gap-2 overflow-hidden rounded-2xl bg-orange-500 px-8 text-lg font-bold text-white transition-all hover:bg-orange-600 hover:shadow-[0_0_20px_rgba(249,115,22,0.4)] cursor-pointer">
                  Launch Demo
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-hover:translate-x-1"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                </button>
                <button className="flex h-14 items-center justify-center rounded-2xl border border-zinc-200 bg-white px-8 text-lg font-semibold transition-all hover:bg-zinc-50 dark:border-zinc-800 dark:bg-transparent dark:hover:bg-zinc-900 cursor-pointer">
                  View Source
                </button>
              </div>
            </div>

            <div className="relative group">
              <div className="absolute -inset-4 rounded-4xl bg-linear-to-tr from-orange-500/20 to-amber-500/20 blur-2xl transition-opacity opacity-75 group-hover:opacity-100 animate-pulse"></div>
              <div className="relative overflow-hidden rounded-4xl border border-white/20 shadow-2xl backdrop-blur-sm bg-zinc-900/5 aspect-video sm:aspect-4/3 lg:aspect-square flex items-center justify-center">
                <Image
                  src="/hero.png" // Updated to use the moved image
                  alt="Pet Feeding Game Scene"
                  fill
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                  priority
                />
              </div>
              {/* Floating Stat Overlay */}
              <div className="absolute -bottom-6 -left-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 shadow-xl flex items-center gap-4 animate-bounce-slow">
                <div className="h-10 w-10 flex items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20"/><path d="m5 15 7-7 7 7"/></svg>
                </div>
                <div>
                  <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Physics Updates</p>
                  <p className="text-xl font-bold">120+ Hz</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Feature Grid */}
        <section id="parameters" className="py-24 bg-white dark:bg-zinc-950/50 relative overflow-hidden">
          <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-96 h-96 bg-orange-500/10 blur-[100px] rounded-full"></div>
          <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/2 w-96 h-96 bg-amber-500/10 blur-[100px] rounded-full"></div>
          
          <div className="mx-auto max-w-7xl px-6">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold sm:text-4xl mb-4">Core Testing Parameters</h2>
              <p className="text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">
                We are evaluating Babylon.js across several key domains to ensure a seamless and high-performance gaming experience in the browser.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {[
                {
                  title: "Physics & Collisions",
                  desc: "Evaluating Oimo.js and Cannon.js integrations for realistic pet-to-furniture interaction.",
                  icon: "M12 2L2 7l10 5 10-5-10-5zm0 20l10-5-10-5-10 5 10 5z",
                  color: "orange"
                },
                {
                  title: "Material Accuracy",
                  desc: "Testing PBR (Physically Based Rendering) for home textures like wood, carpet, and fur.",
                  icon: "M12 3v10l9-5-9-5zm0 18l-9-5 9-5 9 5-9 5z",
                  color: "orange"
                },
                {
                  title: "Interior Lighting",
                  desc: "Calculating real-time shadows and global illumination within multi-room house setups.",
                  icon: "M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41",
                  color: "orange"
                },
                {
                  title: "Animation Blending",
                  desc: "Smoothly transitioning between pet idle, eating, and walking states using skeletal animation.",
                  icon: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
                  color: "orange"
                }
              ].map((item, idx) => (
                <div key={idx} className="group relative p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 transition-all hover:shadow-xl hover:-translate-y-1 overflow-hidden">
                  <div className={`h-12 w-12 rounded-xl bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d={item.icon} />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold mb-3">{item.title}</h3>
                  <p className="text-zinc-600 dark:text-zinc-400 text-sm leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Technical Goals Section */}
        <section id="tech" className="py-24 px-6 mx-auto max-w-7xl">
          <div className="rounded-4xl bg-linear-to-br from-zinc-900 to-zinc-800 dark:from-zinc-900 dark:to-black p-12 lg:p-20 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-1/2 h-full opacity-10 pointer-events-none">
              <svg viewBox="0 0 100 100" className="h-full w-full">
                <circle cx="50" cy="50" r="40" fill="white" />
              </svg>
            </div>
            <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-4xl font-bold mb-6">Simulation Goals</h2>
                <ul className="space-y-6">
                  {[
                    "Benchmark FPS across low-end mobile and high-end desktop hardware.",
                    "Verify asset loading optimizations using GLB/GLTF containers.",
                    "Implement a scalable state management for pet needs (hunger, energy).",
                    "Explore WebGPU support for advanced particle effects (food, water spray)."
                  ].map((goal, i) => (
                    <li key={i} className="flex gap-4">
                      <div className="mt-1 h-5 w-5 rounded-full bg-orange-500 shrink-0 flex items-center justify-center">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                      </div>
                      <p className="text-lg text-zinc-300">{goal}</p>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex justify-center">
                 <div className="w-full aspect-square max-w-md rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center backdrop-blur-sm p-8">
                    <div className="text-center">
                      <p className="text-6xl font-black text-orange-500 mb-2">99%</p>
                      <p className="text-zinc-400 font-medium">Renderer Efficiency Goal</p>
                      <div className="mt-8 h-2 w-full bg-zinc-700/50 rounded-full overflow-hidden">
                        <div className="h-full w-[85%] bg-orange-500 animate-pulse"></div>
                      </div>
                    </div>
                 </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-zinc-200 dark:border-zinc-800 py-12 px-6">
        <div className="mx-auto max-w-7xl flex flex-col sm:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded bg-orange-500" />
            <span className="font-bold">BabylonPet POC</span>
          </div>
          <p className="text-sm text-zinc-500">© 2024 Proof of Concept. Built with Next.js & Babylon.js</p>
          <div className="flex gap-6 text-sm text-zinc-500 font-medium">
            <a href="#" className="hover:text-black dark:hover:text-white">GitHub</a>
            <a href="#" className="hover:text-black dark:hover:text-white">Documentation</a>
          </div>
        </div>
      </footer>

    </div>
  );
}
