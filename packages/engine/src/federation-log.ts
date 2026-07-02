// Fase 14.6: aggregated narrative timeline of the player's federation.
// A dedicated append-only layer written at the same call-sites where the
// underlying facts already happen (contracts, negotiations, rescues, season
// close, …). Domain ledgers (rescueLog, history, transfers) stay the source of
// truth for their domain; this is the human-readable "what happened to my
// federation" stream. Pure: mutates the already-cloned state in place.

import type { FederationLogEntry, GameState } from './types';

export function logFederation(
  s: GameState,
  entry: Omit<FederationLogEntry, 'id'>,
): void {
  // Defensive: pre-migration states may not have the array yet.
  if (!s.federationLog) s.federationLog = [];
  if (s.nextFederationLogId == null) s.nextFederationLogId = 1;
  s.federationLog.push({ id: s.nextFederationLogId++, ...entry });
}
