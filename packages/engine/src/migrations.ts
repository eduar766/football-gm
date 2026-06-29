import { CONFEDERATIONS } from './seed-data';
import type { GameState } from './types';

export const CURRENT_SCHEMA_VERSION = 2;

/**
 * Applies all schema patches needed to bring an old serialized GameState up to
 * the current version. Called once at first load after a deploy; subsequent
 * loads skip it entirely once schemaVersion is persisted.
 */
export function migrateState(state: GameState): GameState {
  const v = state.schemaVersion ?? 0;

  // v0 → v1: every field added through Fase 11.4.
  if (v < 1) {
    if (!state.poachCooldowns) state.poachCooldowns = {};
    for (const n of state.negotiations) {
      if (!n.requirements) n.requirements = [];
      if (n.offerValue === undefined) n.offerValue = 0;
      if (n.revealedCount === undefined) n.revealedCount = n.requirements.length;
    }
    if (state.eventStrengthPenalty === undefined) state.eventStrengthPenalty = 0;
    if (state.eventCapacityPenaltyPct === undefined) state.eventCapacityPenaltyPct = 0;
    if (state.eventImpulseLoss === undefined) state.eventImpulseLoss = 0;
    if (state.eventTreasuryInjection === undefined) state.eventTreasuryInjection = 0;
    if (!state.confederations) state.confederations = [];
    if (!state.rivalRng) state.rivalRng = { s: 0 };
    if (!state.rivalStandings) state.rivalStandings = {};
    if (!state.rivalChampions) state.rivalChampions = [];
    if (!state.rivalFixtures) state.rivalFixtures = [];
    if (state.rivalCurrentMatchday === undefined) state.rivalCurrentMatchday = 0;
    if (!state.rivalLastMatchdayResults) state.rivalLastMatchdayResults = [];
    if (!state.rivalPlayers) state.rivalPlayers = [];
    if (state.nextRivalPlayerId === undefined) state.nextRivalPlayerId = 1;
    if (!state.rivalSeasonRecords) state.rivalSeasonRecords = [];
    if (!state.mandates) state.mandates = [];
    if (state.nextMandateId === undefined) state.nextMandateId = 1;
    if (state.consecutiveMandateFails === undefined) state.consecutiveMandateFails = 0;
    if (!state.mandatesRng) state.mandatesRng = { s: state.seed ^ 0xb4a4d3c2 };
    if (!state.seasonChronicles) state.seasonChronicles = [];
    if (!state.teamSeasonHistory) state.teamSeasonHistory = [];
    if (state.recordBook === undefined) state.recordBook = null;
    if (!state.federationCoefficients) state.federationCoefficients = [];

    // Ensure all divisions have federationId (saves before Fase 9).
    for (const d of state.divisions) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((d as any).federationId === undefined) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (d as any).federationId = state.playerFederationId;
      }
    }
    // Ensure all federations have confederationId.
    for (const f of state.federations) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((f as any).confederationId === undefined) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (f as any).confederationId = 0;
      }
    }

    // Rebuild missing rival divisions from seed data (saves before Fase 9 division fix).
    const rivalFeds = state.federations.filter((f) => !f.isPlayer);
    for (const rf of rivalFeds) {
      if (state.divisions.some((d) => d.federationId === rf.id)) continue;
      let found = false;
      outer: for (const conf of CONFEDERATIONS) {
        if (!conf.available) continue;
        for (const league of conf.leagues) {
          if (rf.name.includes(league.name) || rf.name.includes(league.country)) {
            const orden = state.divisions.length + 1;
            state.divisions.push({ orden, name: league.name, federationId: rf.id });
            for (const t of state.teams.filter((t) => t.federationId === rf.id && t.divisionOrden === null)) {
              t.divisionOrden = orden;
            }
            found = true;
            break outer;
          }
        }
      }
      if (!found) {
        const orden = state.divisions.length + 1;
        state.divisions.push({ orden, name: rf.name, federationId: rf.id });
        for (const t of state.teams.filter((t) => t.federationId === rf.id && t.divisionOrden === null)) {
          t.divisionOrden = orden;
        }
      }
    }

    state.schemaVersion = 1;
  }

  // v1 → v2: deduplicate recurring cups that accumulated across seasons.
  // saveRecurringCupTemplates was saving one template per past season instead of
  // one per cup name, causing N copies of each recurring cup in season N+1.
  if (v < 2) {
    // Deduplicate cups by (year, name) — keep highest id (most recently created).
    const cupKey = (c: { year: number; name: string }) => `${c.year}::${c.name}`;
    const bestCup = new Map<string, (typeof state.cups)[0]>();
    for (const c of state.cups) {
      const key = cupKey(c);
      if (!bestCup.has(key) || c.id > bestCup.get(key)!.id) bestCup.set(key, c);
    }
    state.cups = [...bestCup.values()].sort((a, b) => a.id - b.id);

    // Deduplicate cupTemplates by name — keep highest cupId.
    if (state.cupTemplates) {
      const bestTmpl = new Map<string, (typeof state.cupTemplates)[0]>();
      for (const t of state.cupTemplates) {
        if (!bestTmpl.has(t.name) || t.cupId > bestTmpl.get(t.name)!.cupId) bestTmpl.set(t.name, t);
      }
      state.cupTemplates = [...bestTmpl.values()];
    }

    state.schemaVersion = 2;
  }

  return state;
}
