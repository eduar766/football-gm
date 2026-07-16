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

// Youth-intake player names (Fase 15). Generic first-name + surname pools —
// flavour-consistent with the club/federation names, not meant to be exhaustive.
const PLAYER_FIRST_NAMES = [
  'Mateo', 'Bruno', 'Iker', 'Diego', 'Nico', 'Álex', 'Hugo', 'Marc',
  'Rubén', 'Adrián', 'Pau', 'Leo', 'Dani', 'Gonzalo', 'Toni', 'Enzo',
  'Martín', 'Samu', 'Izan', 'Aitor',
];
const PLAYER_SURNAMES = [
  'Ferreira', 'Ortiz', 'Cabrera', 'Vidal', 'Rivas', 'Moreno', 'Salcedo',
  'Peralta', 'Nogueira', 'Aguirre', 'Castillo', 'Barros', 'Lozano', 'Reyes',
  'Bravo', 'Serrano', 'Montes', 'Iglesias', 'Cordero', 'Espinosa',
];

// Club president / rival commissioner names (Fase 17A). Deliberately distinct
// pool from the youth-player names above — these read as adult directors.
const DIRECTOR_FIRST_NAMES = [
  'Ramón', 'Ignacio', 'Eduardo', 'Fernando', 'Alberto', 'Manuel', 'Carlos',
  'Vicente', 'Joaquín', 'Rafael', 'Elena', 'Isabel', 'Cristina', 'Marta',
  'Rosa', 'Pilar', 'Teresa', 'Beatriz', 'Sofía', 'Lucía',
];
const DIRECTOR_SURNAMES = [
  'Aranda', 'Bermúdez', 'Cifuentes', 'Delgado', 'Esquivel', 'Fuentes',
  'Guerrero', 'Herrán', 'Ibáñez', 'Jimeno', 'Lozada', 'Manrique', 'Novoa',
  'Ochoa', 'Pardo', 'Quiroga', 'Riestra', 'Sotelo', 'Uribe', 'Valcárcel',
];

function pick<T>(rng: RngState, arr: T[]): T {
  return arr[Math.floor(rngNext(rng) * arr.length)];
}

// Deterministic youth-player name. No uniqueness guard — squads can share a
// surname, same as real academies.
export function randomPlayerName(rng: RngState): string {
  return `${pick(rng, PLAYER_FIRST_NAMES)} ${pick(rng, PLAYER_SURNAMES)}`;
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

// Deterministic club-president / rival-commissioner name. No uniqueness
// guard — same reasoning as randomPlayerName, a shared surname is fine.
export function randomDirectorName(rng: RngState): string {
  return `${pick(rng, DIRECTOR_FIRST_NAMES)} ${pick(rng, DIRECTOR_SURNAMES)}`;
}
