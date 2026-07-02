import { CONFEDERATIONS } from './seed-data';
import type { GameState } from './types';

export const CURRENT_SCHEMA_VERSION = 7;

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

  // v2 → v3: team-level economy (treasury, sponsors, P&L, rescue log).
  if (v < 3) {
    for (const t of state.teams) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const any = t as any;
      if (any.treasury === undefined) {
        // Seed initial treasury from strength so older saves feel plausible.
        any.treasury = t.strength * 200_000 + 5_000_000;
      }
      if (!any.sponsors) any.sponsors = [];
      if (!any.lastTeamEconomy) any.lastTeamEconomy = null;
      if (any.prizesWithheld === undefined) any.prizesWithheld = false;
      if (!any.recentForm) any.recentForm = [];
      if (any.matchesPlayedThisSeason === undefined) any.matchesPlayedThisSeason = 0;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gs = state as any;
    if (!gs.rescueLog) gs.rescueLog = [];
    if (gs.nextTeamSponsorId === undefined) gs.nextTeamSponsorId = 1;

    state.schemaVersion = 3;
  }

  // v3 → v4: renumber rival federation division ordenes from globally-unique
  // to per-federation (each federation's top division becomes orden 1).
  if (v < 4) {
    const playerFedId = state.playerFederationId;
    const rivalFedIds = new Set(
      state.federations.filter(f => f.id !== playerFedId && !f.isPlayer).map(f => f.id),
    );

    for (const fedId of rivalFedIds) {
      const fedDivisions = state.divisions
        .filter(d => d.federationId === fedId)
        .sort((a, b) => a.orden - b.orden);

      fedDivisions.forEach((div, idx) => {
        const oldOrden = div.orden;
        const newOrden = idx + 1;
        if (oldOrden === newOrden) return;

        div.orden = newOrden;

        for (const t of state.teams) {
          if (t.federationId === fedId && t.divisionOrden === oldOrden) {
            t.divisionOrden = newOrden;
          }
        }

        // Fix rivalStandings keys
        const oldKey = `${fedId}:${oldOrden}`;
        const newKey = `${fedId}:${newOrden}`;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rs = (state as any).rivalStandings as Record<string, unknown>;
        if (rs && rs[oldKey] !== undefined) {
          rs[newKey] = rs[oldKey];
          delete rs[oldKey];
        }
      });
    }

    state.schemaVersion = 4;
  }

  // v4 → v5: remove wageCap (dead field, never enforced); add transferVetoes
  // and outgoingTransferRevenue for Fase 13 features.
  if (v < 5) {
    for (const t of state.teams) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (t as any).wageCap;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gs = state as any;
    if (!gs.transferVetoes) gs.transferVetoes = [];
    if (gs.outgoingTransferRevenue === undefined) gs.outgoingTransferRevenue = 0;

    state.schemaVersion = 5;
  }

  // v5 → v6 (Fase 14.1): player-chosen commissioner name.
  if (v < 6) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gs = state as any;
    if (!gs.commissionerName) gs.commissionerName = 'Comisionado/a';

    state.schemaVersion = 6;
  }

  // v6 → v7 (Fase 14.6): federation narrative timeline. Backfill past prestige
  // snapshots from the existing season history so old saves aren't empty.
  if (v < 7) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gs = state as any;
    if (!gs.federationLog) gs.federationLog = [];
    if (gs.nextFederationLogId == null) gs.nextFederationLogId = 1;

    // One prestige snapshot per year (history has one row per division/year).
    const seenYears = new Set<number>();
    for (const h of state.history ?? []) {
      if (seenYears.has(h.year)) continue;
      seenYears.add(h.year);
      const delta = h.delta ?? h.prestigeAfter - h.prestigeBefore;
      gs.federationLog.push({
        id: gs.nextFederationLogId++,
        year: h.year,
        matchday: 0,
        type: 'prestige_snapshot',
        title: 'Cierre de temporada',
        detail: `Prestigio ${h.prestigeBefore} → ${h.prestigeAfter} (${delta >= 0 ? '+' : ''}${delta})`,
        value: h.prestigeAfter,
        teamId: null,
      });
    }

    state.schemaVersion = 7;
  }

  return state;
}
