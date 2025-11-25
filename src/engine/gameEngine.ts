import { InputManager } from './input';
import type { GameScene, SceneContext } from './scene';

export class GameEngine {
  #canvas: HTMLCanvasElement;
  #ctx: CanvasRenderingContext2D;
  #scene: GameScene | null = null;
  #running = false;
  #lastTime = 0;
  readonly input = new InputManager();

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Unable to acquire 2D context');
    }

    this.#canvas = canvas;
    this.#ctx = ctx;
    this.input.attachListeners();
  }

  setScene(scene: GameScene): void {
    this.#scene = scene;
    this.#scene.init?.(this.#context());
  }

  start(): void {
    if (this.#running) return;
    this.#running = true;
    this.#lastTime = performance.now();
    requestAnimationFrame(this.#loop);
  }

  stop(): void {
    this.#running = false;
  }

  #clear(): void {
    this.#ctx.clearRect(0, 0, this.#canvas.width, this.#canvas.height);
  }

  #loop = (timestamp: number): void => {
    if (!this.#running || !this.#scene) return;

    const deltaTime = (timestamp - this.#lastTime) / 1000;
    this.#lastTime = timestamp;

    const context = this.#context();
    this.#scene.update(deltaTime, context);

    this.#clear();
    this.#scene.draw(this.#ctx, context);

    requestAnimationFrame(this.#loop);
  };

  #context(): SceneContext {
    return {
      input: this.input,
      canvas: this.#canvas,
      reset: () => this.reset()
    };
  }

  reset(): void {
    if (!this.#scene) return;
    this.#scene.init?.(this.#context());
  }
}
