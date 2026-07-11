// Talent pipeline (Fase 15). Hidden potencial → role-aware development →
// youth intake → retirement. Pure, deterministic, uses its own talentRng
// stream so the match engine, attribution, and every other stream stay
// untouched. Gated on `s.players.length > 0` wherever a team has no tracked
// squad — the default player-less game never consumes talentRng, so the
// golden master (which uses createGame with no options) is unaffected.

import { randInt, rngNext, type RngState } from './rng';
import { randomPlayerName } from './names';
import { teamMeetsNorm } from './norms';
import type { GameState, Player, PlayerPosition, Team } from './types';

// ─── Potencial generation (§A2) ─────────────────────────────────────────────

// Cumulative buckets: [upToProbability, marginMin, marginMax]. 60% of players
// are "del montón", 1% are generational talents — a heavy-tailed distribution
// so most jugadores stay ordinary and joyas are rare enough to be a story.
const POTENCIAL_BUCKETS: readonly [number, number, number][] = [
  [0.60, 0, 5],
  [0.85, 6, 12],
  [0.95, 13, 22],
  [0.99, 23, 32],
  [1.00, 33, 40],
];

function rollMargin(rng: RngState): number {
  const r = rngNext(rng);
  for (const [cum, min, max] of POTENCIAL_BUCKETS) {
    if (r <= cum) return randInt(rng, min, max);
  }
  return randInt(rng, 0, 5);
}

// Players 27+ have already realised most of their potential — small margin
// regardless of the bucket roll. `favorable` (strong academies, §A2) rolls
// twice and keeps the best, so good academies skew toward joyas, not just
// slightly-better-average players.
export function generatePotencial(
  rng: RngState,
  calidad: number,
  age: number,
  favorable = false,
): number {
  if (age >= 27) {
    return Math.min(95, calidad + randInt(rng, 0, 3));
  }
  const margin = favorable
    ? Math.max(rollMargin(rng), rollMargin(rng))
    : rollMargin(rng);
  return Math.min(95, calidad + margin);
}

// ─── Development (§A3, §A4) ─────────────────────────────────────────────────

const ROLE_TITULAR = 1.0;
const ROLE_ROTACION = 0.6;
const ROLE_SUPLENTE = 0.3;
const TITULAR_SLOTS = 11;
const ROTACION_SLOTS = 5; // ranks 12–16

const GOVERNANCE_ROLE_BONUS = 0.25;
const EXPLOSION_GAP = 15;       // potencial - calidad gap that can trigger a jump
const EXPLOSION_PROB = 0.15;

// Mutates s.players in place: ages everyone up, applies role- and
// potencial-aware growth/decline, and pushes a `mejor_joven` award for the
// biggest quality jump among players who end the season at age <= 21.
export function developPlayers(s: GameState): void {
  if (s.players.length === 0) return;

  const teamById = new Map<number, Team>(s.teams.map((t) => [t.id, t]));
  const byTeam = new Map<number, Player[]>();
  for (const p of s.players) {
    const list = byTeam.get(p.teamId);
    if (list) list.push(p);
    else byTeam.set(p.teamId, [p]);
  }

  let bestYoung: { player: Player; delta: number } | null = null;

  for (const [teamId, squad] of byTeam) {
    const team = teamById.get(teamId);
    // Role assigned from last season's pecking order (ranking is stable
    // across the age++ below since it happens before any calidad changes).
    const ranked = [...squad].sort((a, b) => b.calidad - a.calidad);
    const roleFactor = new Map<number, number>();
    ranked.forEach((p, idx) => {
      roleFactor.set(
        p.id,
        idx < TITULAR_SLOTS ? ROLE_TITULAR : idx < TITULAR_SLOTS + ROTACION_SLOTS ? ROLE_ROTACION : ROLE_SUPLENTE,
      );
    });
    // A norm that actively forces clubs to field young/local talent speeds
    // up development for their U21s — governance has ecosystem consequences.
    const governanceBoost =
      !!team &&
      (teamMeetsNorm(s, team, 'minimo_cantera') || teamMeetsNorm(s, team, 'tope_edad_media'));

    for (const p of squad) {
      p.age += 1;
      let factor = roleFactor.get(p.id) ?? ROLE_SUPLENTE;
      if (governanceBoost && p.age <= 21) factor = Math.min(1, factor + GOVERNANCE_ROLE_BONUS);

      const before = p.calidad;
      if (p.age <= 21) {
        const academiaBonus = team?.academia ? Math.round(team.academia / 25) : 0;
        let gain = Math.round(randInt(s.talentRng, 0, 3) * factor) + academiaBonus;
        if (p.potencial - p.calidad >= EXPLOSION_GAP && rngNext(s.talentRng) < EXPLOSION_PROB) {
          gain += randInt(s.talentRng, 4, 7);
        }
        p.calidad = Math.min(p.potencial, p.calidad + gain);
      } else if (p.age <= 26) {
        const gain = Math.round(randInt(s.talentRng, 0, 2) * factor);
        p.calidad = Math.min(p.potencial, p.calidad + gain);
      } else if (p.age <= 30) {
        p.calidad = Math.min(95, Math.max(20, p.calidad + randInt(s.talentRng, -1, 1)));
      } else {
        p.calidad = Math.max(20, p.calidad + randInt(s.talentRng, -3, -1));
      }

      if (p.age <= 21) {
        const delta = p.calidad - before;
        if (delta > 0 && (!bestYoung || delta > bestYoung.delta)) {
          bestYoung = { player: p, delta };
        }
      }
    }
  }

  if (bestYoung) {
    const teamName = teamById.get(bestYoung.player.teamId)?.name ?? '—';
    s.awards.push({
      year: s.year,
      tipo: 'mejor_joven',
      playerId: bestYoung.player.id,
      playerName: bestYoung.player.name,
      teamId: bestYoung.player.teamId,
      teamName,
      valor: bestYoung.delta,
    });
  }
}

