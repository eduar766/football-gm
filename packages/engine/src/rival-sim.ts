// Fase 9/11: Rival league simulation.
// Fase 9: simulated all at once at closeSeason.
// Fase 11: split into three phases — generateRivalFixtures (startSeason),
// stepRivalMatchdays (advanceMatchday), finalizeRivalSeason (closeSeason).
// All functions use rivalRng exclusively; never touch state.rng.

import { randInt, type RngState } from './rng';
import { generateFixtures } from './fixtures';
import { simulateMatch } from './match';
import type { GameState, Player, RivalFixture, RivalMatchResult, RivalSeasonRecord, RivalStandingRow, SeasonRecord, Team } from './types';

// ── Name generation ──────────────────────────────────────────────────────────

const FIRST_NAMES = [
  'Carlos', 'João', 'Mohammed', 'Lucas', 'David', 'Marco', 'Stefan', 'Luka',
  'Ivan', 'Pierre', 'Antoine', 'Sergio', 'Pablo', 'Alexis', 'Felipe', 'Raúl',
  'Andrés', 'Diego', 'Roberto', 'Julien', 'Tomáš', 'Marek', 'Ali', 'Omar',
  'Yusuf', 'Kwame', 'Emeka', 'Mamadou', 'Cristian', 'Matías',
];
const LAST_NAMES = [
  'Silva', 'Müller', 'García', 'Fernández', 'Rossi', 'Dupont', 'Petrov',
  'Kovač', 'Santos', 'Costa', 'Martínez', 'López', 'González', 'Rodrigues',
  'Carvalho', 'Oliveira', 'Kim', 'Park', 'Al-Hassan', 'Mbeki', 'Diallo',
  'Traoré', 'Mensah', 'Okonkwo', 'Hernández', 'Ramírez', 'Torres', 'Jiménez',
  'Novak', 'Horváth', 'Szabó', 'Černý', 'Popescu', 'Ionescu', 'Nkosi',
  'Dembélé', 'Konaté', 'Cissé', 'Boateng', 'Asamoah',
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function emptyRow(team: Team): RivalStandingRow {
  return {
    teamId: team.id,
    name: team.name,
    played: 0, won: 0, drawn: 0, lost: 0,
    goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0,
  };
}

function applyResult(
  rows: RivalStandingRow[],
  homeId: number,
  awayId: number,
  homeGoals: number,
  awayGoals: number,
): void {
  const home = rows.find(r => r.teamId === homeId);
  const away = rows.find(r => r.teamId === awayId);
  if (!home || !away) return;
  home.played++; away.played++;
  home.goalsFor += homeGoals; home.goalsAgainst += awayGoals;
  away.goalsFor += awayGoals; away.goalsAgainst += homeGoals;
  if (homeGoals > awayGoals) { home.won++; home.points += 3; away.lost++; }
  else if (awayGoals > homeGoals) { away.won++; away.points += 3; home.lost++; }
  else { home.drawn++; away.drawn++; home.points++; away.points++; }
  home.goalDiff = home.goalsFor - home.goalsAgainst;
  away.goalDiff = away.goalsFor - away.goalsAgainst;
}

function sortRows(rows: RivalStandingRow[]): void {
  rows.sort((a, b) => b.points - a.points || b.goalDiff - a.goalDiff || b.goalsFor - a.goalsFor);
}

// Fase 11.4: single-leg cup match; ties resolved by penalty shootout (50/50).
function playCupMatch(home: Team, away: Team, rng: RngState): Team {
  const { homeGoals, awayGoals } = simulateMatch(home, away, rng);
  if (homeGoals !== awayGoals) return homeGoals > awayGoals ? home : away;
  return randInt(rng, 0, 1) === 0 ? home : away;
}

// ── Fase 11.2: generateRivalPlayers ──────────────────────────────────────────

// Called at startSeason. On the first call, generates 15 thin virtual players
// per rival team. On subsequent calls, resets all goal tallies to 0.
// Uses rivalRng for name picks (first call only — players persist across seasons).
export function generateRivalPlayers(s: GameState): void {
  // Reset goals for existing players.
  for (const p of s.rivalPlayers) p.goals = 0;

  const existingTeamIds = new Set(s.rivalPlayers.map(p => p.teamId));
  const rivalDivs = s.divisions.filter(d => d.federationId !== s.playerFederationId);

  for (const div of rivalDivs) {
    const divTeams = s.teams.filter(
      t => t.federationId === div.federationId && t.divisionOrden === div.orden,
    );
    for (const team of divTeams) {
      if (existingTeamIds.has(team.id)) continue;
      for (let i = 0; i < 15; i++) {
        const fn = FIRST_NAMES[randInt(s.rivalRng, 0, FIRST_NAMES.length - 1)];
        const ln = LAST_NAMES[randInt(s.rivalRng, 0, LAST_NAMES.length - 1)];
        s.rivalPlayers.push({ id: s.nextRivalPlayerId++, name: `${fn} ${ln}`, teamId: team.id, goals: 0 });
      }
      existingTeamIds.add(team.id);
    }
  }
}

// ── Fase 11.1: generateRivalFixtures ─────────────────────────────────────────

// Called at startSeason. Generates the full round-robin calendar for every
// rival division and resets standings to empty. Uses rivalRng.
export function generateRivalFixtures(s: GameState): void {
  const rivalDivs = s.divisions.filter(d => d.federationId !== s.playerFederationId);
  const fixtures: RivalFixture[] = [];

  for (const div of rivalDivs) {
    const divTeams = s.teams.filter(
      t => t.federationId === div.federationId && t.divisionOrden === div.orden,
    );
    if (divTeams.length < 2) continue;

    const teamIds = divTeams.map(t => t.id);
    const generated = generateFixtures(teamIds, s.rivalRng, div.orden, 2);
    for (const fx of generated) {
      fixtures.push({ ...fx, federationId: div.federationId });
    }

    // Reset standings to zero for this division
    const key = `${div.federationId}:${div.orden}`;
    s.rivalStandings[key] = divTeams.map(emptyRow);
  }

  s.rivalFixtures = fixtures;
  s.rivalCurrentMatchday = 0;
  s.rivalLastMatchdayResults = [];
}

// ── Fase 11.3: processInterLeagueTransfers ───────────────────────────────────

// Called at startSeason (after generateRivalPlayers resets goals). Uses the
// previous season's rivalSeasonRecords to identify star players from weaker
// rival federations and probabilistically bring them to the player's league.
// All randomness via rivalRng — never touches state.rng.
export function processInterLeagueTransfers(s: GameState): void {
  if (s.rivalSeasonRecords.length === 0) return;
  const prevYear = s.year - 1;
  const prevRecords = s.rivalSeasonRecords.filter(r => r.year === prevYear);
  if (prevRecords.length === 0) return;

  // Player league must have at least one team to receive a star.
  const playerTeams = s.teams.filter(
    t => t.federationId === s.playerFederationId && t.divisionOrden !== null,
  );
  if (playerTeams.length === 0) return;

  const fedById = new Map(s.federations.map(f => [f.id, f]));
  const playerById = new Map(s.rivalPlayers.map(p => [p.id, p]));

  for (const record of prevRecords) {
    if (!record.topScorer) continue;
    const rivalFed = fedById.get(record.federationId);
    if (!rivalFed || rivalFed.isPlayer) continue;

    const prestigeDiff = s.prestige - rivalFed.prestige;
    if (prestigeDiff < 20) continue; // player league must be meaningfully stronger

    // Probability scales with prestige gap: 15% base + 1% per point over 20, capped 60%.
    const prob = Math.min(0.60, 0.15 + (prestigeDiff - 20) * 0.01);
    if (randInt(s.rivalRng, 0, 99) >= Math.round(prob * 100)) continue;

    // Find the rival player entity (may have been removed in a previous iteration).
    const rivalPlayer = playerById.get(record.topScorer.playerId);
    if (!rivalPlayer) continue;

    // Send them to the highest-strength team in the player's league.
    const destination = playerTeams.reduce((best, t) => t.strength > best.strength ? t : best);

    const calidad = Math.min(95, Math.max(45, record.topScorer.goals * 3));
    const fee = Math.round(calidad * 50_000);

    if (s.treasury < fee) continue; // federation can't afford the attraction bonus

    // Create a full Player entity for the player's league.
    const newPlayer: Player = {
      id: s.nextPlayerId++,
      teamId: destination.id,
      name: record.topScorer.name,
      posicion: 'DEL',
      calidad,
      season: { goals: 0, assists: 0, cleanSheets: 0, yellowCards: 0, redCards: 0 },
      matchesSuspendedLeft: 0,
      injuredMatchesLeft: 0,
      age: 24 + randInt(s.rivalRng, 0, 6), // 24–30
      nationality: 'extranjero',
      cantera: false,
    };
    s.players.push(newPlayer);

    // Deduct the attraction fee from the federation treasury.
    s.treasury -= fee;

    // Weaken the rival team by 1-2 points.
    const rivalTeam = s.teams.find(t => t.id === rivalPlayer.teamId);
    if (rivalTeam) {
      rivalTeam.strength = Math.max(25, rivalTeam.strength - randInt(s.rivalRng, 1, 2));
    }

    // Remove the rival player so they don't appear twice.
    const idx = s.rivalPlayers.indexOf(rivalPlayer);
    if (idx !== -1) s.rivalPlayers.splice(idx, 1);
    playerById.delete(rivalPlayer.id);

    // Log to the transfer history with isInternational flag.
    s.transfers.push({
      year: s.year,
      playerId: newPlayer.id,
      playerName: newPlayer.name,
      fromTeamId: rivalPlayer.teamId,
      fromTeamName: record.topScorer.teamName,
      toTeamId: destination.id,
      toTeamName: destination.name,
      calidad,
      transferFee: fee,
      isInternational: true,
      fromFederationName: rivalFed.name,
    });
  }
}

// ── Outgoing inter-league transfers ──────────────────────────────────────────

// Called at startSeason after processInterLeagueTransfers. Rival federations
// that are meaningfully stronger than the player's federation poach high-quality
// players from the player's league. Selling team receives the transfer fee.
// All randomness via rivalRng — never touches state.rng.
export function processOutgoingInterLeagueTransfers(s: GameState): void {
  const playerFed = s.federations.find(f => f.isPlayer);
  if (!playerFed) return;

  const playerTeams = s.teams.filter(
    t => t.federationId === s.playerFederationId && t.divisionOrden !== null,
  );
  if (playerTeams.length === 0) return;

  // Candidates: high-quality available players in the player's league.
  const playerTeamIds = new Set(playerTeams.map(t => t.id));
  const candidates = s.players
    .filter(p => playerTeamIds.has(p.teamId) && p.calidad >= 55 && p.injuredMatchesLeft <= 2)
    .sort((a, b) => b.calidad - a.calidad);
  if (candidates.length === 0) return;

  const poachedIds = new Set<number>();

  for (const rivalFed of s.federations) {
    if (rivalFed.isPlayer) continue;
    const prestigeDiff = rivalFed.prestige - playerFed.prestige;
    if (prestigeDiff < 15) continue; // rival must be meaningfully stronger

    // Probability scales with prestige gap: 15% base + 1% per point over 15, cap 50%.
    const prob = Math.min(0.50, 0.15 + (prestigeDiff - 15) * 0.01);
    if (randInt(s.rivalRng, 0, 99) >= Math.round(prob * 100)) continue;

    // Pick the best available unpoached candidate.
    const target = candidates.find(p => !poachedIds.has(p.id));
    if (!target) break; // no candidates left

    const sellingTeam = s.teams.find(t => t.id === target.teamId);
    const fee = Math.round(target.calidad * 60_000);

    // Selling team pockets the fee.
    if (sellingTeam) sellingTeam.treasury += fee;

    s.transfers.push({
      year: s.year,
      playerId: target.id,
      playerName: target.name,
      fromTeamId: target.teamId,
      fromTeamName: sellingTeam?.name ?? '',
      toTeamId: 0,
      toTeamName: rivalFed.name,
      calidad: target.calidad,
      transferFee: fee,
      isInternational: true,
      toFederationName: rivalFed.name,
    });

    // Remove the player from the player's league.
    const idx = s.players.indexOf(target);
    if (idx !== -1) s.players.splice(idx, 1);
    poachedIds.add(target.id);
  }
}

// ── Fase 11.1: stepRivalMatchdays ────────────────────────────────────────────

// Called from advanceMatchday. Advances rival leagues from rivalCurrentMatchday+1
// up to targetMatchday (inclusive). Updates rivalStandings incrementally and
// stores the last processed matchday's results for the Dashboard.
export function stepRivalMatchdays(s: GameState, targetMatchday: number): void {
  if (s.rivalFixtures.length === 0 || targetMatchday <= s.rivalCurrentMatchday) return;
  const byId = new Map(s.teams.map(t => [t.id, t]));
  let lastMdResults: RivalMatchResult[] = [];

  for (let md = s.rivalCurrentMatchday + 1; md <= targetMatchday; md++) {
    const mdFixtures = s.rivalFixtures.filter(f => f.matchday === md);
    if (mdFixtures.length === 0) continue;

    const mdResults: RivalMatchResult[] = [];
    for (const fx of mdFixtures) {
      const home = byId.get(fx.homeId);
      const away = byId.get(fx.awayId);
      if (!home || !away) continue;
      const { homeGoals, awayGoals } = simulateMatch(home, away, s.rivalRng);

      // Update form and fatigue for rival teams so subsequent matches are realistic.
      const homeResult: 'W' | 'D' | 'L' = homeGoals > awayGoals ? 'W' : homeGoals === awayGoals ? 'D' : 'L';
      const awayResult: 'W' | 'D' | 'L' = awayGoals > homeGoals ? 'W' : awayGoals === homeGoals ? 'D' : 'L';
      home.recentForm = [homeResult, ...home.recentForm].slice(0, 5) as ('W' | 'D' | 'L')[];
      away.recentForm = [awayResult, ...away.recentForm].slice(0, 5) as ('W' | 'D' | 'L')[];
      home.matchesPlayedThisSeason += 1;
      away.matchesPlayedThisSeason += 1;

      const key = `${fx.federationId}:${fx.divisionOrden}`;
      if (!s.rivalStandings[key]) {
        // Safety: initialize if somehow missing
        const fedTeams = s.teams.filter(
          t => t.federationId === fx.federationId && t.divisionOrden === fx.divisionOrden,
        );
        s.rivalStandings[key] = fedTeams.map(emptyRow);
      }
      applyResult(s.rivalStandings[key], fx.homeId, fx.awayId, homeGoals, awayGoals);
      sortRows(s.rivalStandings[key]);

      // 11.2 — Attribute goals to virtual players (rivalRng).
      const homePlayers = s.rivalPlayers.filter(p => p.teamId === fx.homeId);
      const awayPlayers = s.rivalPlayers.filter(p => p.teamId === fx.awayId);
      if (homePlayers.length > 0) {
        for (let g = 0; g < homeGoals; g++) {
          homePlayers[randInt(s.rivalRng, 0, homePlayers.length - 1)].goals++;
        }
      }
      if (awayPlayers.length > 0) {
        for (let g = 0; g < awayGoals; g++) {
          awayPlayers[randInt(s.rivalRng, 0, awayPlayers.length - 1)].goals++;
        }
      }

      const isShock = homeGoals > awayGoals
        ? home.strength < away.strength
        : awayGoals > homeGoals
          ? away.strength < home.strength
          : false;

      mdResults.push({
        matchday: md,
        federationId: fx.federationId,
        divisionOrden: fx.divisionOrden,
        homeId: fx.homeId,
        homeName: home.name,
        awayId: fx.awayId,
        awayName: away.name,
        homeGoals,
        awayGoals,
        isShock,
      });
    }
    lastMdResults = mdResults; // keep only the last matchday's results
  }

  s.rivalLastMatchdayResults = lastMdResults;
  s.rivalCurrentMatchday = targetMatchday;
}

// ── Fase 11.1: finalizeRivalSeason ───────────────────────────────────────────

// Called at closeSeason instead of simulateRivalLeagues. Reads the already-
// accumulated rivalStandings to determine champions, then runs post-season
// adjustments (drift, invest, negotiations, prestige).
export function finalizeRivalSeason(s: GameState): void {
  const champions: SeasonRecord[] = [];
  const rivalDivs = s.divisions.filter(d => d.federationId !== s.playerFederationId);
  const fedById = new Map(s.federations.map(f => [f.id, f]));
  const teamById = new Map(s.teams.map(t => [t.id, t]));

  for (const div of rivalDivs) {
    const key = `${div.federationId}:${div.orden}`;
    const rows = s.rivalStandings[key];
    if (!rows || rows.length === 0) continue;
    const champion = rows[0];

    champions.push({
      year: s.year,
      divisionOrden: div.orden,
      championId: champion.teamId,
      championName: champion.name,
      points: champion.points,
      prestigeBefore: 0,
      prestigeAfter: 0,
      delta: 0,
    });

    // 11.2 — Build rich season record.
    const fed = fedById.get(div.federationId);
    const runnerUpName = rows.length > 1 ? rows[1].name : null;

    // Top scorer: highest-goals player whose team is in this division.
    const divTeamIds = new Set(rows.map(r => r.teamId));
    const divPlayers = s.rivalPlayers.filter(p => divTeamIds.has(p.teamId));
    let topScorer: RivalSeasonRecord['topScorer'] = null;
    if (divPlayers.length > 0) {
      const best = divPlayers.reduce((a, b) => a.goals >= b.goals ? a : b);
      if (best.goals > 0) {
        topScorer = {
          playerId: best.id,
          name: best.name,
          teamName: teamById.get(best.teamId)?.name ?? '',
          goals: best.goals,
        };
      }
    }

    // Relegated: bottom 2 teams (or 1 if league has ≤ 6 teams).
    const relegationCount = rows.length > 6 ? 2 : 1;
    const relegated = rows.slice(-relegationCount).map(r => r.name);

    // 11.4 — Mini-cup: top 4 of the top division (orden 1) per federation.
    let cupWinner: { name: string; teamId: number } | undefined;
    if (div.orden === 1 && rows.length >= 4) {
      const t1 = teamById.get(rows[0].teamId);
      const t2 = teamById.get(rows[1].teamId);
      const t3 = teamById.get(rows[2].teamId);
      const t4 = teamById.get(rows[3].teamId);
      if (t1 && t2 && t3 && t4) {
        const sf1Winner = playCupMatch(t1, t4, s.rivalRng);
        const sf2Winner = playCupMatch(t2, t3, s.rivalRng);
        const finalWinner = playCupMatch(sf1Winner, sf2Winner, s.rivalRng);
        cupWinner = { name: finalWinner.name, teamId: finalWinner.id };
      }
    }

    s.rivalSeasonRecords.push({
      year: s.year,
      federationId: div.federationId,
      federationName: fed?.name ?? '',
      championId: champion.teamId,
      championName: champion.name,
      runnerUpName,
      topScorer,
      relegated,
      points: champion.points,
      cupWinner,
    });
  }

  s.rivalChampions.push(...champions);
  s.rivalFixtures = []; // clear for next season
  s.rivalLastMatchdayResults = [];

  // Post-season rival adjustments (unchanged from Fase 9).
  driftRivalStrengths(s, s.rivalStandings);
  applyRivalInvestments(s);
  runRivalNegotiations(s);
  updateRivalPrestige(s);
}

// Apply strength drift to rival teams based on their performance.
// Teams that finished high get a small boost; teams at the bottom decline.
export function driftRivalStrengths(s: GameState, standings: Record<string, RivalStandingRow[]>): void {
  const byId = new Map(s.teams.map(t => [t.id, t]));

  for (const rows of Object.values(standings)) {
    const n = rows.length;
    if (n === 0) continue;
    for (let i = 0; i < n; i++) {
      const team = byId.get(rows[i].teamId);
      if (!team) continue;
      // Top 3: +1 to +2; Bottom 3: -1 to -2; Middle: -1 to +1
      let drift: number;
      if (i < 3) {
        drift = randInt(s.rivalRng, 1, 2);
      } else if (i >= n - 3) {
        drift = randInt(s.rivalRng, -2, -1);
      } else {
        drift = randInt(s.rivalRng, -1, 1);
      }
      team.strength = Math.max(25, Math.min(95, team.strength + drift));
    }
  }
}

// 6.1 — Rival investment: federations with weak teams actively raise them.
// Uses rivalRng for the boost amount. Each low-prestige federation lifts its
// three weakest teams by 1-2 points so they don't stagnate indefinitely.
export function applyRivalInvestments(s: GameState): void {
  for (const fed of s.federations) {
    if (fed.isPlayer) continue;
    if (fed.prestige >= 20) continue; // only struggling federations invest
    const fedTeams = s.teams
      .filter(t => t.federationId === fed.id && t.divisionOrden !== null)
      .sort((a, b) => a.strength - b.strength);
    const boost = randInt(s.rivalRng, 1, 2);
    for (const t of fedTeams.slice(0, 3)) {
      t.strength = Math.min(85, t.strength + boost);
    }
  }
}

// 6.3 — Rival inter-negotiations: strong rivals occasionally poach teams from
// weaker rivals, redistributing talent across the confederation landscape.
// Fully governed by rivalRng — never touches state.rng.
export function runRivalNegotiations(s: GameState): void {
  const rivalFeds = s.federations.filter(f => !f.isPlayer);

  for (const pursuer of rivalFeds) {
    if (pursuer.prestige < 35) continue; // only established federations can poach
    if (randInt(s.rivalRng, 0, 2) !== 0) continue; // ~33% chance per rival per season

    // Find a weaker rival with low-arraigo teams
    const weaker = rivalFeds.filter(
      f => f.id !== pursuer.id && f.prestige < pursuer.prestige - 15,
    );
    if (weaker.length === 0) continue;

    const victim = weaker[randInt(s.rivalRng, 0, weaker.length - 1)];
    const candidates = s.teams.filter(
      t =>
        t.federationId === victim.id &&
        t.divisionOrden !== null &&
        t.arraigo < 50,
    );
    if (candidates.length === 0) continue;

    // Don't strip a rival below 4 teams — preserve league viability
    const victimTeamCount = s.teams.filter(t => t.federationId === victim.id).length;
    if (victimTeamCount <= 4) continue;

    const target = candidates[randInt(s.rivalRng, 0, candidates.length - 1)];
    const prestigeXfer = Math.max(1, Math.round(target.strength / 15));

    target.federationId = pursuer.id;
    target.arraigo = Math.max(10, target.arraigo - 15);
    pursuer.prestige = Math.min(100, pursuer.prestige + prestigeXfer);
    victim.prestige = Math.max(0, victim.prestige - prestigeXfer);

    // 11.3 — Rival player poaching: move the victim's top scorer to the pursuer.
    // Requires prestige gap > 25 and the player pool to be non-empty.
    if (pursuer.prestige - victim.prestige > 25 && s.rivalPlayers.length > 0) {
      const victimPlayerTeams = s.teams
        .filter(t => t.federationId === victim.id && t.divisionOrden !== null)
        .map(t => t.id);
      const victimPlayers = s.rivalPlayers.filter(p => victimPlayerTeams.includes(p.teamId));
      if (victimPlayers.length > 0) {
        const topScorer = victimPlayers.reduce((a, b) => a.goals >= b.goals ? a : b);
        // Only poach if this player scored at least once (has actual quality signal).
        if (topScorer.goals > 0) {
          const pursuerTeams = s.teams.filter(
            t => t.federationId === pursuer.id && t.divisionOrden !== null,
          );
          if (pursuerTeams.length > 0) {
            const destTeam = pursuerTeams.reduce((a, b) => a.strength > b.strength ? a : b);
            topScorer.teamId = destTeam.id;
          }
        }
      }
    }
  }
}

// 6.4 — Update rival federation prestige with its own inertia.
// Prestige represents historical reputation and decays slower than it rises:
// it grows toward strength at ≤+2/season, shrinks at ≤-1/season.
export function updateRivalPrestige(s: GameState): void {
  for (const fed of s.federations) {
    if (fed.isPlayer) continue;
    const teams = s.teams.filter(t => t.federationId === fed.id && t.divisionOrden !== null);
    if (teams.length === 0) continue;
    const avgStrength = teams.reduce((a, t) => a + t.strength, 0) / teams.length;
    const target = Math.round(avgStrength * 0.85);
    const diff = target - fed.prestige;
    // Asymmetric: easier to gain reputation than to lose it.
    const change = diff > 0
      ? Math.min(2, Math.round(diff * 0.15))
      : Math.max(-1, Math.round(diff * 0.08));
    fed.prestige = Math.max(0, Math.min(100, fed.prestige + change));
  }
}
