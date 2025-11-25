export class InputManager {
  #pressed: Set<string> = new Set();
  #listenersAttached = false;

  attachListeners(): void {
    if (this.#listenersAttached) return;

    window.addEventListener('keydown', (event) => {
      this.#pressed.add(event.key);
    });

    window.addEventListener('keyup', (event) => {
      this.#pressed.delete(event.key);
    });

    this.#listenersAttached = true;
  }

  isPressed(key: string): boolean {
    return this.#pressed.has(key);
  }
}
