// Deterministic world generator: same seed => same world. Uses the engine's
// exported seeded PRNG so generation is reproducible and consistent with the
// simulation core. This runs once at game creation; the engine then owns its
// own RNG stream for the simulation.

import { makeRng, randInt, rngNext, type RngState, CONFEDERATIONS } from '@football-gm/engine';

export interface WorldPlayer {
  name: string;
  posicion: 'POR' | 'DEF' | 'MED' | 'DEL';
  calidad: number;
  nationality: string; // 'local' | 'extranjero'
  cantera: boolean;
}

export interface WorldTeam {
  name: string;
  strength: number;
  prestige: number;
  arraigo: number;
  presupuesto: number;
  aficion: number;
  estadioNombre: string;
  estadioAforo: number;
  academiaRating: number;
  medicoRating: number;
  ojeadoresRating: number;
  cuerpoTecnicoRating: number;
  squad: WorldPlayer[];
}

export interface WorldRivalTeam {
  name: string;
  strength: number;
  arraigo: number;
  league: string;
  country: string;
  flag: string;
}

export interface WorldRival {
  name: string;
  prestige: number;
  confederationId: number;
  teams: WorldRivalTeam[];
}

export interface World {
  federationName: string;
  leagueName: string;
  divisionName: string;
  teams: WorldTeam[];
  rivals: WorldRival[];
  confederations: Array<{ id: number; name: string; region: string; available: boolean; leagues: Array<{ name: string; country: string; flag: string }> }>;
}

const PREFIXES = [
  'Atlético', 'Unión', 'Deportivo', 'CD', 'Racing', 'Sporting',
  'CF', 'Club', 'AD', 'Real', 'CA', 'UD',
];
const PLACES = [
  'Riveras', 'Porteña', 'Sauces', 'Maravillas', 'del Valle', 'Aldea',
  'Peñalba', 'Marítimo', 'Ferroviaria', 'Montaña', 'del Norte', 'Costa Brava',
  'Sierra', 'Robledo', 'Laguna', 'Olivar',
];
const FIRST_NAMES = [
  'Iker', 'Sergio', 'Marco', 'Andrés', 'Lucas', 'Diego', 'Pablo', 'Mateo',
  'Hugo', 'Adrián', 'Álvaro', 'Bruno', 'Nico', 'Rubén', 'Iván', 'Gonzalo',
  'Unai', 'Jorge', 'Dani', 'Aitor',
];
const LAST_NAMES = [
  'García', 'Fernández', 'Martínez', 'López', 'Sánchez', 'Romero', 'Torres',
  'Ramírez', 'Vega', 'Castro', 'Ortega', 'Rubio', 'Molina', 'Delgado',
  'Cabrera', 'Reyes', 'Ibáñez', 'Pardo', 'Soler', 'Lozano',
];

const SQUAD_PLAN: Array<{ pos: WorldPlayer['posicion']; count: number }> = [
  { pos: 'POR', count: 3 },
  { pos: 'DEF', count: 7 },
  { pos: 'MED', count: 6 },
  { pos: 'DEL', count: 4 },
];

function pick<T>(rng: RngState, arr: T[]): T {
  return arr[Math.floor(rngNext(rng) * arr.length)];
}

function makeUniqueNamer(rng: RngState) {
  const used = new Set<string>();
  return (): string => {
    let name = '';
    let guard = 0;
    do {
      name = `${pick(rng, PREFIXES)} ${pick(rng, PLACES)}`;
    } while (used.has(name) && guard++ < 1000);
    used.add(name);
    return name;
  };
}

function buildSquad(rng: RngState, baseQuality: number): WorldPlayer[] {
  const squad: WorldPlayer[] = [];
  for (const { pos, count } of SQUAD_PLAN) {
    for (let i = 0; i < count; i++) {
      const calidad = Math.min(99, Math.max(25, baseQuality + randInt(rng, -12, 12)));
      squad.push({
        name: `${pick(rng, FIRST_NAMES)} ${pick(rng, LAST_NAMES)}`,
        posicion: pos,
        calidad,
        nationality: rngNext(rng) < 0.6 ? 'local' : 'extranjero',
        cantera: rngNext(rng) < 0.5,
      });
    }
  }
  return squad;
}

// Deterministic weak squad for a freshly built club (§4.3). Independent rng
// (does not touch the simulation stream).
export function buildWeakSquad(seed: number, teamEngineId: number): WorldPlayer[] {
  const rng = makeRng((seed ^ (teamEngineId * 0x9e3779b9) ^ 0x5f3759df) >>> 0);
  return buildSquad(rng, 30);
}

export function generateWorld(seed: number): World {
  const rng = makeRng(seed);
  const nextName = makeUniqueNamer(rng);

  const teams: WorldTeam[] = Array.from({ length: 10 }, () => {
    const baseQuality = randInt(rng, 42, 72);
    const squad = buildSquad(rng, baseQuality);
    const strength = Math.round(
      squad.reduce((a, p) => a + p.calidad, 0) / squad.length,
    );
    const prestige = Math.min(100, Math.max(0, strength + randInt(rng, -8, 8)));
    return {
      name: nextName(),
      strength,
      prestige,
      arraigo: randInt(rng, 25, 85),
      presupuesto: strength * 100_000 + randInt(rng, 0, 2_000_000),
      aficion: randInt(rng, 4_000, 60_000),
      estadioNombre: `Estadio ${pick(rng, PLACES)}`,
      estadioAforo: 6_000 + strength * randInt(rng, 400, 700),
      academiaRating: randInt(rng, 38, 75),
      medicoRating: randInt(rng, 38, 75),
      ojeadoresRating: randInt(rng, 38, 75),
      cuerpoTecnicoRating: randInt(rng, 38, 75),
      squad,
    };
  });

  // Fase 9: use seed data for rival federations (real teams from UEFA).
  // Each league becomes a rival federation with its real teams.
  const usedNames = new Set<string>();
  const rivals: WorldRival[] = [];
  for (const conf of CONFEDERATIONS) {
    if (!conf.available) continue;
    for (const league of conf.leagues) {
      const fedName = `${league.flag} ${league.name} Federation`;
      if (usedNames.has(fedName)) continue;
      usedNames.add(fedName);
      // Compute average strength of the league's teams for prestige
      const avgStrength = league.divisions.reduce((acc, d) => {
        const divAvg = d.teams.reduce((a, t) => a + t.strength, 0) / d.teams.length;
        return acc + divAvg;
      }, 0) / league.divisions.length;
      const prestige = Math.min(100, Math.max(5, Math.round(avgStrength * 0.85)));
      rivals.push({
        name: fedName,
        prestige,
        confederationId: conf.id,
        teams: league.divisions.flatMap(d =>
          d.teams.map(t => ({
            name: t.name,
            strength: t.strength,
            arraigo: t.arraigo,
            league: league.name,
            country: league.country,
            flag: league.flag,
          })),
        ),
      });
    }
  }

  return {
    federationName: 'Federación del Comisionado',
    leagueName: 'Liga Principal',
    divisionName: 'Primera División',
    teams,
    rivals,
    confederations: CONFEDERATIONS.map(c => ({
      id: c.id,
      name: c.name,
      region: c.region,
      available: c.available,
      leagues: c.leagues.map(l => ({
        name: l.name,
        country: l.country,
        flag: l.flag,
      })),
    })),
  };
}
