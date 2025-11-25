const playTone = (frequency: number, duration = 180, type: OscillatorType = 'sine'): void => {
  const ctx = new AudioContext();
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0.15, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration / 1000);
  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start();
  oscillator.stop(ctx.currentTime + duration / 1000);
};

export const playCorrect = (): void => {
  playTone(880, 200, 'triangle');
};

export const playStrike = (): void => {
  playTone(120, 300, 'sawtooth');
};

export const playTransition = (): void => {
  playTone(440, 250, 'square');
  window.setTimeout(() => playTone(660, 200, 'square'), 120);
};
