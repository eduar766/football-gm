// Batch 5 — Narrativa emergente: headlines (5.1) and rivalry detection (5.3).
// All pure functions over GameState.

import { computeStandings } from './standings';
import type { GameState, Headline, Rivalry, TeamSeasonSnapshot } from './types';

export function generateHeadlines(state: GameState): Headline[] {
  const headlines: Headline[] = [];
  if (state.phase !== 'temporada' || state.currentMatchday === 0) return headlines;

  const teamById = new Map(state.teams.map((t) => [t.id, t]));
  // currentMatchday points to the NEXT (unplayed) matchday between advances —
  // matchReports for the matchday just played sit at currentMatchday - 1.
  const lastMd = state.currentMatchday - 1;

  // ── Last matchday events (player federation) ─────────────────────────────
  const lastReports = state.matchReports.filter(
    (r) => r.matchday === lastMd && r.divisionOrden === 1,
  );

  for (const r of lastReports) {
    const home = teamById.get(r.homeId);
    const away = teamById.get(r.awayId);
    if (!home || !away) continue;

    const diff = Math.abs(r.homeGoals - r.awayGoals);
    const winner = r.homeGoals > r.awayGoals ? home : r.awayGoals > r.homeGoals ? away : null;
    const loser = r.homeGoals > r.awayGoals ? away : r.awayGoals > r.homeGoals ? home : null;
    const winnerGoals = winner === home ? r.homeGoals : r.awayGoals;
    const loserGoals = loser === home ? r.homeGoals : r.awayGoals;

    if (diff >= 4 && winner && loser) {
      headlines.push({
        type: 'goleada',
        text: `Goleada histórica: ${winner.name} aplasta a ${loser.name} (${winnerGoals}–${loserGoals})`,
        teamId: winner.id,
        importance: 3,
      });
    } else if (diff >= 2 && winner && loser && winner.strength < loser.strength - 10) {
      headlines.push({
        type: 'sorpresa',
        text: `Sorpresa: ${winner.name} tumba al favorito ${loser.name} con un contundente ${winnerGoals}–${loserGoals}`,
        teamId: winner.id,
        importance: 2,
      });
    }
  }

  // ── Team streaks (last 4 results, player federation) ─────────────────────
  const playerTeams = state.teams.filter(
    (t) => t.divisionOrden === 1 && t.federationId === state.playerFederationId,
  );
  for (const team of playerTeams) {
    const teamResults = state.results
      .filter(
        (r) => r.divisionOrden === 1 && (r.homeId === team.id || r.awayId === team.id),
      )
      .slice(-4);
    if (teamResults.length < 4) continue;

    const outcomes = teamResults.map((r) => {
      const isHome = r.homeId === team.id;
      const gF = isHome ? r.homeGoals : r.awayGoals;
      const gA = isHome ? r.awayGoals : r.homeGoals;
      return gF > gA ? 'W' : gF < gA ? 'L' : 'D';
    });

    if (outcomes.every((o) => o === 'W')) {
      headlines.push({
        type: 'racha_victorias',
        text: `${team.name} encadena 4 victorias consecutivas y escala posiciones`,
        teamId: team.id,
        importance: 2,
      });
    } else if (outcomes.every((o) => o === 'L')) {
      headlines.push({
        type: 'racha_derrotas',
        text: `Crisis en ${team.name}: cuatro derrotas seguidas sacuden al vestuario`,
        teamId: team.id,
        importance: 2,
      });
    }
  }

  // ── Rival world headlines (max 3) ────────────────────────────────────────
  const rivalResults = state.rivalLastMatchdayResults ?? [];
  const rivalHeadlines: Headline[] = [];
  const fedById = new Map(state.federations.map(f => [f.id, f]));

  for (const r of rivalResults) {
    if (r.divisionOrden !== 1) continue; // only top-flight rival news
    const fedName = fedById.get(r.federationId)?.name ?? '';

    const diff = Math.abs(r.homeGoals - r.awayGoals);
    const winnerName = r.homeGoals > r.awayGoals ? r.homeName : r.awayGoals > r.homeGoals ? r.awayName : null;
    const loserName = r.homeGoals > r.awayGoals ? r.awayName : r.awayGoals > r.homeGoals ? r.homeName : null;
    const wGoals = r.homeGoals > r.awayGoals ? r.homeGoals : r.awayGoals;
    const lGoals = r.homeGoals > r.awayGoals ? r.awayGoals : r.homeGoals;

    if (diff >= 4 && winnerName && loserName) {
      rivalHeadlines.push({
        type: 'goleada',
        text: `[${fedName}] Goleada: ${winnerName} aplasta a ${loserName} (${wGoals}–${lGoals})`,
        teamId: null,
        importance: 2,
        rivalFederationId: r.federationId,
        isRival: true,
      });
    } else if (r.isShock && winnerName && loserName) {
      rivalHeadlines.push({
        type: 'sorpresa',
        text: `[${fedName}] Sorpresa: ${winnerName} derrota al favorito ${loserName}`,
        teamId: null,
        importance: 2,
        rivalFederationId: r.federationId,
        isRival: true,
      });
    }
  }

  // Shuffle rival headlines to avoid always showing the same federations
  for (let i = rivalHeadlines.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rivalHeadlines[i], rivalHeadlines[j]] = [rivalHeadlines[j], rivalHeadlines[i]];
  }

  headlines.push(...rivalHeadlines.slice(0, 3));

  return headlines.sort((a, b) => {
    // Player-federation headlines first, then rivals
    if ((a.isRival ?? false) !== (b.isRival ?? false)) return (a.isRival ? 1 : -1);
    return b.importance - a.importance;
  }).slice(0, 6);
}

