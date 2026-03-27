import {
  Scene,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Vector3,
  ShadowGenerator,
  SceneLoader,
  Texture,
} from "@babylonjs/core";
import "@babylonjs/loaders/glTF"; // Necesario para cargar modelos GLB
import { RoomName, setState } from "./gameState";
import RoomType from "../../types/room";

export class RoomGenerator {
  private scene: Scene;
  private shadowGenerator: ShadowGenerator;
  
  private gridSize = 4;
  private cellSize = 6; // Cada habitación es de 6x6 metros
  private wallHeight = 3;
  private wallThickness = 0.2;

  // Mapa de colores pastel-cozy para cada tipo de habitación
  private roomColors = [
    new Color3(1.0, 0.89, 0.88), // 0: Sala (Rosa Suave)
    new Color3(0.88, 0.96, 0.85), // 1: Cocina (Menta Pastel)
    new Color3(0.85, 0.91, 0.96), // 2: Baño (Azul Bebé)
    new Color3(0.92, 0.88, 0.96), // 3: Cuarto (Lavanda Clara)
  ];

  private roomNames: RoomName[] = ["Sala", "Cocina", "Baño", "Pasillo"]; 

  private petScales: Record<string, number> = {
    "snoopy": 0.3,
    "cat-1": 0.2,
    "cat-2": 0.2,
  };

  constructor(scene: Scene, shadowGenerator: ShadowGenerator) {
    this.scene = scene;
    this.shadowGenerator = shadowGenerator;
    this.buildProceduralMap();
  }

  private gridTracker: RoomType[][] = [];

  private buildProceduralMap() {
    // 1. Crear cielo/piso extra grande muy sutil 
    const ground = MeshBuilder.CreateGround("ground", { width: 100, height: 100 }, this.scene);
    const groundMat = new StandardMaterial("groundMat", this.scene);
    groundMat.diffuseColor = new Color3(0.9, 0.93, 0.88); // Verde-crema ultra claro
    groundMat.specularColor = new Color3(0, 0, 0); // No brillo
    ground.material = groundMat;
    ground.receiveShadows = true;
    ground.checkCollisions = true;

    // 1. Texturas globales compartidas
    const wallMat = new StandardMaterial("wallMat", this.scene);
    const wallTex = new Texture("/textures/wall/whitewashed_brick_diff_1k.jpg", this.scene);
    wallTex.uScale = 4;
    wallTex.vScale = 4;
    wallMat.diffuseTexture = wallTex;
    wallMat.diffuseColor = new Color3(1.0, 0.95, 0.9); // Cálido sobre ladrillo

    const floorDiffTex = new Texture("/textures/floor/stained_pine_diff_1k.jpg", this.scene);
    const floorBumpTex = new Texture("/textures/floor/stained_pine_nor_gl_1k.png", this.scene);
    floorDiffTex.uScale = 3; floorDiffTex.vScale = 3;
    floorBumpTex.uScale = 3; floorBumpTex.vScale = 3;

    // 2. Ejecutar la lógica generativa
    const grid = this.processMap(this.gridSize);
    this.gridTracker = grid;

    // 3. Renderizar Habitaciones y Mascotas
    grid.forEach((row, y) => {
      row.forEach((cell, x) => {
        const worldX = x * this.cellSize;
        const worldZ = y * this.cellSize;
        
        // Crear Suelo de la habitación
        this.createFloor(worldX, worldZ, cell.type, floorDiffTex, floorBumpTex);

        // Renderizar Paredes
        cell.walls.forEach(w => {
           this.renderWallSegment(w.type, w.position, worldX, worldZ, wallMat);
        });

        // Generar Muebles (Props interactivos NO, props estáticos SÍ)
        const rx = worldX + (Math.random() * 2 - 1);
        const rz = worldZ + (Math.random() * 2 - 1);
        
        switch(cell.type) {
            case 0: // Sala
                this.loadPropModel("Table.glb", rx, rz, 0.8);
                this.loadPropModel("Chair.glb", rx + 1.2, rz, 0.8);
                break;
            case 1: // Cocina
                this.loadPropModel("Fridge.glb", rx, rz, 0.2);
                break;
            case 2: // Baño
                this.loadPropModel("Toilet.glb", rx, rz, 0.7);
                break;
            case 3: // Cuarto
                this.loadPropModel("Bed.glb", rx, rz, 0.9);
                break;
        }

        // Generar Mascotas si fueron asignadas
        if (cell.petId) {
           this.createInteractivePet(cell.petId, worldX, worldZ);
        }
      });
    });
  }

