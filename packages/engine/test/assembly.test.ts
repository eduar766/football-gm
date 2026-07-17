import { describe, expect, it } from 'vitest';
import {
  advanceMatchday,
  advanceSeason,
  buyVote,
  closeSeason,
  createGame,
  pledgeForVote,
  proposeMeasure,
  revealIntention,
  startSeason,
  withdrawProposal,
  type GameState,
} from '../src/index';
import { resolveAllPendingProposals, resolveProposal } from '../src/assembly';

const SQUAD = [
  { name: 'A', posicion: 'DEL' as const, calidad: 60 },
  { name: 'B', posicion: 'MED' as const, calidad: 55 },
];

function playableGame(seed = 1, teamCount = 6): GameState {
  return createGame(seed, {
    startingTreasury: 100_000_000,
    teams: Array.from({ length: teamCount }, (_, i) => ({ name: `E${i + 1}`, strength: 55, squad: SQUAD })),
  });
}

describe('proposeMeasure (Fase 17C) — creation', () => {
  it('creates one vote per player-federation team currently in a division', () => {
    const g = playableGame();
    const next = proposeMeasure(g, 'norma_nueva', { tipo: 'tope_salarial', valor: 5_000_000 });
    expect(next.proposals).toHaveLength(1);
    expect(next.proposals[0].votes).toHaveLength(6);
    expect(next.proposals[0].status).toBe('en_tramite');
  });

  it('assigns simple majority to norma_nueva and 2/3 to expansion_division', () => {
    const g = playableGame();
    const norm = proposeMeasure(g, 'norma_nueva', { tipo: 'tope_salarial', valor: 5_000_000 });
    expect(norm.proposals[0].majority).toBe('simple');
    const expansion = proposeMeasure(g, 'expansion_division', {});
    expect(expansion.proposals[0].majority).toBe('dos_tercios');
  });

  it('caps at 2 simultaneous pending proposals', () => {
    let g = playableGame();
    g = proposeMeasure(g, 'norma_nueva', { tipo: 'tope_plantilla', valor: 70 });
    g = proposeMeasure(g, 'norma_nueva', { tipo: 'minimo_competitivo', valor: 40 });
    const before = g.proposals.length;
    g = proposeMeasure(g, 'norma_nueva', { tipo: 'tope_edad_media', valor: 30 });
    expect(g.proposals).toHaveLength(before);
  });

  it('rejects structural kinds outside pretemporada', () => {
    let g = playableGame();
    g = startSeason(g);
    expect(g.phase).toBe('temporada');
    const next = proposeMeasure(g, 'cambio_formato', { format: 'ida' });
    expect(next).toBe(g);
  });

  it('allows norma_nueva anytime, including mid-season', () => {
    let g = playableGame();
    g = startSeason(g);
    const next = proposeMeasure(g, 'norma_nueva', { tipo: 'tope_plantilla', valor: 70 });
    expect(next.proposals).toHaveLength(1);
  });

  it('rejects derogar_norma for a norm that does not exist', () => {
    const g = playableGame();
    const next = proposeMeasure(g, 'derogar_norma', { normId: 999 });
    expect(next).toBe(g);
  });

  it('enforces a same-season cooldown after rejection, overridable with 4 PC', () => {
    let g = playableGame();
    g.politicalCapital = 10;
    // Force a rejection by directly marking a resolved proposal as rechazada
    // for this kind/year (cheaper than steering the whole vote to fail).
    g.proposals.push({
      id: g.nextProposalId++,
      kind: 'norma_nueva',
      payload: { tipo: 'tope_plantilla', valor: 70 },
      majority: 'simple',
      year: g.year,
      proposedAtMatchday: 0,
      votes: [],
      status: 'rechazada',
      resolvedAtMatchday: 0,
    });

    const blocked = proposeMeasure(g, 'norma_nueva', { tipo: 'minimo_competitivo', valor: 40 });
    expect(blocked).toBe(g); // cooldown blocks without force

    const before = g.politicalCapital;
    const forced = proposeMeasure(g, 'norma_nueva', { tipo: 'minimo_competitivo', valor: 40 }, true);
    expect(forced.proposals.some((p) => p.status === 'en_tramite')).toBe(true);
    expect(forced.politicalCapital).toBe(before - 4);
  });
});

