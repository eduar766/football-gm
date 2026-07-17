import { describe, expect, it } from 'vitest';
import {
  addNorm,
  advanceSeason,
  applyPointPenalties,
  closeSeason,
  createGame,
  governancePenalty,
  normBreaches,
  removeNorm,
  sanctionTeam,
  startSeason,
  type AssemblyProposal,
  type GameState,
  type StandingRow,
} from '../src/index';
import { applyApprovedProposal } from '../src/assembly';

function withTeams(seed: number, strengths: number[]): GameState {
  return createGame(seed, {
    teams: strengths.map((s, i) => ({
      name: `T${i + 1}`,
      strength: s,
      arraigo: 50,
    })),
  });
}

describe('defining norms', () => {
  it('adds and replaces (one per type) and removes', () => {
    let s = withTeams(1, Array(10).fill(55));
    s = addNorm(s, 'tope_plantilla', 60);
    expect(s.norms).toHaveLength(1);
    s = addNorm(s, 'tope_plantilla', 50); // replaces
    expect(s.norms).toHaveLength(1);
    expect(s.norms[0].valor).toBe(50);
    s = addNorm(s, 'minimo_competitivo', 40);
    expect(s.norms).toHaveLength(2);
    s = removeNorm(s, s.norms[0].id);
    expect(s.norms).toHaveLength(1);
  });
});

describe('breach detection', () => {
  it('flags teams over a squad cap', () => {
    let s = withTeams(2, [70, 68, 50, 50, 50, 50, 50, 50, 50, 50]);
    s = addNorm(s, 'tope_plantilla', 60);
    const b = normBreaches(s);
    expect(b.map((x) => x.teamId).sort((a, b) => a - b)).toEqual([1, 2]);
    expect(b.every((x) => !x.sanctioned)).toBe(true);
  });

  it('flags teams under a competitive minimum', () => {
    let s = withTeams(3, [60, 60, 60, 60, 60, 60, 60, 60, 38, 36]);
    s = addNorm(s, 'minimo_competitivo', 45);
    expect(normBreaches(s).map((x) => x.teamId).sort((a, b) => a - b)).toEqual([9, 10]);
  });
});

describe('sanctioning', () => {
  it('only sanctions an actual breach, once', () => {
    let s = withTeams(4, [70, 50, 50, 50, 50, 50, 50, 50, 50, 50]);
    s = addNorm(s, 'tope_plantilla', 60);
    const before = s.sanctions.length;
    s = sanctionTeam(s, 2, s.norms[0].id); // T2 (55? actually 50) does not breach
    expect(s.sanctions.length).toBe(before);
    s = sanctionTeam(s, 1, s.norms[0].id); // T1 breaches
    expect(s.sanctions).toHaveLength(1);
    s = sanctionTeam(s, 1, s.norms[0].id); // duplicate
    expect(s.sanctions).toHaveLength(1);
    expect(normBreaches(s).find((b) => b.teamId === 1)!.sanctioned).toBe(true);
  });
});

describe('governance prestige pressure (§4.7)', () => {
  it('unchecked breaches cost prestige; sanctioning removes the cost', () => {
    let s = withTeams(5, [70, 65, 50, 50, 50, 50, 50, 50, 50, 50]);
    s = addNorm(s, 'tope_plantilla', 60);
    expect(governancePenalty(s)).toBeLessThan(0);
    s = sanctionTeam(s, 1, s.norms[0].id);
    s = sanctionTeam(s, 2, s.norms[0].id);
    expect(governancePenalty(s)).toBe(0);
  });

  it('letting breaches slide lowers prestige vs an enforced control', () => {
    const base = () => {
      let s = withTeams(6, [72, 70, 68, 50, 50, 50, 50, 50, 50, 50]);
      return addNorm(s, 'tope_plantilla', 60);
    };
    const ignored = closeSeason(advanceSeason(startSeason(base())));
    let enforced = base();
    for (const b of normBreaches(enforced))
      enforced = sanctionTeam(enforced, b.teamId, b.normId);
    enforced = closeSeason(advanceSeason(startSeason(enforced)));
    expect(ignored.prestige).toBeLessThan(enforced.prestige);
  });
});

