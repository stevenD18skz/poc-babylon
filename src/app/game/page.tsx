"use client";

import { useEffect, useRef } from "react";
import {
  Engine,
  Scene,
  Vector3,
  HemisphericLight,
  SpotLight,
  Color3,
  CubeTexture,
  ShadowGenerator,
  Color4,
} from "@babylonjs/core";
import { FPSController } from "./FPSController";
import { RoomGenerator } from "./RoomGenerator";
import { setState, getState } from "./gameState";
import { HUD } from "./HUD";

export default function GamePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });
    
    // Configurar Escena con un tono Claro/Cálido
    const scene = new Scene(engine);
    scene.clearColor = new Color4(0.98, 0.96, 0.94, 1); // Rosa-crema ambiental claro
    scene.collisionsEnabled = true;

    // Iluminación
    // 1. AmbientLight (Hemispheric) más brillante para estilo cozy pastel
    const ambientLight = new HemisphericLight("ambientLight", new Vector3(0, 1, 0), scene);
    ambientLight.intensity = 0.6; // Mucho más brillante
    ambientLight.diffuse = new Color3(1, 0.97, 0.90);
    ambientLight.groundColor = new Color3(0.8, 0.75, 0.7);

    // 2. Luz cenital principal estilo Solana (PointLight o Spot ampliamente abierto a modo de sol)
    const spotLight = new SpotLight(
      "spotLight",
      new Vector3(10, 20, 10), // Más alto y centrado a la grilla
      new Vector3(0, -1, 0), 
      Math.PI / 1.5,            // Ángulo más amplio
      5,                      // Penumbra alta para sombras súper suaves
      scene
    );
    spotLight.intensity = 0.6;
    spotLight.diffuse = new Color3(1, 0.95, 0.85); // Luz cálida pastel
    
    // Activar Sombras
    const shadowGenerator = new ShadowGenerator(1024, spotLight);
    shadowGenerator.useBlurExponentialShadowMap = true;
    shadowGenerator.blurKernel = 32;

    // Environment: Skybox simulado (usando color plano o hdr si hubiera)
    // Para replicar 'forest' o entorno sin cargar un HDR externo pesado, ajustamos el entorno base.
    // scene.environmentTexture puede usarse si tuvieras un archivo .env. Por ahora mantendremos luces pulidas.

    // Configurar Entidades
    const roomGenerator = new RoomGenerator(scene, shadowGenerator);
    const controller = new FPSController(scene, canvas, engine);

    // Bucle de renderizado global (equivalente a useFrame en R3F)
    engine.runRenderLoop(() => {
      // Monitorear FPS
      setState({ fps: engine.getFps() });

      // Trigger tracking de la habitación si el juego está activo o moviendo
      if (scene.activeCamera) {
          const pos = controller.getPlayerPosition();
          roomGenerator.checkPlayerRoom(pos);
      }

      scene.render();
    });

    // Resize
    const handleResize = () => engine.resize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      scene.dispose();
      engine.dispose();
    };
  }, []);

  return (
    <main className="relative w-full h-screen overflow-hidden bg-black">
      <canvas
        ref={canvasRef}
        className="block w-full h-full outline-none touch-none"
      />
      {/* HTML Overlay */}
      <HUD />
    </main>
  );
}