describe('lobby actions (Fase 17C)', () => {
  it('institucional votes start revealed; other traits start hidden', () => {
    const g = playableGame();
    const next = proposeMeasure(g, 'norma_nueva', { tipo: 'tope_plantilla', valor: 70 });
    const votes = next.proposals[0].votes;
    for (const v of votes) {
      const president = next.presidents.find((p) => p.teamId === v.teamId)!;
      expect(v.revealed).toBe(president.trait === 'institucional');
    }
  });

  it('revealIntention caps manual reveals at 3 and never reveals mercenario', () => {
    let g = playableGame(2, 10);
    g = proposeMeasure(g, 'norma_nueva', { tipo: 'tope_plantilla', valor: 70 });
    const proposalId = g.proposals[0].id;
    const nonInstitucional = g.proposals[0].votes.filter(
      (v) => g.presidents.find((p) => p.teamId === v.teamId)?.trait !== 'institucional',
    );

    let revealedCount = 0;
    for (const v of nonInstitucional) {
      const trait = g.presidents.find((p) => p.teamId === v.teamId)!.trait;
      const before = g.proposals[0].votes.find((vv) => vv.teamId === v.teamId)!.revealed;
      g = revealIntention(g, proposalId, v.teamId);
      const after = g.proposals[0].votes.find((vv) => vv.teamId === v.teamId)!.revealed;
      if (trait === 'mercenario') {
        expect(after).toBe(before); // never reveals
      } else if (!before && after) {
        revealedCount++;
      }
      if (revealedCount >= 3) break;
    }
    expect(revealedCount).toBeLessThanOrEqual(3);
  });

  it('buyVote spends 2 PC and locks the vote, but not for hard-contra scores', () => {
    let g = playableGame();
    g.politicalCapital = 5;
    g = proposeMeasure(g, 'cambio_reparto', { pool: 10_000_000, shares: [90, 5, 5] }); // very meritocratic
    const proposalId = g.proposals[0].id;
    const hardContra = g.proposals[0].votes.find((v) => v.score <= -20);
    const softish = g.proposals[0].votes.find((v) => v.score > -20 && !v.bought);

    if (hardContra) {
      const attempt = buyVote(g, proposalId, hardContra.teamId);
      expect(attempt).toBe(g);
    }
    if (softish) {
      const before = g.politicalCapital;
      g = buyVote(g, proposalId, softish.teamId);
      expect(g.proposals[0].votes.find((v) => v.teamId === softish.teamId)!.bought).toBe(true);
      expect(g.politicalCapital).toBe(before - 2);
    }
  });

  it('buyVote fails without mutating when PC is insufficient', () => {
    let g = playableGame();
    g.politicalCapital = 1;
    g = proposeMeasure(g, 'norma_nueva', { tipo: 'tope_plantilla', valor: 70 });
    const proposalId = g.proposals[0].id;
    const target = g.proposals[0].votes.find((v) => v.score > -20)!;
    const next = buyVote(g, proposalId, target.teamId);
    expect(next).toBe(g);
  });

  it('pledgeForVote creates a Pledge and links it to the vote', () => {
    let g = playableGame();
    g = proposeMeasure(g, 'copa_recurrente', {
      name: 'Copa Test', tipo: 'copa', formato: 'eliminatoria', categoria: 'primer_equipo',
      participantTeamIds: [g.teams[0].id, g.teams[1].id],
    });
    const proposalId = g.proposals[0].id;
    const target = g.proposals[0].votes.find((v) => v.score > -20)!;
    const before = g.pledges.length;
    g = pledgeForVote(g, proposalId, target.teamId, 'plaza_copa', g.teams[0].id);
    expect(g.pledges).toHaveLength(before + 1);
    const vote = g.proposals[0].votes.find((v) => v.teamId === target.teamId)!;
    expect(vote.pledgeId).toBe(g.pledges[g.pledges.length - 1].id);
  });

  it('withdrawProposal removes a pending proposal entirely', () => {
    let g = playableGame();
    g = proposeMeasure(g, 'norma_nueva', { tipo: 'tope_plantilla', valor: 70 });
    const id = g.proposals[0].id;
    g = withdrawProposal(g, id);
    expect(g.proposals).toHaveLength(0);
  });
});

