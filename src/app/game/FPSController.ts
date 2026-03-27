import {
  Scene,
  Vector3,
  UniversalCamera,
  ArcRotateCamera,
  Camera,
  ActionManager,
  ExecuteCodeAction,
  Nullable,
  Engine,
  Ray,
  Color3,
  StandardMaterial,
} from "@babylonjs/core";
import { setState, getState } from "./gameState";

export class FPSController {
  private scene: Scene;
  private canvas: HTMLCanvasElement;
  private engine: Engine;

  public fpsCamera!: UniversalCamera;
  public debugCamera!: ArcRotateCamera;
  public activeCamera!: Camera;

  private inputMap: Record<string, boolean> = {};

  // Velocidades y configuración
  private walkSpeed = 0.1;
  private eyeHeight = 1.6;

  constructor(scene: Scene, canvas: HTMLCanvasElement, engine: Engine) {
    this.scene = scene;
    this.canvas = canvas;
    this.engine = engine;

    this.setupCameras();
    this.setupInputs();
    this.setupPointerLock();
    this.setupMovementLoop();
  }

  private setupCameras() {
    // Cámara FPS (UniversalCamera maneja graveda y colisiones nativamente en Babylon, 
    // pero el usuario pidió WASD manual corregido por Euler. Haremos un híbrido para mejor control o sobreescribiremos el input.)
    this.fpsCamera = new UniversalCamera("fpsCamera", new Vector3(0, this.eyeHeight, 0), this.scene);
    this.fpsCamera.setTarget(new Vector3(0, this.eyeHeight, 1));
    this.fpsCamera.minZ = 0.1;
    this.fpsCamera.checkCollisions = true;
    this.fpsCamera.applyGravity = true;
    // Tamaño del collider del jugador (radio, altura, radio)
    this.fpsCamera.ellipsoid = new Vector3(0.5, this.eyeHeight / 2, 0.5);
    // Desactivar controles por defecto para manejarlos nosotros con el teclado mapeado a nuestro gusto,
    // o simplemente remapear las teclas de Babylon.
    // Vamos a usar el remapeo nativo para que las colisiones funcionen perfectas.
    console.log("FPSController", this.fpsCamera);
    this.fpsCamera.keysUp = [87]; // W
    this.fpsCamera.keysDown = [83]; // S
    this.fpsCamera.keysLeft = [65]; // A
    this.fpsCamera.keysRight = [68]; // D
    this.fpsCamera.speed = 1; // Movimiento más rápido
    this.fpsCamera.inertia = 0.5; // Suavizado de movimiento
    this.fpsCamera.angularSensibility = 2000;

    // Cámara Debug (ArcRotateCamera)
    this.debugCamera = new ArcRotateCamera("debugCamera", Math.PI / 4, Math.PI / 3, 30, Vector3.Zero(), this.scene);
    this.debugCamera.setTarget(new Vector3(5, 0, 5));

    // Por defecto activamos la FPS
    this.activeCamera = this.fpsCamera;
    this.scene.activeCamera = this.fpsCamera;
    this.fpsCamera.attachControl(this.canvas, true);
  }

  private setupInputs() {
    this.scene.actionManager = new ActionManager(this.scene);
    
    // Toggle Debug Camera
    this.scene.actionManager.registerAction(
      new ExecuteCodeAction(
        { trigger: ActionManager.OnKeyUpTrigger, parameter: "c" },
        () => {
          this.toggleDebugCamera();
        }
      )
    );
  }

  private setupPointerLock() {
    const pointerlockchange = () => {
      const isLocked = document.pointerLockElement === this.canvas;
      setState({ isPlaying: isLocked });
      if (!isLocked) {
        setState({ targetItem: null }); // Limpiar si salimos del juego
      }
    };

    document.addEventListener("pointerlockchange", pointerlockchange, false);

    // Sistema de Interacción (Clic izquierdo para interactuar si hay un target)
    this.scene.onPointerDown = (evt, pickInfo) => {
      if (getState().isPlaying && getState().targetItem) {
        if (pickInfo.hit && pickInfo.pickedMesh) {
           const mesh = pickInfo.pickedMesh;
           // Asegurarnos que ESTÁ apuntando al gato/snoopy
           if (mesh.name.startsWith("Interactive_") && mesh.material) {
               // Para que no se pinten otras cosas vinculadas al mismo material GLB, clonarlo
               if (!mesh.metadata?.hasCustomMaterial) {
                   mesh.material = mesh.material.clone(mesh.name + "_unique_mat");
                   mesh.metadata = { ...mesh.metadata, hasCustomMaterial: true };
               }
               
               const c = new Color3(Math.random(), Math.random(), Math.random());
               // PBRMaterial usa albedoColor, StandardMaterial usa diffuseColor
               if ((mesh.material as any).albedoColor !== undefined) {
                   (mesh.material as any).albedoColor = c;
               } else if ((mesh.material as any).diffuseColor !== undefined) {
                   (mesh.material as any).diffuseColor = c;
               }
           }
        }
      }
    };
  }

  public toggleDebugCamera() {
    const isDebug = !getState().isDebugMode;
    setState({ isDebugMode: isDebug, isPlaying: !isDebug });

    this.activeCamera.detachControl();

    if (isDebug) {
      this.engine.exitPointerlock();
      this.activeCamera = this.debugCamera;
      this.debugCamera.attachControl(this.canvas, true);
    } else {
      this.activeCamera = this.fpsCamera;
      this.fpsCamera.attachControl(this.canvas, true);
      this.engine.enterPointerlock();
    }

    this.scene.activeCamera = this.activeCamera;
  }

  public getPlayerPosition(): Vector3 {
    return this.fpsCamera.position;
  }

  private checkInteraction() {
     // Raycast desde la cámara hacia el centro
     const ray = new Ray(this.fpsCamera.position, this.fpsCamera.getDirection(Vector3.Forward()), 3);
     const hit = this.scene.pickWithRay(ray, (mesh) => mesh.isPickable && mesh.name.startsWith("Interactive_"));

     if (hit && hit.hit && hit.pickedMesh) {
       setState({ targetItem: hit.pickedMesh.name.replace("Interactive_", "") });
     } else {
       if (getState().targetItem !== null) {
         setState({ targetItem: null });
       }
     }
  }

  private setupMovementLoop() {
    this.scene.onBeforeRenderObservable.add(() => {
      if (!getState().isDebugMode) {
        // Corrección de altura constante por si salta o choca raro
        this.fpsCamera.position.y = this.eyeHeight;
        
        // Comprobar la interacción cada frame o con menos frecuencia
        if (getState().isPlaying) {
          this.checkInteraction();
        }
      }
    });
  }
}
