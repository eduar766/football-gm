// Salary model (Fase 6.3). Pure helpers, no rng — derived from player quality
// so the engine never has to track salaries explicitly. Isolated here so a
// later phase can swap the derivation for stored salaries without touching
// the call sites (norms, transfers, UI).

import type { Player } from './types';

const SALARY_BASE = 20_000;
const SALARY_PIVOT = 40;
// Quadratic: salary scales with the square of quality / pivot. Calibrated so
// a mid-tier player (cal 55) earns ~38K/yr, a starter (cal 70) ~61K, and a
// star (cal 85) ~90K. Combined into 20-man squads that puts wage bills in
// the 0.5–2M range — same order of magnitude as a club's operating life.
export function playerSalary(calidad: number): number {
  const q = Math.max(1, calidad);
  return Math.round(SALARY_BASE * Math.pow(q / SALARY_PIVOT, 2));
}

export function wageBill(teamId: number, players: Player[]): number {
  let total = 0;
  for (const p of players) {
    if (p.teamId === teamId) total += playerSalary(p.calidad);
  }
  return total;
}