describe('resolution — the reassignment bug (Fase 17C)', () => {
  it('a norma_nueva proposal resolved via advanceMatchday actually leaves a norm in state', () => {
    let g = playableGame(3, 10); // more teams => favor more likely to clear a simple majority
    g = startSeason(g);
    g = proposeMeasure(g, 'norma_nueva', { tipo: 'tope_plantilla', valor: 70 });
    expect(g.proposals[0].status).toBe('en_tramite');

    // Force every vote to favor so this test asserts the DISPATCH wiring
    // (resolveProposal -> applyApprovedProposal -> addNorm), not the RNG.
    for (const v of g.proposals[0].votes) {
      v.score = 100;
      v.intention = 'favor';
    }

    const next = advanceMatchday(g);
    expect(next.proposals[0].status).toBe('aprobada');
    expect(next.norms.some((n) => n.tipo === 'tope_plantilla' && n.valor === 70)).toBe(true);
  });

  it('a cambio_formato proposal resolved via startSeason actually changes leagueFormat', () => {
    let g = playableGame(4, 10);
    g.leagueFormat = 'ida_vuelta';
    g = proposeMeasure(g, 'cambio_formato', { format: 'ida' });
    for (const v of g.proposals[0].votes) {
      v.score = 100;
      v.intention = 'favor';
    }

    const next = startSeason(g);
    expect(next.phase).toBe('temporada');
    expect(next.leagueFormat).toBe('ida');
    expect(next.proposals[0].status).toBe('aprobada');
  });

  it('a proposal that clears no majority is rejected and never applied', () => {
    let g = playableGame(5, 10);
    g = startSeason(g);
    g = proposeMeasure(g, 'norma_nueva', { tipo: 'tope_plantilla', valor: 70 });
    for (const v of g.proposals[0].votes) {
      v.score = -100;
      v.intention = 'contra';
    }

    const next = advanceMatchday(g);
    expect(next.proposals[0].status).toBe('rechazada');
    expect(next.norms.some((n) => n.tipo === 'tope_plantilla' && n.valor === 70)).toBe(false);
  });

  it('a 2/3 proposal needs more than a bare majority', () => {
    let g = playableGame(6, 9); // 9 teams: simple majority = 5, 2/3 = 6
    g = proposeMeasure(g, 'expansion_division', {});
    const votes = g.proposals[0].votes;
    // Exactly 5 favor, 4 contra: clears simple majority but not 2/3.
    votes.forEach((v, i) => {
      v.score = i < 5 ? 100 : -100;
      v.intention = i < 5 ? 'favor' : 'contra';
    });
    const resolved = resolveProposal(g, g.proposals[0].id);
    expect(resolved.proposals[0].status).toBe('rechazada');
  });

  it('indeciso votes resolve deterministically via politicsRng for a fixed seed', () => {
    const build = () => {
      let g = playableGame(7, 10);
      g = proposeMeasure(g, 'norma_nueva', { tipo: 'tope_plantilla', valor: 70 });
      return resolveProposal(g, g.proposals[0].id);
    };
    const a = build();
    const b = build();
    expect(a.proposals[0].votes.map((v) => v.final)).toEqual(b.proposals[0].votes.map((v) => v.final));
  });

  it('closeSeason force-resolves a straggler proposal never reached by advanceMatchday', () => {
    let g = playableGame(8, 10);
    g = startSeason(g);
    // Season already over: no more advanceMatchday calls will happen before close.
    while (!g.seasonOver) g = advanceMatchday(g);
    g = proposeMeasure(g, 'norma_nueva', { tipo: 'tope_plantilla', valor: 70 });
    expect(g.proposals[0].status).toBe('en_tramite');

    const resolved = resolveAllPendingProposals(g);
    expect(resolved.proposals[0].status).not.toBe('en_tramite');
  });
});