// ─── Retirement (§A4) ────────────────────────────────────────────────────

const EARLY_RETIREMENT_MIN_AGE = 35;
const EARLY_RETIREMENT_MAX_AGE = 37;
const EARLY_RETIREMENT_PROB = 0.15;

export function retirePlayers(s: GameState): void {
  if (s.players.length === 0) return;
  s.players = s.players.filter((p) => {
    if (p.age > 37 || p.calidad < 25) return false;
    if (
      p.age >= EARLY_RETIREMENT_MIN_AGE &&
      p.age <= EARLY_RETIREMENT_MAX_AGE &&
      rngNext(s.talentRng) < EARLY_RETIREMENT_PROB
    ) {
      return false;
    }
    return true;
  });
}

// ─── Youth intake (§A5) ──────────────────────────────────────────────────

const YOUTH_INTAKE_MIN = 1;
const YOUTH_INTAKE_MAX = 2;
const YOUTH_MIN_AGE = 16;
const YOUTH_MAX_AGE = 18;
const YOUTH_CALIDAD_MIN = 20;
const YOUTH_CALIDAD_MAX = 55;
const ACADEMIA_DOUBLE_ROLL_THRESHOLD = 70;
const FOREIGN_YOUTH_PROB = 0.10;
const SQUAD_CAP = 26;

const POSITION_POOL: PlayerPosition[] = ['POR', 'DEF', 'DEF', 'DEF', 'MED', 'MED', 'MED', 'MED', 'DEL', 'DEL', 'DEL'];

function pickPosition(rng: RngState): PlayerPosition {
  return POSITION_POOL[Math.floor(rngNext(rng) * POSITION_POOL.length)];
}

// Only teams with an already-tracked squad receive canteranos — a team whose
// players were never generated (the default player-less game, or a rival
// without a tracked roster) has nothing to grow a youth pipeline from.
// Mutates s.players in place: adds 1-2 canteranos per eligible team, then
// trims oversized squads by retiring the weakest 30+ bench players.
export function intakeYouthPlayers(s: GameState): void {
  if (s.players.length === 0) return;

  const byTeam = new Map<number, Player[]>();
  for (const p of s.players) {
    const list = byTeam.get(p.teamId);
    if (list) list.push(p);
    else byTeam.set(p.teamId, [p]);
  }

  for (const t of s.teams) {
    if (t.divisionOrden === null) continue;
    const squad = byTeam.get(t.id);
    if (!squad || squad.length === 0) continue;

    const count = randInt(s.talentRng, YOUTH_INTAKE_MIN, YOUTH_INTAKE_MAX);
    for (let i = 0; i < count; i++) {
      const age = randInt(s.talentRng, YOUTH_MIN_AGE, YOUTH_MAX_AGE);
      const calidad = Math.max(
        YOUTH_CALIDAD_MIN,
        Math.min(YOUTH_CALIDAD_MAX, Math.round(t.youthStrength * 0.55 + randInt(s.talentRng, -5, 5))),
      );
      const favorable = t.academia >= ACADEMIA_DOUBLE_ROLL_THRESHOLD;
      const potencial = generatePotencial(s.talentRng, calidad, age, favorable);
      const nationality = rngNext(s.talentRng) < FOREIGN_YOUTH_PROB ? 'extranjero' : 'local';
      s.players.push({
        id: s.nextPlayerId++,
        teamId: t.id,
        name: randomPlayerName(s.talentRng),
        posicion: pickPosition(s.talentRng),
        calidad,
        potencial,
        age,
        season: { goals: 0, assists: 0, cleanSheets: 0, yellowCards: 0, redCards: 0 },
        matchesSuspendedLeft: 0,
        injuredMatchesLeft: 0,
        nationality,
        cantera: true,
      });
    }
  }

  // Cap squads: an academy that keeps producing without ever releasing
  // anyone would grow unbounded. Trim the weakest 30+ bench players down to
  // SQUAD_CAP — deterministic (calidad/age order), no extra rng consumed.
  const byTeamAfter = new Map<number, Player[]>();
  for (const p of s.players) {
    const list = byTeamAfter.get(p.teamId);
    if (list) list.push(p);
    else byTeamAfter.set(p.teamId, [p]);
  }
  const toRemove = new Set<number>();
  for (const squad of byTeamAfter.values()) {
    if (squad.length <= SQUAD_CAP) continue;
    const excess = squad.length - SQUAD_CAP;
    const trimmable = squad.filter((p) => p.age >= 30).sort((a, b) => a.calidad - b.calidad);
    for (let i = 0; i < Math.min(excess, trimmable.length); i++) toRemove.add(trimmable[i].id);
  }
  if (toRemove.size > 0) s.players = s.players.filter((p) => !toRemove.has(p.id));
}
