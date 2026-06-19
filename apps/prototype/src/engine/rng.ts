// Deterministic seeded PRNG (mulberry32). State is a single 32-bit int so the
// whole GameState stays serializable and a save resumes the exact same stream.
// Same seed => same season. This invariant is what makes the engine testable.

export interface RngState {
  s: number;
}

export function makeRng(seed: number): RngState {
  return { s: seed >>> 0 };
}

export function rngNext(state: RngState): number {
  let a = state.s | 0;
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  state.s = a;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function randInt(state: RngState, minInclusive: number, maxInclusive: number): number {
  return minInclusive + Math.floor(rngNext(state) * (maxInclusive - minInclusive + 1));
}

// Knuth's algorithm. Goals per team in a match are Poisson-distributed.
export function poisson(state: RngState, lambda: number): number {
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rngNext(state);
  } while (p > L);
  return k - 1;
}