  private loadPropModel(fileName: string, x: number, z: number, scale: number = 1) {
      SceneLoader.ImportMeshAsync("", "/models/Funitary/", fileName, this.scene).then((result) => {
          const rootNode = result.meshes[0];
          // Offset Y ligero en caso de que el origin del GLB no esté abajo
          rootNode.position = new Vector3(x, 0, z);
          rootNode.scaling = new Vector3(scale, scale, scale);
          
          result.meshes.forEach((mesh) => {
              if (mesh.parent !== null || mesh.name !== "__root__") {
                  mesh.receiveShadows = true;
                  this.shadowGenerator.addShadowCaster(mesh);
                  // Hacer paredes/cuerpos físicos y NO interactuables
                  mesh.checkCollisions = true; 
                  mesh.isPickable = false; 
              }
          });
      }).catch((e) => console.error("Error prop:", e));
  }

  private renderWallSegment(type: string, position: string, cx: number, cz: number, mat: StandardMaterial) {
    if (type === "free") return; // Sin pared

    // Desplazamiento desde el centro de la celda
    const offset = this.cellSize / 2;
    let px = cx, pz = cz;
    let width = this.cellSize;
    let depth = this.wallThickness;
    
    // Configuración según la posición de la pared con el modelo right, left, front, back de R3F
    if (position === "right") { px = cx + offset; width = this.wallThickness; depth = this.cellSize; }
    if (position === "left") { px = cx - offset; width = this.wallThickness; depth = this.cellSize; }
    if (position === "front") { pz = cz + offset; } // Z-Positivo
    if (position === "back") { pz = cz - offset; } // Z-Negativo

    if (type === "wall") {
      // Pared completa
      const wall = MeshBuilder.CreateBox("wall", { width, height: this.wallHeight, depth }, this.scene);
      wall.position.set(px, this.wallHeight / 2, pz);
      wall.material = mat;
      wall.checkCollisions = true;
      wall.receiveShadows = true;
      this.shadowGenerator.addShadowCaster(wall);
    } else if (type === "door") {
      // Puerta (Dejar un agujero en medio usando dos pequeños segmentos)
      const doorWidth = 2; // de espacio
      if (width > depth) {
         // Pared Horizontal (front/back)
         const legW = (width - doorWidth) / 2;
         const leg1 = MeshBuilder.CreateBox("doorLeg", { width: legW, height: this.wallHeight, depth }, this.scene);
         leg1.position.set(px - (width/2) + (legW/2), this.wallHeight / 2, pz);
         
         const leg2 = MeshBuilder.CreateBox("doorLeg", { width: legW, height: this.wallHeight, depth }, this.scene);
         leg2.position.set(px + (width/2) - (legW/2), this.wallHeight / 2, pz);
         
         leg1.material = leg2.material = mat;
         leg1.checkCollisions = leg2.checkCollisions = true;
         leg1.receiveShadows = leg2.receiveShadows = true;
         this.shadowGenerator.addShadowCaster(leg1); this.shadowGenerator.addShadowCaster(leg2);
      } else {
         // Pared Vertical (left/right)
         const legD = (depth - doorWidth) / 2;
         const leg1 = MeshBuilder.CreateBox("doorLeg", { width, height: this.wallHeight, depth: legD }, this.scene);
         leg1.position.set(px, this.wallHeight / 2, pz - (depth/2) + (legD/2));
         
         const leg2 = MeshBuilder.CreateBox("doorLeg", { width, height: this.wallHeight, depth: legD }, this.scene);
         leg2.position.set(px, this.wallHeight / 2, pz + (depth/2) - (legD/2));
         
         leg1.material = leg2.material = mat;
         leg1.checkCollisions = leg2.checkCollisions = true;
         leg1.receiveShadows = leg2.receiveShadows = true;
         this.shadowGenerator.addShadowCaster(leg1); this.shadowGenerator.addShadowCaster(leg2);
      }
    }
  }

  private createFloor(x: number, z: number, cellType: number, diffTex: Texture, bumpTex: Texture) {
    const floor = MeshBuilder.CreateGround("cellFloor", { width: this.cellSize, height: this.cellSize }, this.scene);
    floor.position.set(x, 0.01, z); 
    const floorMat = new StandardMaterial("floorMat", this.scene);
    
    floorMat.diffuseTexture = diffTex;
    floorMat.bumpTexture = bumpTex;
    // Multiplicamos la textura de madera por el color de la habitación para diferenciar zonas!
    floorMat.diffuseColor = this.roomColors[cellType % 4];
    floorMat.specularColor = new Color3(0, 0, 0);
    floor.material = floorMat;
    floor.receiveShadows = true;
  }