// ── Chronicle generation (called from closeSeason) ───────────────────────────

export function buildChronicle(
  s: GameState,
  standingsDiv1: ReturnType<typeof computeStandings>,
): GameState['seasonChronicles'][number] | null {
  if (standingsDiv1.length === 0) return null;

  const champion = standingsDiv1[0];
  const strengthByTeam = new Map(s.teams.map((t) => [t.id, t.strength]));

  // Strength-ranked order (best → worst).
  const byStrength = [...standingsDiv1].sort(
    (a, b) => (strengthByTeam.get(b.teamId) ?? 0) - (strengthByTeam.get(a.teamId) ?? 0),
  );

  let revelation: GameState['seasonChronicles'][number]['revelation'] = null;
  let disappointment: GameState['seasonChronicles'][number]['disappointment'] = null;
  let bestRevDiff = 2;
  let worstRevDiff = 2;

  for (let i = 0; i < byStrength.length; i++) {
    const row = byStrength[i];
    const expectedPos = i + 1;
    const actualPos = standingsDiv1.findIndex((r) => r.teamId === row.teamId) + 1;
    const overperform = expectedPos - actualPos; // positive = beat expectations
    const underperform = actualPos - expectedPos;

    if (overperform >= bestRevDiff) {
      bestRevDiff = overperform;
      revelation = {
        teamId: row.teamId,
        name: row.name,
        reason: `Terminó ${actualPos}º cuando se le esperaba ${expectedPos}º`,
      };
    }
    if (underperform >= worstRevDiff) {
      worstRevDiff = underperform;
      disappointment = {
        teamId: row.teamId,
        name: row.name,
        reason: `Terminó ${actualPos}º cuando se le esperaba ${expectedPos}º`,
      };
    }
  }

  const goalsAward = s.awards.find((a) => a.year === s.year && a.tipo === 'max_goleador');
  const bestPlayer = goalsAward
    ? {
        playerId: goalsAward.playerId,
        name: goalsAward.playerName,
        teamId: goalsAward.teamId,
        teamName: goalsAward.teamName,
        goals: goalsAward.valor,
      }
    : null;

  const titlePts = champion.points;
  return {
    year: s.year,
    divisionOrden: 1,
    champion: { teamId: champion.teamId, name: champion.name, points: titlePts },
    revelation,
    disappointment,
    bestPlayer,
    headline: `${champion.name} se proclama campeón con ${titlePts} puntos${
      revelation ? ` — ${revelation.name} es la revelación del año` : ''
    }`,
  };
}

// ── Rivalry detection (5.3) ──────────────────────────────────────────────────

export function detectRivalries(state: GameState): Rivalry[] {
  const snapshots: TeamSeasonSnapshot[] = state.teamSeasonHistory ?? [];
  if (snapshots.length === 0) return [];

  const playerTeamIds = new Set(
    state.teams
      .filter((t) => t.federationId === state.playerFederationId)
      .map((t) => t.id),
  );

  // Group snapshots by teamId (player-federation only).
  const byTeam = new Map<number, TeamSeasonSnapshot[]>();
  for (const snap of snapshots) {
    if (!playerTeamIds.has(snap.teamId)) continue;
    if (!byTeam.has(snap.teamId)) byTeam.set(snap.teamId, []);
    byTeam.get(snap.teamId)!.push(snap);
  }

  const teamIds = [...byTeam.keys()];
  const teamById = new Map(state.teams.map((t) => [t.id, t]));
  const rivalries: Rivalry[] = [];

  for (let i = 0; i < teamIds.length; i++) {
    for (let j = i + 1; j < teamIds.length; j++) {
      const idA = teamIds[i];
      const idB = teamIds[j];
      const snapsA = byTeam.get(idA) ?? [];
      const snapsB = byTeam.get(idB) ?? [];

      let adjacentSeasons = 0;
      for (const snapA of snapsA) {
        const snapB = snapsB.find(
          (sb) => sb.year === snapA.year && sb.divisionOrden === snapA.divisionOrden,
        );
        if (snapB && Math.abs(snapA.position - snapB.position) <= 2) {
          adjacentSeasons++;
        }
      }
      if (adjacentSeasons < 2) continue;

      // Head-to-head from all stored results.
      const h2h = state.results.filter(
        (r) =>
          (r.homeId === idA && r.awayId === idB) || (r.homeId === idB && r.awayId === idA),
      );
      let wins = 0, draws = 0, losses = 0;
      for (const r of h2h) {
        const gA = r.homeId === idA ? r.homeGoals : r.awayGoals;
        const gB = r.homeId === idA ? r.awayGoals : r.homeGoals;
        if (gA > gB) wins++;
        else if (gA < gB) losses++;
        else draws++;
      }

      const teamA = teamById.get(idA);
      const teamB = teamById.get(idB);
      if (!teamA || !teamB) continue;

      rivalries.push({
        teamAId: idA,
        teamAName: teamA.name,
        teamBId: idB,
        teamBName: teamB.name,
        seasons: adjacentSeasons,
        headToHead: { wins, draws, losses },
      });
    }
  }

  return rivalries.sort((a, b) => b.seasons - a.seasons).slice(0, 5);
}
