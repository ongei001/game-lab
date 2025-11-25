import type { InputManager } from './input';

export interface GameScene {
  init?: (context: SceneContext) => void;
  update: (deltaTime: number, context: SceneContext) => void;
  draw: (ctx: CanvasRenderingContext2D, context: SceneContext) => void;
}

export interface SceneContext {
  input: InputManager;
  canvas: HTMLCanvasElement;
  reset: () => void;
}