  private createInteractivePet(petId: string, x: number, z: number) {
    const ox = x + (Math.random() * 2 - 1);
    const oz = z + (Math.random() * 2 - 1);

    const fileName = petId === 'snoopy' ? "Snoopy.glb" : "Cat.glb";
    
    // Cargar modelo real en lugar de cajas!
    const petScale = this.petScales[petId] || 0.5;

    SceneLoader.ImportMeshAsync("", "/models/", fileName, this.scene).then((result) => {
        const rootNode = result.meshes[0];
        rootNode.position = new Vector3(ox, 0, oz);
        rootNode.scaling = new Vector3(petScale, petScale, petScale);
        
        result.meshes.forEach((mesh) => {
            if (mesh.name !== "__root__") {
                // Modificamos el nombre al cargarlo para que el Raycast del FPSController lo lea y aplique "Interactive_"
                mesh.name = `Interactive_${petId}_${mesh.name}`;
                mesh.checkCollisions = true;
                mesh.isPickable = true; // Permutar interacciones
                
                mesh.receiveShadows = true;
                this.shadowGenerator.addShadowCaster(mesh);
            }
        });
    }).catch(e => console.error(e));
  }

  // Prop generator removed as it's been superseded by Funitary GLBs

  public checkPlayerRoom(playerPosition: Vector3) {
    // Calculamos en qué celda de la grilla estamos
    // Como las celdas van en múltiplos de cellSize:
    const gridX = Math.round(playerPosition.x / this.cellSize);
    const gridZ = Math.round(playerPosition.z / this.cellSize);
    
    const inBounds = gridX >= 0 && gridX < this.gridSize && gridZ >= 0 && gridZ < this.gridSize;

    let rType = "Exterior";
    if (inBounds && this.gridTracker[gridZ] && this.gridTracker[gridZ][gridX]) {
        const typeIndex = this.gridTracker[gridZ][gridX].type;
        const roomNames = ["Sala", "Cocina", "Baño", "Cuarto"];
        rType = roomNames[typeIndex] || "Sala";
    }

    setState({ currentRoom: rType as RoomName });
  }

  // --- LÓGICA PORTADA DESDE EL CÓDIGO DEL USUARIO ---
  private processMap = (size: number): RoomType[][] => {
    const grid: RoomType[][] = []

    const randomMap = (size: number) => {
        const map = []
        for (let i = 0; i < size; i++) {
            const row = []
            for (let j = 0; j < size; j++) {
                row.push(Math.floor(Math.random() * 4))
            }
            map.push(row)
        }
        return map
    }

    const map = randomMap(size)
    const wallCache: Record<string, string> = {}

    const getWallType = (x1: number, y1: number, x2: number, y2: number) => {
        const key = [[x1, y1], [x2, y2]].sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(p => p.join(',')).join('|')
        if (wallCache[key]) return wallCache[key]

        const randInt = Math.floor(Math.random() * 3) + 1
        const type = randInt === 1 ? "wall" : randInt === 2 ? "free" : "door"
        wallCache[key] = type
        return type
    }

    const DefineWall = (cell: number, x: number, y: number): { type: string, position: string }[] => {
        const directions: [number, number, string][] = [[1, 0, "right"], [-1, 0, "left"], [0, 1, "front"], [0, -1, "back"]]
        const walls: { type: string, position: string }[] = []

        directions.forEach((direction) => {
            const nx = x + direction[0]
            const ny = y + direction[1]
            if (nx >= 0 && nx < map[0].length && ny >= 0 && ny < map.length) {
                walls.push({
                    type: getWallType(x, y, nx, ny),
                    position: direction[2]
                })
            }
            else {
                // Bordes exteriores siempe cerrados
                walls.push({
                    type: "wall",
                    position: direction[2]
                })
            }
        })
        return walls
    }

    map.forEach((row, y) => {
        const gridRow: RoomType[] = []
        row.forEach((cell, x) => {
            gridRow.push({
                type: cell,
                walls: DefineWall(cell, x, y)
            })
        })
        grid.push(gridRow)
    })

    const allCoords: { x: number, y: number }[] = []
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            allCoords.push({ x, y })
        }
    }
    allCoords.sort(() => Math.random() - 0.5)

    const petsToAssign = ['snoopy', 'cat-1', 'cat-2']
    petsToAssign.forEach((petId, i) => {
        if (i < allCoords.length) {
            const { x, y } = allCoords[i]
            grid[y][x].petId = petId
        }
    })

    return grid
  }
}
