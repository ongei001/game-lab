import './style.css';
import { GameEngine } from './engine/gameEngine';
import { DemoScene } from './games/demoScene';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) {
  throw new Error('#app container missing');
}

app.innerHTML = `
  <div class="canvas-shell">
    <header>
      <h1>Game Lab Starter</h1>
      <div class="controls">
        <button id="reset">Reset Scene</button>
        <span class="info">Use arrows or WASD to move the orb.</span>
      </div>
    </header>
    <canvas id="stage" width="800" height="520"></canvas>
  </div>
`;

const canvas = document.querySelector<HTMLCanvasElement>('#stage');
if (!canvas) {
  throw new Error('Unable to find canvas');
}

const engine = new GameEngine(canvas);
const scene = new DemoScene();
engine.setScene(scene);
engine.start();

const resetButton = document.querySelector<HTMLButtonElement>('#reset');
resetButton?.addEventListener('click', () => {
  engine.reset();
});

window.addEventListener('keydown', (event) => {
  if (event.key.toLowerCase() === 'r') {
    engine.reset();
  }
});

const resizeCanvas = (): void => {
  const scale = window.devicePixelRatio || 1;
  canvas.width = Math.min(960, window.innerWidth - 48) * scale;
  canvas.height = 520 * scale;
  canvas.style.width = `${canvas.width / scale}px`;
  canvas.style.height = `${canvas.height / scale}px`;
  engine.reset();
};

resizeCanvas();
window.addEventListener('resize', resizeCanvas);