describe('norm opposition (Fase 17G)', () => {
  it('an opposing team faces a ~20% stricter threshold in the norm\'s first year only', () => {
    let s = withTeams(50, [65, 65, 65, 65, 65, 65, 65, 65, 65, 65]);
    s = addNorm(s, 'tope_plantilla', 66); // valor 66: nobody breaches at face value (65 <= 66)
    s.norms[0].opposedTeamIds = [1]; // team 1 voted contra
    // Opposing team 1: effective threshold = round(66*0.8) = 53, and 65 > 53 -> breaches.
    // Non-opposing team 2: threshold stays 66, and 65 <= 66 -> no breach.
    const breachedIds = normBreaches(s).map((b) => b.teamId);
    expect(breachedIds).toContain(1);
    expect(breachedIds).not.toContain(2);
  });

  it('the tightening only applies in the norm\'s first year — it lapses afterward', () => {
    let s = withTeams(51, [65, 65, 65, 65, 65, 65, 65, 65, 65, 65]);
    s = addNorm(s, 'tope_plantilla', 66);
    s.norms[0].opposedTeamIds = [1];
    s.year += 1; // simulate a season having passed
    expect(normBreaches(s).map((b) => b.teamId)).not.toContain(1);
  });

  it('minimo_competitivo tightens upward (harder to reach the minimum) for an opposing team', () => {
    let s = withTeams(52, [50, 50, 50, 50, 50, 50, 50, 50, 50, 50]);
    s = addNorm(s, 'minimo_competitivo', 45); // valor 45: nobody breaches at face value (50 >= 45)
    s.norms[0].opposedTeamIds = [1];
    // Opposing team 1: effective threshold = round(45*1.2) = 54, and 50 < 54 -> breaches.
    const breachedIds = normBreaches(s).map((b) => b.teamId);
    expect(breachedIds).toContain(1);
    expect(breachedIds).not.toContain(2);
  });

  it('applyApprovedProposal captures contra voters onto the newly created norm', () => {
    const s = withTeams(53, Array(10).fill(55));
    const proposal: AssemblyProposal = {
      id: 1,
      kind: 'norma_nueva',
      payload: { tipo: 'tope_plantilla', valor: 60 },
      majority: 'simple',
      year: s.year,
      proposedAtMatchday: 0,
      status: 'en_tramite',
      resolvedAtMatchday: null,
      votes: [
        { teamId: 1, score: -30, intention: 'contra', revealed: true, bought: false, pledgeId: null, final: 'contra' },
        { teamId: 2, score: 20, intention: 'favor', revealed: true, bought: false, pledgeId: null, final: 'favor' },
        { teamId: 3, score: -25, intention: 'contra', revealed: true, bought: false, pledgeId: null, final: 'contra' },
      ],
    };
    const next = applyApprovedProposal(s, proposal);
    const norm = next.norms.find((n) => n.tipo === 'tope_plantilla')!;
    expect(norm.opposedTeamIds.sort()).toEqual([1, 3]);
    expect(norm.year).toBe(s.year);
  });
});

describe('point penalties', () => {
  it('subtracts points and re-sorts', () => {
    const rows: StandingRow[] = [
      { teamId: 1, name: 'A', played: 2, won: 2, drawn: 0, lost: 0, goalsFor: 4, goalsAgainst: 0, goalDiff: 4, points: 6 },
      { teamId: 2, name: 'B', played: 2, won: 1, drawn: 1, lost: 0, goalsFor: 3, goalsAgainst: 1, goalDiff: 2, points: 4 },
    ];
    const out = applyPointPenalties(rows, new Map([[1, 3]]));
    expect(out[0].teamId).toBe(2); // A dropped below B
    expect(out.find((r) => r.teamId === 1)!.points).toBe(3);
  });
});

describe('determinism with norms', () => {
  it('same seed + same actions => identical state', () => {
    const run = () => {
      let s = withTeams(404, [70, 65, 60, 55, 55, 55, 55, 55, 55, 55]);
      s = addNorm(s, 'tope_plantilla', 58);
      s = sanctionTeam(s, 1, s.norms[0].id);
      for (let i = 0; i < 4; i++) {
        if (s.phase === 'pretemporada') s = startSeason(s);
        s = closeSeason(advanceSeason(s));
      }
      return s;
    };
    expect(JSON.stringify(run())).toBe(JSON.stringify(run()));
  });
});

describe('norm compliance earns PC at close (Fase 17B §3.3, cierre F17)', () => {
  const SQUAD = [
    { name: 'A', posicion: 'DEL' as const, calidad: 60 },
    { name: 'B', posicion: 'MED' as const, calidad: 55 },
  ];
  const playable = (seed: number, strengths: number[]) =>
    createGame(seed, {
      startingTreasury: 100_000_000,
      teams: strengths.map((s, i) => ({ name: `T${i + 1}`, strength: s, arraigo: 50, squad: SQUAD })),
    });

  it('a season closing with a norm on the books and zero breaches earns +1 PC', () => {
    let g = playable(60, Array(6).fill(55));
    g = addNorm(g, 'tope_plantilla', 99); // nobody can breach
    g = startSeason(g);
    const pcBefore = g.politicalCapital;
    g = closeSeason(advanceSeason(g));
    expect(g.politicalCapital).toBeGreaterThanOrEqual(Math.min(12, pcBefore + 1));
    expect(g.federationLog.some((e) => e.type === 'political_capital' && e.detail.includes('normas cumplidas'))).toBe(true);
  });

  it('no PC when a breach exists at close', () => {
    let g = playable(61, [80, 55, 55, 55, 55, 55]);
    g = addNorm(g, 'tope_plantilla', 60); // T1 breaches
    g = startSeason(g);
    g = closeSeason(advanceSeason(g));
    expect(g.federationLog.some((e) => e.type === 'political_capital' && e.detail.includes('normas cumplidas'))).toBe(false);
  });

  it('no PC when there are no norms at all', () => {
    let g = playable(62, Array(6).fill(55));
    g = startSeason(g);
    g = closeSeason(advanceSeason(g));
    expect(g.federationLog.some((e) => e.type === 'political_capital' && e.detail.includes('normas cumplidas'))).toBe(false);
  });
});
