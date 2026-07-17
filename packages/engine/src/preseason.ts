// Fase 14.3: mandatory pre-season checklist. Pure, derived from GameState — no
// mutation, no RNG. The ENGINE stays permissive (startSeason does not reject on
// blockers) so unit tests and the golden master can start a season without
// wiring prizes. The gameplay rule ("can't start the league without prizes and
// a distribution") is enforced at the imperative shell (backend startSeason),
// which calls preseasonBlockers() before advancing the phase.

import type { GameState } from './types';

export interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
  blocking: boolean;
}

export function preseasonChecklist(s: GameState): ChecklistItem[] {
  const playerDivs = s.divisions.filter((d) => d.federationId === s.playerFederationId);
  const teamsInDiv = (orden: number) =>
    s.teams.filter(
      (t) => t.federationId === s.playerFederationId && t.divisionOrden === orden,
    ).length;
  const pending = s.teams.filter(
    (t) => t.federationId === s.playerFederationId && t.divisionOrden === null,
  ).length;
  const topDivTeams = teamsInDiv(1);
  const podium = Math.min(3, Math.max(1, topDivTeams));

  const ligaPrize = s.competitionPrizes.find((p) => p.kind === 'liga');
  const premiosDone = !!ligaPrize && ligaPrize.pool > 0;
  const repartoDone =
    !!ligaPrize &&
    ligaPrize.shares.length >= podium &&
    ligaPrize.shares.reduce((a, b) => a + b, 0) > 0;
  const estructuraDone =
    playerDivs.length > 0 &&
    playerDivs.every((d) => teamsInDiv(d.orden) >= 2) &&
    pending === 0;

  return [
    {
      id: 'premios_liga',
      label: 'Asignar una bolsa de premios a la liga',
      done: premiosDone,
      blocking: true,
    },
    {
      id: 'reparto_valido',
      label: 'Definir un reparto de premios válido (cubre el podio)',
      done: repartoDone,
      blocking: true,
    },
    {
      id: 'estructura_definida',
      label: 'Estructura completa: cada división con ≥2 equipos y sin equipos sin ubicar',
      done: estructuraDone,
      blocking: true,
    },
    {
      id: 'contratos',
      label: 'Tener al menos un contrato comercial activo',
      done: s.commercialContracts.length > 0,
      blocking: false,
    },
    {
      id: 'normas',
      label: 'Definir al menos una norma de gobernanza',
      done: s.norms.length > 0,
      blocking: false,
    },
    {
      // Fase 17G: non-blocking — startSeason auto-commits 'medio' if never chosen.
      id: 'mandato_elegido',
      label: 'Elegir el mandato de la junta para esta temporada',
      done: s.mandateChosen,
      blocking: false,
    },
  ];
}

export function preseasonBlockers(s: GameState): ChecklistItem[] {
  return preseasonChecklist(s).filter((i) => i.blocking && !i.done);
}
