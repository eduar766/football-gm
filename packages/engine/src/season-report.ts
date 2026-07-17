// Fase 16: season report ("periódico de fin de temporada"). Two pipeline
// steps, split because of a hard ordering constraint verified in the engine:
//
//   ... 260 year-bump-and-negotiations   (s.year += 1 — already advanced)
//   ... 290 reset-for-pretemporada       (s.results = []; s.matchReports = [])
//   ... 300 cups-finalize-and-phase      (force-completes unfinished cups)
//
// `s.results`/`s.matchReports` die at 290; force-completed cup champions
// aren't guaranteed until 300. No single step can see both, so:
//
//   - runSeasonReportPrescan  (265, before the wipe) reads match-level data
//     and stashes it in ctx.meta.
//   - runSeasonReportAssemble (305, after cups finalize) reads ctx.meta plus
//     every already-durable array and pushes the finished SeasonReport.
//
// Both are pure re-reads of data other steps already computed (or a cheap
// re-scan of results/matchReports while they're still alive) — zero RNG,
// zero mutation of anything the golden master inspects (it only snapshots
// state.history, never state.seasonReports).

import { buildFeaturedReport, isFeaturedMatch, type FeaturedReport, type FeaturedTag } from './featured';
import { deriveCupRunnerUp } from './cups';
import { divisionName } from './structure';
import type { GameState, MatchReport, SeasonReport } from './types';
import type { SeasonCloseContext } from './season-pipeline';

const META_YEAR = 'season-report:year';
const META_BIGGEST_WIN = 'season-report:biggestWinThisSeason';
const META_FEATURED_MATCH = 'season-report:featuredMatch';
const META_DIVISION_BEFORE = 'season-report:divisionOrdenBefore';

const FEATURED_TAG_PRIORITY: Record<FeaturedTag, number> = {
  titulo: 4,
  derbi: 3,
  goleada: 2,
  remontada: 2,
  hat_trick: 1,
};

export function runSeasonReportPrescan(s: GameState, ctx: SeasonCloseContext): void {
  const reportYear = s.year - 1; // year-bump-and-negotiations (260) already ran
  const teamById = new Map(s.teams.map((t) => [t.id, t]));

  // This season's biggest win, regardless of whether it's an ALL-TIME record
  // (RecordBook only tracks the latter — see allTimeRecordBrokenThisSeason
  // in the assemble step for that distinction).
  let biggestWinThisSeason: SeasonReport['biggestWinThisSeason'] = null;
  for (const r of s.results) {
    const margin = Math.abs(r.homeGoals - r.awayGoals);
    if (!biggestWinThisSeason || margin > biggestWinThisSeason.margin) {
      biggestWinThisSeason = {
        margin,
        homeName: teamById.get(r.homeId)?.name ?? '—',
        awayName: teamById.get(r.awayId)?.name ?? '—',
        homeGoals: r.homeGoals,
        awayGoals: r.awayGoals,
      };
    }
  }

  // "Partido del año": reuse featured.ts (Fase 15D) as-is over every
  // MatchReport of the season, pick the single highest-priority candidate.
  let best: { report: MatchReport; score: number } | null = null;
  for (const mr of s.matchReports) {
    if (!isFeaturedMatch(s, mr)) continue;
    const built = buildFeaturedReport(s, mr);
    if (!built) continue;
    const score = built.tags.reduce((acc, t) => acc + FEATURED_TAG_PRIORITY[t], 0);
    if (!best || score > best.score) best = { report: mr, score };
  }
  const featuredMatch: FeaturedReport | null = best ? buildFeaturedReport(s, best.report) : null;

  // "Before" snapshot for promotion/relegation notes — promotion-relegation
  // (280) mutates divisionOrden AFTER this step and BEFORE assemble (305).
  const divisionOrdenBefore = new Map(
    s.teams
      .filter((t) => t.federationId === s.playerFederationId)
      .map((t) => [t.id, t.divisionOrden] as const),
  );

  ctx.meta.set(META_YEAR, reportYear);
  ctx.meta.set(META_BIGGEST_WIN, biggestWinThisSeason);
  ctx.meta.set(META_FEATURED_MATCH, featuredMatch);
  ctx.meta.set(META_DIVISION_BEFORE, divisionOrdenBefore);
}

