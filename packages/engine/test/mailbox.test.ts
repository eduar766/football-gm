import { describe, expect, it } from 'vitest';
import {
  advanceSeason,
  closeSeason,
  createGame,
  startSeason,
  markMailRead,
  markAllMailRead,
  unreadMailCount,
} from '../src/index';
import {
  pushMail,
  markMailByRef,
  expireMailbox,
} from '../src/mailbox';
import type { GameState } from '../src/index';

function emptyMailState(): GameState {
  return { mailbox: [], nextMailboxId: 1 } as unknown as GameState;
}

describe('mailbox module (Fase 14.4)', () => {
  it('pushMail assigns incrementing ids and defaults to unread', () => {
    const s = emptyMailState();
    pushMail(s, {
      year: 1, matchday: 0, category: 'aviso', title: 'A', body: 'b',
      actionKind: null, refId: null, teamId: null, deadlineMatchday: null, createdAtMatchday: 0,
    });
    pushMail(s, {
      year: 1, matchday: 0, category: 'aviso', title: 'B', body: 'b',
      actionKind: null, refId: null, teamId: null, deadlineMatchday: null, createdAtMatchday: 0,
    });
    expect(s.mailbox.map((m) => m.id)).toEqual([1, 2]);
    expect(unreadMailCount(s)).toBe(2);
  });

  it('markMailByRef syncs the inbox with a domain object', () => {
    const s = emptyMailState();
    pushMail(s, {
      year: 1, matchday: 3, category: 'evento', title: 'Ev', body: 'b',
      actionKind: 'event', refId: 42, teamId: null, deadlineMatchday: null, createdAtMatchday: 3,
    });
    markMailByRef(s, 'event', 42, 'resuelto');
    expect(s.mailbox[0].status).toBe('resuelto');
  });

  it('expireMailbox flips overdue deadline messages to caducado', () => {
    const s = emptyMailState();
    pushMail(s, {
      year: 1, matchday: 1, category: 'peticion', title: 'Req', body: 'b',
      actionKind: 'demand', refId: 7, teamId: 1, deadlineMatchday: 3, createdAtMatchday: 1,
    });
    expect(expireMailbox(s, 2)).toHaveLength(0); // not overdue yet
    const expired = expireMailbox(s, 4);          // deadline 3 < 4
    expect(expired).toHaveLength(1);
    expect(s.mailbox[0].status).toBe('caducado');
  });
});

describe('mailbox engine integration (Fase 14.4)', () => {
  it('every spawned event has exactly one matching inbox message', () => {
    // Events only spawn when squads exist, so seed each team with a couple of players.
    const squad = [
      { name: 'A', posicion: 'DEL' as const, calidad: 60 },
      { name: 'B', posicion: 'MED' as const, calidad: 55 },
    ];
    let g = createGame(9931, {
      teams: Array.from({ length: 6 }, (_, i) => ({ name: `E${i + 1}`, strength: 55, squad })),
    });
    for (let i = 0; i < 12; i++) g = closeSeason(advanceSeason(startSeason(g)));

    const eventMailRefs = g.mailbox
      .filter((m) => m.actionKind === 'event')
      .map((m) => m.refId);
    // One mail per event, no duplicates.
    expect(new Set(eventMailRefs).size).toBe(eventMailRefs.length);
    expect(eventMailRefs.length).toBe(g.events.length);
    // The scenario should actually produce at least one event over 12 seasons.
    expect(g.events.length).toBeGreaterThan(0);
  });

  it('markMailRead / markAllMailRead lower the unread count', () => {
    let g = createGame(555);
    g = startSeason(g); // issues a mandate → one aviso mail
    expect(unreadMailCount(g)).toBeGreaterThan(0);
    const first = g.mailbox[0];
    g = markMailRead(g, first.id);
    expect(g.mailbox.find((m) => m.id === first.id)!.status).toBe('leido');
    g = markAllMailRead(g);
    expect(unreadMailCount(g)).toBe(0);
  });
});
