import type { GameScene, SceneContext } from '@/engine/scene';
import { clamp, lerp } from '@/common/math';

interface Vector2 {
  x: number;
  y: number;
}

interface BallState {
  position: Vector2;
  velocity: Vector2;
  radius: number;
  color: string;
}

const ACCELERATION = 520;
const FRICTION = 0.92;
const MAX_SPEED = 420;

export class DemoScene implements GameScene {
  #ball: BallState = {
    position: { x: 0, y: 0 },
    velocity: { x: 0, y: 0 },
    radius: 24,
    color: '#9bd5ff'
  };

  init(context: SceneContext): void {
    this.#ball.position = {
      x: context.canvas.width / 2,
      y: context.canvas.height / 2
    };
    this.#ball.velocity = { x: 0, y: 0 };
  }

  update(deltaTime: number, context: SceneContext): void {
    const { input, canvas } = context;
    const impulse = ACCELERATION * deltaTime;

    if (input.isPressed('ArrowLeft') || input.isPressed('a')) {
      this.#ball.velocity.x -= impulse;
    }
    if (input.isPressed('ArrowRight') || input.isPressed('d')) {
      this.#ball.velocity.x += impulse;
    }
    if (input.isPressed('ArrowUp') || input.isPressed('w')) {
      this.#ball.velocity.y -= impulse;
    }
    if (input.isPressed('ArrowDown') || input.isPressed('s')) {
      this.#ball.velocity.y += impulse;
    }

    this.#ball.velocity.x = clamp(this.#ball.velocity.x, -MAX_SPEED, MAX_SPEED);
    this.#ball.velocity.y = clamp(this.#ball.velocity.y, -MAX_SPEED, MAX_SPEED);

    this.#ball.velocity.x *= FRICTION;
    this.#ball.velocity.y *= FRICTION;

    this.#ball.position.x += this.#ball.velocity.x * deltaTime;
    this.#ball.position.y += this.#ball.velocity.y * deltaTime;

    const { radius } = this.#ball;
    this.#ball.position.x = clamp(this.#ball.position.x, radius, canvas.width - radius);
    this.#ball.position.y = clamp(this.#ball.position.y, radius, canvas.height - radius);
  }

  draw(ctx: CanvasRenderingContext2D, context: SceneContext): void {
    this.#drawBackground(ctx, context.canvas);
    this.#drawBall(ctx);
    this.#drawHud(ctx, context.canvas);
  }

  #drawBackground(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement): void {
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#0c1230');
    gradient.addColorStop(1, '#152042');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    const gridSize = 48;
    for (let x = 0; x < canvas.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
  }

  #drawBall(ctx: CanvasRenderingContext2D): void {
    const { position, radius, color } = this.#ball;
    ctx.fillStyle = color;
    ctx.shadowColor = '#8fd7ff';
    ctx.shadowBlur = 24;
    ctx.beginPath();
    ctx.arc(position.x, position.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  #drawHud(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement): void {
    ctx.font = '14px "Inter", system-ui, sans-serif';
    ctx.fillStyle = '#c3c9ff';
    ctx.textBaseline = 'top';

    const speed = Math.hypot(this.#ball.velocity.x, this.#ball.velocity.y);
    const speedPercent = lerp(0, 100, speed / MAX_SPEED);
    const message = `Speed: ${speedPercent.toFixed(0)}%  ·  Reset: [R]`;
    ctx.fillText(message, 12, 12);
  }
}
