"use client";

import { useEffect, useRef } from "react";
import {
  Engine,
  Scene,
  Vector3,
  FreeCamera,
  HemisphericLight,
  MeshBuilder,
  StandardMaterial,
  Color3,
  ActionManager,
  ExecuteCodeAction,
} from "@babylonjs/core";

export default function GamePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;

    // Inicializar el motor (Engine)
    const engine = new Engine(canvas, true);

    // Crear una escena básica
    const scene = new Scene(engine);
    // Cambiar color de fondo para que se note el vacío
    scene.clearColor = new Color3(0.1, 0.1, 0.1).toColor4();

    // Configurar la cámara para observar la escena
    const camera = new FreeCamera("camera1", new Vector3(0, 5, -10), scene);
    camera.setTarget(Vector3.Zero());
    camera.attachControl(canvas, true);

    // Agregar una luz básica para iluminar los objetos
    const light = new HemisphericLight("light1", new Vector3(0, 1, 0), scene);
    light.intensity = 0.8;

    // Crear la malla de un cubo
    const box = MeshBuilder.CreateBox("box", { size: 2 }, scene);
    box.position.y = 1;

    // Asignar un material al cubo
    const material = new StandardMaterial("boxMaterial", scene);
    material.diffuseColor = new Color3(0.2, 0.6, 1);
    box.material = material;

    // Iniciar el bucle de renderizado donde rotamos el cubo
    engine.runRenderLoop(() => {
      if (scene) {
        box.rotation.y += 0.01;
        box.rotation.x += 0.01;
        scene.render();
      }
    });

    // Añadir interacción: Cambiar de color al hacer clic sobre el cubo
    box.actionManager = new ActionManager(scene);
    box.actionManager.registerAction(
      new ExecuteCodeAction(ActionManager.OnPickTrigger, () => {
        const mat = box.material as StandardMaterial;
        // Asignar un color aleatorio al material
        mat.diffuseColor = new Color3(Math.random(), Math.random(), Math.random());
      })
    );

    // Adaptar el lienzo cuando cambie el tamaño de la ventana
    const handleResize = () => {
      engine.resize();
    };
    window.addEventListener("resize", handleResize);

    // Limpieza de recursos al desmontar el componente
    return () => {
      window.removeEventListener("resize", handleResize);
      scene.dispose();
      engine.dispose();
    };
  }, []);

  return (
      <main style={{ flex: 1, position: "relative" }}>
        <canvas
          ref={canvasRef}
          style={{
            width: "100%",
            height: "100%",
            display: "block",
            outline: "none",
          }}
        />
      </main>
  );
}
