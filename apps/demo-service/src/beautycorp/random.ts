export type RandomSource = () => number;

export function createSeededRandom(seed: number): RandomSource {
  let state = seed >>> 0;

  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

export function choose<T>(items: readonly T[], random: RandomSource): T {
  const index = Math.floor(random() * items.length);
  const item = items[index];

  if (item === undefined) {
    throw new Error("Cannot choose from an empty collection.");
  }

  return item;
}

export function jitter(base: number, spread: number, random: RandomSource): number {
  return Math.round(base + (random() - 0.5) * spread);
}