export function runSeasonReportAssemble(s: GameState, ctx: SeasonCloseContext): void {
  const reportYear = ctx.meta.get(META_YEAR) as number;

  // No chronicle (e.g. no division-1 standings this season) → nothing to report.
  const chronicle = s.seasonChronicles.at(-1);
  if (!chronicle || chronicle.year !== reportYear) return;

  const teamById = new Map(s.teams.map((t) => [t.id, t]));

  const boardConfidenceIdx = s.boardConfidence.history.findIndex((h) => h.year === reportYear);
  const boardConfidence: SeasonReport['boardConfidence'] =
    boardConfidenceIdx === -1
      ? { before: s.boardConfidence.value, after: s.boardConfidence.value, reasons: [] }
      : {
          before:
            boardConfidenceIdx > 0
              ? s.boardConfidence.history[boardConfidenceIdx - 1].value
              : 60, // CONFIDENCE_START (board.ts) — avoids importing just for this constant
          after: s.boardConfidence.history[boardConfidenceIdx].value,
          reasons: [s.boardConfidence.history[boardConfidenceIdx].reason],
        };

  const mandateEntry = s.mandates.find((m) => m.year === reportYear);
  const mandate: SeasonReport['mandate'] =
    mandateEntry && mandateEntry.met !== null
      ? { description: mandateEntry.description, met: mandateEntry.met }
      : null;

  // Fase 17G: the "special edition" flag — set only on the close where the
  // era actually completed (evaluateEra runs at priority 262, before this
  // step at 305, and stamps eraHistory with the same reportYear semantics).
  const eraEntry = s.eraHistory.find((e) => e.completedYear === reportYear);
  const eraCompleted: SeasonReport['eraCompleted'] = eraEntry ? { era: eraEntry.era } : null;

  // Promotion/relegation notes only — exodus (team_left) is already covered
  // by `briefs` below (federationLog entries), no need to re-derive it here.
  const divisionOrdenBefore = ctx.meta.get(META_DIVISION_BEFORE) as Map<number, number | null>;
  const structuralNotes: string[] = [];
  for (const t of s.teams) {
    if (t.federationId !== s.playerFederationId) continue;
    const before = divisionOrdenBefore.get(t.id);
    if (before === undefined || before === t.divisionOrden) continue;
    if (t.divisionOrden !== null && (before === null || t.divisionOrden < before)) {
      structuralNotes.push(`${t.name} asciende a ${divisionName(t.divisionOrden)}`);
    } else if (t.divisionOrden !== null && before !== null && t.divisionOrden > before) {
      structuralNotes.push(`${t.name} desciende a ${divisionName(t.divisionOrden)}`);
    }
  }

  const awards: SeasonReport['awards'] = s.awards
    .filter((a) => a.year === reportYear)
    .map((a) => ({ tipo: a.tipo, playerName: a.playerName, teamName: a.teamName, valor: a.valor }));

  const cupResults: SeasonReport['cupResults'] = s.cups
    .filter((c) => c.year === reportYear && c.status === 'finalizada')
    .map((c) => {
      const runnerUp = deriveCupRunnerUp(s, c);
      return {
        cupId: c.id,
        name: c.name,
        tipo: c.tipo,
        formato: c.formato,
        championTeamName: c.championTeamId != null ? (teamById.get(c.championTeamId)?.name ?? '—') : '—',
        runnerUpTeamName: runnerUp?.name ?? null,
      };
    });

  const allTimeRecordBrokenThisSeason: SeasonReport['allTimeRecordBrokenThisSeason'] = [];
  if (s.recordBook?.biggestWin?.year === reportYear) {
    const w = s.recordBook.biggestWin;
    allTimeRecordBrokenThisSeason.push({
      type: 'biggestWin',
      detail: `${w.homeName} ${w.homeGoals}-${w.awayGoals} ${w.awayName}`,
    });
  }
  if (s.recordBook?.longestWinStreak?.year === reportYear) {
    const streak = s.recordBook.longestWinStreak;
    allTimeRecordBrokenThisSeason.push({
      type: 'longestWinStreak',
      detail: `${streak.teamName}: ${streak.count} victorias seguidas`,
    });
  }

  const economy: SeasonReport['economy'] =
    s.lastEconomy && s.lastEconomy.year === reportYear
      ? {
          income: s.lastEconomy.income,
          operatingCost: s.lastEconomy.operatingCost,
          normCost: s.lastEconomy.normCost,
          prizes: s.lastEconomy.prizes,
          talent: s.lastEconomy.talent,
          net: s.lastEconomy.net,
          transferFees: s.lastEconomy.transferFees,
          transferIncome: s.lastEconomy.transferIncome,
          matchday: s.lastEconomy.matchday,
          merchandise: s.lastEconomy.merchandise,
          treasuryAfter: s.lastEconomy.treasuryAfter,
        }
      : null;

  // transfer-window (270) runs AFTER year-bump-and-negotiations (260) and
  // stamps its entries with s.year — i.e. the year already advanced to
  // reportYear + 1. That's not a bug in transfers.ts: the backend's own
  // getTransfers comment confirms a transfer's `year` is "la pretemporada de
  // ese año" — the window this closeSeason call just ran belongs to the
  // pretemporada of reportYear + 1, which is also the closing transfer
  // roundup of the season this report is about. So this is the one field
  // that reads s.year (post-bump), not reportYear, unlike every other filter
  // in this function.
  const notableTransfers = [...s.transfers]
    .filter((t) => t.year === s.year)
    .sort((a, b) => b.transferFee - a.transferFee)
    .slice(0, 3);

  // One brief per federation, not per division — finalizeRivalSeason pushes a
  // RivalSeasonRecord for every division (1ª and 2ª); only the top flight is
  // "the federation's" headline story.
  const worldNews: SeasonReport['worldNews'] = s.rivalSeasonRecords
    .filter((r) => r.year === reportYear && r.divisionOrden === 1)
    .map((r) => ({
      federationId: r.federationId,
      federationName: r.federationName,
      championName: r.championName,
      runnerUpName: r.runnerUpName,
      topScorer: r.topScorer
        ? { name: r.topScorer.name, teamName: r.topScorer.teamName, goals: r.topScorer.goals }
        : null,
      cupWinnerName: r.cupWinner?.name ?? null,
      promoted: r.promoted,
      relegated: r.relegated,
    }));

  const globalRankingTop5 = s.globalRankings.slice(0, 5);
  const playerFederationGlobalRank =
    s.globalRankings.find((r) => r.federationId === s.playerFederationId)?.rank ?? null;

  const briefs: SeasonReport['briefs'] = s.federationLog
    .filter((e) => e.year === reportYear)
    .map((e) => ({ type: e.type, title: e.title, detail: e.detail, teamId: e.teamId }));

  const balanceIndex =
    s.history.find((h) => h.year === reportYear && h.divisionOrden === 1)?.balanceIndex ?? null;

  s.seasonReports.push({
    year: reportYear,
    generatedAtMatchday: 0,
    headline: chronicle.headline,
    champion: chronicle.champion,
    revelation: chronicle.revelation,
    disappointment: chronicle.disappointment,
    balanceIndex,
    prestige: { before: ctx.prestigeBefore, after: s.prestige, delta: ctx.prestigeDelta },
    boardConfidence,
    mandate,
    eraCompleted,
    structuralNotes,
    awards,
    cupResults,
    featuredMatch: ctx.meta.get(META_FEATURED_MATCH) as FeaturedReport | null,
    biggestWinThisSeason: ctx.meta.get(META_BIGGEST_WIN) as SeasonReport['biggestWinThisSeason'],
    allTimeRecordBrokenThisSeason,
    economy,
    notableTransfers,
    worldNews,
    globalRankingTop5,
    playerFederationGlobalRank,
    briefs,
  });
}
