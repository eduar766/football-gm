// Fase 17A: club presidents (player-federation teams) + rival-federation
// commissioners. Purely narrative in v1 — traits shade federationLog entries
// and (from 17C onward) vote intention. Generation at game creation / adhesion
// uses a one-shot seed-derived draw so it never perturbs the persistent
// streams; rotation at season close uses the dedicated politicsRng stream.
// Rival-commissioner traits never bias rival-sim.ts (would perturb rivalRng).

import { rngNext, type RngState } from './rng';
import { randomDirectorName } from './names';
import { logFederation } from './federation-log';
import type { ClubPresident, GameState, PresidentTrait, RivalCommissioner, RivalCommissionerTrait } from './types';

const PRESIDENT_TRAITS: PresidentTrait[] = [
  'leal', 'ambicioso', 'tradicionalista', 'mercenario', 'institucional',
];
const RIVAL_COMMISSIONER_TRAITS: RivalCommissionerTrait[] = [
  'agresivo', 'conservador', 'corrupto', 'visionario', 'diplomatico',
];

// Probability a given team's president is replaced at any given season close.
const ROTATION_CHANCE = 0.08;

function pickTrait<T>(rng: RngState, traits: T[]): T {
  return traits[Math.floor(rngNext(rng) * traits.length)];
}

export function generatePresident(rng: RngState, teamId: number, year: number): Omit<ClubPresident, 'id'> {
  return {
    teamId,
    name: randomDirectorName(rng),
    trait: pickTrait(rng, PRESIDENT_TRAITS),
    sinceYear: year,
    grudge: 0,
    favorOwed: false,
  };
}

export function generateRivalCommissioner(rng: RngState, federationId: number, year: number): RivalCommissioner {
  return {
    federationId,
    name: randomDirectorName(rng),
    trait: pickTrait(rng, RIVAL_COMMISSIONER_TRAITS),
    sinceYear: year,
  };
}

export function presidentOf(s: GameState, teamId: number): ClubPresident | undefined {
  return s.presidents.find((p) => p.teamId === teamId);
}

// A team just joined the player's federation (adhesion effective, or built
// from scratch): give it a president. Draws from the persistent politicsRng
// stream — this happens mid-game, not at creation, so the one-shot seed draw
// used by createGame/migrateState does not apply here.
export function addPresidentForTeam(s: GameState, teamId: number): void {
  if (presidentOf(s, teamId)) return; // defensive: already has one
  const next = generatePresident(s.politicsRng, teamId, s.year);
  s.presidents.push({ id: s.nextPresidentId++, ...next });
}

// A team just left the player's federation (poached, exodus): its president
// stops being tracked. Nothing is deleted elsewhere in the model, but a
// president only makes sense for a team the commissioner currently governs.
export function removePresidentForTeam(s: GameState, teamId: number): void {
  s.presidents = s.presidents.filter((p) => p.teamId !== teamId);
}

// ── Fase 17A: character quotes ───────────────────────────────────────────────
// Deterministic (trait, context) → quote tables — no RNG, safe to call from
// any derived/display path (generateHeadlines) or log call site. The trait IS
// the voice; variety comes from presidents rotating, not from rolling dice.

export type PresidentQuoteContext = 'racha_victorias' | 'racha_derrotas' | 'adhesion' | 'rescate' | 'sancion';

