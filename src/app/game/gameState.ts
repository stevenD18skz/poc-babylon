// gameState.ts — Simple reactive state store (replaces Zustand)

export type RoomName = "Exterior" | "Sala" | "Cocina" | "Baño" | "Pasillo" | "Cuarto";

export interface GameState {
  isPlaying: boolean;
  currentRoom: RoomName;
  isDebugMode: boolean;
  fps: number;
  targetItem: string | null;
}

type Listener = (state: GameState) => void;

const state: GameState = {
  isPlaying: false,
  currentRoom: "Exterior",
  isDebugMode: false,
  fps: 0,
  targetItem: null,
};

const listeners = new Set<Listener>();

export function getState(): Readonly<GameState> {
  return state;
}

export function setState(partial: Partial<GameState>): void {
  Object.assign(state, partial);
  listeners.forEach((l) => l({ ...state }));
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
