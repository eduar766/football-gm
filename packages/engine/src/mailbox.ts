// Fase 14.4: Commissioner inbox — a unified layer over the things that already
// happen silently (events, mandates, and — from 14.5 — club requests). Pure:
// mutates the already-cloned state in place. No RNG use (golden-safe).

import type { MailboxMessage, MailboxStatus, GameState } from './types';

export function pushMail(
  s: GameState,
  msg: Omit<MailboxMessage, 'id' | 'status'> & { status?: MailboxStatus },
): void {
  if (!s.mailbox) s.mailbox = [];
  if (s.nextMailboxId == null) s.nextMailboxId = 1;
  s.mailbox.push({ status: 'sin_leer', ...msg, id: s.nextMailboxId++ });
}

export function markMailRead(prev: GameState, msgId: number): GameState {
  const msg = prev.mailbox?.find((m) => m.id === msgId);
  if (!msg || msg.status !== 'sin_leer') return prev;
  const s = structuredClone(prev);
  s.mailbox.find((m) => m.id === msgId)!.status = 'leido';
  return s;
}

export function markAllMailRead(prev: GameState): GameState {
  if (!prev.mailbox?.some((m) => m.status === 'sin_leer')) return prev;
  const s = structuredClone(prev);
  for (const m of s.mailbox) if (m.status === 'sin_leer') m.status = 'leido';
  return s;
}

// Mark the mail attached to a given ref (e.g. a resolved/expired event) so the
// inbox stays in sync with the underlying domain object. In-place mutation.
export function markMailByRef(
  s: GameState,
  actionKind: NonNullable<MailboxMessage['actionKind']>,
  refId: number,
  status: MailboxStatus,
): void {
  for (const m of s.mailbox ?? []) {
    if (m.actionKind === actionKind && m.refId === refId && m.status !== status) {
      m.status = status;
    }
  }
}

// Expire deadline-bearing messages that were never resolved. The mechanical
// consequence (arraigo hit, etc.) is applied by the caller in 14.5; here we
// only flip the status. In-place mutation.
export function expireMailbox(s: GameState, currentMatchday: number): MailboxMessage[] {
  const expired: MailboxMessage[] = [];
  for (const m of s.mailbox ?? []) {
    if (
      m.deadlineMatchday != null &&
      m.deadlineMatchday < currentMatchday &&
      (m.status === 'sin_leer' || m.status === 'leido')
    ) {
      m.status = 'caducado';
      expired.push(m);
    }
  }
  return expired;
}

export function unreadMailCount(s: GameState): number {
  return (s.mailbox ?? []).filter((m) => m.status === 'sin_leer').length;
}
