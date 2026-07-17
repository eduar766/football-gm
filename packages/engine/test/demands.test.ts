import { describe, expect, it } from 'vitest';
import { createGame, startSeason, advanceMatchday, resolveDemand } from '../src/index';
import {
  generateClubDemands,
  expireDemands,
  processExodus,
  PENALIZACION_IGNORAR,
  REWARD_ARRAIGO,
  REWARD_ARRAIGO_CONTRAOFERTA,
} from '../src/demands';
import type { AssemblyProposal, GameState } from '../src/index';

const SQUAD = [
  { name: 'A', posicion: 'DEL' as const, calidad: 60 },
  { name: 'B', posicion: 'MED' as const, calidad: 55 },
];

function gameWithRival(seed = 111): GameState {
  return createGame(seed, {
    startingTreasury: 100_000_000,
    teams: Array.from({ length: 6 }, (_, i) => ({ name: `E${i + 1}`, strength: 55, squad: SQUAD })),
    rivals: [
      {
        name: 'Rival FC',
        prestige: 60,
        divisions: [{ orden: 1, name: 'Primera', teams: [{ name: 'R1', strength: 60, arraigo: 50 }] }],
      },
    ],
  });
}

describe('club demands (Fase 14.5)', () => {
  it('a club in the red requests a rescue, mirrored in the inbox', () => {
    let g = gameWithRival();
    g = startSeason(g);
    g.teams[0].treasury = -3_000_000; // force a treasury crisis
    generateClubDemands(g, g.currentMatchday);

    const demand = g.clubDemands.find((d) => d.type === 'rescate' && d.teamId === g.teams[0].id);
    expect(demand).toBeDefined();
    expect(demand!.amount).toBeGreaterThanOrEqual(3_000_000);
    expect(g.mailbox.some((m) => m.actionKind === 'rescue_request' && m.refId === demand!.id)).toBe(true);
  });

  it('ignoring a demand past its deadline drops the club arraigo', () => {
    let g = gameWithRival();
    g = startSeason(g);
    g.teams[0].treasury = -3_000_000;
    generateClubDemands(g, 1);
    const demand = g.clubDemands.find((d) => !d.resolved)!;
    const before = g.teams[0].arraigo;

    expireDemands(g, demand.deadlineMatchday); // deadline reached, unresolved
    expect(demand.resolved).toBe(true);
    expect(demand.satisfied).toBe(false);
    expect(g.teams[0].arraigo).toBe(before - PENALIZACION_IGNORAR);
  });

  it('accepting a rescue injects cash, raises arraigo and closes the mail', () => {
    let g = gameWithRival();
    g = startSeason(g);
    g.teams[0].treasury = -3_000_000;
    generateClubDemands(g, 1);
    const demand = g.clubDemands.find((d) => !d.resolved)!;
    const arraigoBefore = g.teams[0].arraigo;
    const treasuryBefore = g.treasury;

    g = resolveDemand(g, demand.id, 'aceptar');
    const t = g.teams.find((x) => x.id === demand.teamId)!;
    expect(t.treasury).toBeGreaterThanOrEqual(0);
    expect(t.arraigo).toBe(arraigoBefore + REWARD_ARRAIGO);
    expect(g.treasury).toBeLessThan(treasuryBefore);
    expect(g.clubDemands.find((d) => d.id === demand.id)!.satisfied).toBe(true);
    expect(g.mailbox.find((m) => m.refId === demand.id && m.actionKind === 'rescue_request')!.status).toBe('resuelto');
  });

  it('rejects contraoferta when no assembly proposal is active — the condition has nothing to attach to', () => {
    let g = gameWithRival(444);
    g = startSeason(g);
    g.teams[0].treasury = -3_000_000;
    generateClubDemands(g, 1);
    const demand = g.clubDemands.find((d) => !d.resolved)!;
    expect(resolveDemand(g, demand.id, 'contraoferta')).toBe(g);
  });

  it('contraoferta with an active proposal: half the cost, half the arraigo reward, demand still satisfied', () => {
    let g = gameWithRival(445);
    g = startSeason(g);
    g.teams[0].treasury = -3_000_000;
    generateClubDemands(g, 1);
    const demand = g.clubDemands.find((d) => !d.resolved)!;
    const arraigoBefore = g.teams[0].arraigo;
    const treasuryBefore = g.treasury;

    const proposal: AssemblyProposal = {
      id: 1, kind: 'norma_nueva', payload: { tipo: 'tope_plantilla', valor: 60 },
      majority: 'simple', year: g.year, proposedAtMatchday: 0,
      status: 'en_tramite', resolvedAtMatchday: null, votes: [],
    };
    g.proposals = [proposal];

    g = resolveDemand(g, demand.id, 'contraoferta');
    const t = g.teams.find((x) => x.id === demand.teamId)!;
    expect(t.arraigo).toBe(arraigoBefore + REWARD_ARRAIGO_CONTRAOFERTA);
    expect(REWARD_ARRAIGO_CONTRAOFERTA).toBeLessThan(REWARD_ARRAIGO);
    const spent = treasuryBefore - g.treasury;
    expect(spent).toBe(Math.round((demand.amount ?? 0) / 2));
    expect(g.clubDemands.find((d) => d.id === demand.id)!.satisfied).toBe(true);
  });

  it('advanceMatchday spawns rescue demands for clubs in crisis', () => {
    let g = gameWithRival(999);
    g = startSeason(g);
    g.teams[0].treasury = -5_000_000;
    g = advanceMatchday(g);
    expect(g.clubDemands.some((d) => d.type === 'rescate' && d.teamId === g.teams[0].id)).toBe(true);
  });
});