describe('admision_acelerada (Fase 17C)', () => {
  it('cuts requirementsSeasonsLeft by one when in gathering_requirements', () => {
    let g = playableGame(9, 10);
    g.negotiations.push({
      id: g.nextNegotiationId++,
      targetTeamId: g.teams[0].id,
      byFederationId: g.playerFederationId,
      fromFederationId: 2,
      state: 'gathering_requirements',
      startedYear: g.year,
      requirementsSeasonsLeft: 3,
      acceptedYear: null,
      effectiveYear: null,
      requirements: [],
      offerValue: 0,
      revealedCount: 0,
    });
    const negId = g.negotiations[0].id;
    g = proposeMeasure(g, 'admision_acelerada', { negotiationId: negId });
    for (const v of g.proposals[0].votes) {
      v.score = 100;
      v.intention = 'favor';
    }
    const resolved = resolveProposal(g, g.proposals[0].id);
    expect(resolved.negotiations[0].requirementsSeasonsLeft).toBe(2);
  });
});

describe('bootstrapping (Fase 17C)', () => {
  it('a cambio_reparto proposal resolves and configures the league prize on a brand-new game with no existing prize', () => {
    // Regression test for a real deadlock found via live verification: the
    // backend used to check "is the league prize configured?" BEFORE
    // resolving pending proposals, so a fresh game could never pass the one
    // proposal it needed to become ready. The fix is ordering — the backend
    // now calls resolveAllPendingProposals before its readiness check. This
    // test pins the engine-side half of that contract: resolving a pending
    // cambio_reparto must actually populate competitionPrizes, even when
    // none existed before (current spread reads as 0, not "no data").
    let g = playableGame(11, 10);
    expect(g.competitionPrizes.find((cp) => cp.kind === 'liga')).toBeUndefined();
    g = proposeMeasure(g, 'cambio_reparto', { pool: 5_000_000, shares: [30, 25, 20, 15, 10] });
    for (const v of g.proposals[0].votes) {
      v.score = 100;
      v.intention = 'favor';
    }
    const resolved = resolveAllPendingProposals(g);
    expect(resolved.proposals[0].status).toBe('aprobada');
    const liga = resolved.competitionPrizes.find((cp) => cp.kind === 'liga');
    expect(liga).toBeDefined();
    expect(liga!.pool).toBe(5_000_000);
  });
});

describe('golden safety (Fase 17C)', () => {
  it('a player-less game never touches proposals/pledges across seasons', () => {
    let g = createGame(777);
    for (let i = 0; i < 6; i++) {
      g = closeSeason(advanceSeason(startSeason(g)));
    }
    expect(g.proposals).toEqual([]);
    expect(g.pledges).toEqual([]);
  });
});

describe('vote result lands in the mailbox (Fase 17C §4.9, cierre F17)', () => {
  it('resolving a proposal pushes an inbox message with the outcome', () => {
    let g = playableGame();
    g = proposeMeasure(g, 'norma_nueva', { tipo: 'tope_salarial', valor: 5_000_000 });
    const proposalId = g.proposals[0].id;
    const mailBefore = g.mailbox.length;
    g = resolveProposal(g, proposalId);
    const resolved = g.proposals.find((p) => p.id === proposalId)!;
    expect(resolved.status === 'aprobada' || resolved.status === 'rechazada').toBe(true);
    const msg = g.mailbox.slice(mailBefore).find((m) => m.refId === proposalId);
    expect(msg).toBeDefined();
    expect(msg!.category).toBe(resolved.status === 'aprobada' ? 'hito' : 'aviso');
    expect(msg!.title).toContain(resolved.status === 'aprobada' ? 'aprobada' : 'rechazada');
  });
});
