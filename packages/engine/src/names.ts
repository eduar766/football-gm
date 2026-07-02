// Shared name pools + deterministic name generators (§4.3 create-team, world gen).
// Pure: takes an RngState so callers control determinism. No I/O.

import { rngNext, type RngState } from './rng';

// Club name building blocks. Reused by the world generator (backend) and the
// random-team-name helper so the flavour stays consistent across the app.
export const TEAM_PREFIXES = [
  'Atlético', 'Unión', 'Deportivo', 'CD', 'Racing', 'Sporting',
  'CF', 'Club', 'AD', 'Real', 'CA', 'UD',
];
export const TEAM_PLACES = [
  'Riveras', 'Porteña', 'Sauces', 'Maravillas', 'del Valle', 'Aldea',
  'Peñalba', 'Marítimo', 'Ferroviaria', 'Montaña', 'del Norte', 'Costa Brava',
  'Sierra', 'Robledo', 'Laguna', 'Olivar', 'Vega', 'Bahía', 'Altozano', 'Pinar',
];

// Federation name building blocks: "Liga {Adjetivo} de {Región}".
export const FEDERATION_ADJECTIVES = [
  'Continental', 'Unida', 'Federal', 'Nacional', 'Metropolitana',
  'Central', 'Oriental', 'Occidental', 'Libre', 'Dorada', 'Real', 'Soberana',
];
export const FEDERATION_REGIONS = [
  'Valmonte', 'Ribera', 'Costa Dorada', 'los Llanos', 'Altavista', 'Nueva Iberia',
  'Terramar', 'Solania', 'Montania', 'el Norte', 'Pradera', 'Bahía Azul',
];

function pick<T>(rng: RngState, arr: T[]): T {
  return arr[Math.floor(rngNext(rng) * arr.length)];
}

// Deterministic unique club name. If `used` is passed, avoids collisions and
// records the chosen name in it.
export function randomTeamName(rng: RngState, used?: Set<string>): string {
  let name = '';
  let guard = 0;
  do {
    name = `${pick(rng, TEAM_PREFIXES)} ${pick(rng, TEAM_PLACES)}`;
  } while (used?.has(name) && guard++ < 1000);
  used?.add(name);
  return name;
}

// Deterministic federation name. Gives each game its own identity instead of
// the old hardcoded "Federación del Comisionado".
export function randomFederationName(rng: RngState, used?: Set<string>): string {
  let name = '';
  let guard = 0;
  do {
    name = `Liga ${pick(rng, FEDERATION_ADJECTIVES)} de ${pick(rng, FEDERATION_REGIONS)}`;
  } while (used?.has(name) && guard++ < 1000);
  used?.add(name);
  return name;
}