describe('exodus (Fase 14.5)', () => {
  it('a club stuck at low arraigo for two closes leaves for a rival — but is not deleted', () => {
    const g = gameWithRival(222);
    const victim = g.teams[0];
    const totalTeams = g.teams.length;

    victim.arraigo = 5;
    processExodus(g); // first low close: counter = 1, still ours
    expect(g.teams[0].federationId).toBe(g.playerFederationId);
    expect(g.lowArraigoSeasons[victim.id]).toBe(1);

    g.teams[0].arraigo = 5;
    processExodus(g); // second low close: leaves
    const gone = g.teams.find((t) => t.id === victim.id)!;
    expect(gone.federationId).not.toBe(g.playerFederationId);
    expect(gone.divisionOrden).toBeNull();
    expect(g.teams).toHaveLength(totalTeams); // nothing deleted
  });

  it('resetting arraigo above the threshold clears the exodus counter', () => {
    const g = gameWithRival(333);
    const t = g.teams[0];
    t.arraigo = 5;
    processExodus(g);
    expect(g.lowArraigoSeasons[t.id]).toBe(1);
    g.teams[0].arraigo = 60;
    processExodus(g);
    expect(g.lowArraigoSeasons[t.id]).toBe(0);
  });
});

describe('contraoferta commits the vote (17G backlog pass)', () => {
  it('resolving a demand via contraoferta marks the club\'s vote as bought on the active proposal', () => {
    let g = gameWithRival(446);
    g = startSeason(g);
    g.teams[0].treasury = -3_000_000;
    generateClubDemands(g, 1);
    const demand = g.clubDemands.find((d) => !d.resolved)!;

    const proposal: AssemblyProposal = {
      id: 1, kind: 'norma_nueva', payload: { tipo: 'tope_plantilla', valor: 60 },
      majority: 'simple', year: g.year, proposedAtMatchday: 0,
      status: 'en_tramite', resolvedAtMatchday: null,
      votes: [{ teamId: demand.teamId, score: -30, intention: 'contra', revealed: true, bought: false, pledgeId: null, final: null }],
    };
    g.proposals = [proposal];

    g = resolveDemand(g, demand.id, 'contraoferta');
    expect(g.proposals[0].votes[0].bought).toBe(true); // a bought vote always resolves 'favor'
  });
});