const PRESIDENT_QUOTES: Record<PresidentTrait, Record<PresidentQuoteContext, string>> = {
  leal: {
    racha_victorias: 'Este club cree en el proyecto de la federación, y los resultados lo avalan.',
    racha_derrotas: 'Saldremos de esta juntos, como siempre. Confiamos en la casa.',
    adhesion: 'Venimos a sumar. Esta federación es donde queríamos estar.',
    rescate: 'La federación ha estado a la altura. No lo olvidaremos.',
    sancion: 'Acatamos la sanción. Las normas están para cumplirse, también para nosotros.',
  },
  ambicioso: {
    racha_victorias: 'Esto es solo el principio. Este club juega para ganarlo todo.',
    racha_derrotas: 'Un club con nuestras aspiraciones no puede permitirse esto.',
    adhesion: 'Llegamos para competir por títulos, no para hacer bulto.',
    rescate: 'El apoyo llega. Ahora, a pensar en grande.',
    sancion: 'Esta sanción frena un proyecto ganador. La recurriremos donde haga falta.',
  },
  tradicionalista: {
    racha_victorias: 'El fútbol de siempre, bien hecho. Sin inventos.',
    racha_derrotas: 'Las modas pasan; este club lleva décadas levantándose.',
    adhesion: 'Que quede claro: venimos a jugar al fútbol, no al circo moderno.',
    rescate: 'Un gesto como los de antes. Así se construye una federación.',
    sancion: 'En mis tiempos estas cosas se arreglaban de otra manera.',
  },
  mercenario: {
    racha_victorias: 'Ganar es rentable. Que nadie se confunda sobre por qué estamos aquí.',
    racha_derrotas: 'Perder cuesta dinero. Algo tendrá que cambiar.',
    adhesion: 'Los números salían. Por eso estamos aquí.',
    rescate: 'El dinero llegó a tiempo. Es lo único que cuenta.',
    sancion: '¿Saben cuánto nos cuesta esto? Alguien lo pagará.',
  },
  institucional: {
    racha_victorias: 'El club agradece el esfuerzo de la plantilla y el apoyo de la afición.',
    racha_derrotas: 'El club mantiene plena confianza en el cuerpo técnico.',
    adhesion: 'Afrontamos esta nueva etapa con responsabilidad institucional.',
    rescate: 'Agradecemos formalmente a la federación su apoyo en este trance.',
    sancion: 'El club estudia la resolución y actuará por los cauces reglamentarios.',
  },
};

export function presidentQuote(trait: PresidentTrait, context: PresidentQuoteContext): string {
  return PRESIDENT_QUOTES[trait][context];
}

export type RivalCommissionerQuoteContext = 'goleada' | 'sorpresa';

const RIVAL_COMMISSIONER_QUOTES: Record<RivalCommissionerTrait, Record<RivalCommissionerQuoteContext, string>> = {
  agresivo: {
    goleada: 'Así se compite en una liga de verdad. Tomen nota los demás.',
    sorpresa: 'En mi liga nadie regala nada. Que aprendan los que viven de la renta.',
  },
  conservador: {
    goleada: 'Un resultado abultado, sí, pero lo importante es la estabilidad de la competición.',
    sorpresa: 'Estas cosas pasan. Nuestra liga es sólida y estos episodios lo confirman.',
  },
  corrupto: {
    goleada: 'Un gran espectáculo. No hagan caso de los rumores: aquí todo está en orden.',
    sorpresa: 'Resultados así demuestran que aquí no hay nada escrito. Nada en absoluto.',
  },
  visionario: {
    goleada: 'Esto es fruto del proyecto que pusimos en marcha hace años. Y lo que viene es aún mayor.',
    sorpresa: 'La igualdad competitiva era el objetivo del plan. Ahí están los resultados.',
  },
  diplomatico: {
    goleada: 'Felicito a ambos clubes por el espectáculo. El fútbol gana cuando se juega así.',
    sorpresa: 'Una jornada preciosa para el fútbol. Invito a todas las federaciones a disfrutarla.',
  },
};

export function rivalCommissionerQuote(trait: RivalCommissionerTrait, context: RivalCommissionerQuoteContext): string {
  return RIVAL_COMMISSIONER_QUOTES[trait][context];
}

// closeSeason step: each player-federation team has an independent chance of
// a presidential handover. A new president always starts with grudge 0 — the
// escape hatch a jugador gets from a broken pledge is a boardroom coup.
export function rotatePresidents(s: GameState): void {
  for (const t of s.teams) {
    if (t.federationId !== s.playerFederationId) continue;
    const current = presidentOf(s, t.id);
    if (!current) continue; // defensive: should not happen post-migration
    if (rngNext(s.politicsRng) >= ROTATION_CHANCE) continue;

    const outgoing = current.name;
    const next = generatePresident(s.politicsRng, t.id, s.year);
    current.name = next.name;
    current.trait = next.trait;
    current.sinceYear = s.year;
    current.grudge = 0;
    current.favorOwed = false; // debts (like grudges) belong to the man, not the chair

    logFederation(s, {
      year: s.year,
      matchday: 0,
      type: 'president_change',
      title: `Relevo en la presidencia de ${t.name}`,
      detail: `${outgoing} deja el cargo. ${next.name} (${next.trait}) asume la presidencia.`,
      value: null,
      teamId: t.id,
    });
  }
}
