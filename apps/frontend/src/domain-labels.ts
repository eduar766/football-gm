// Shared display lookups for domain enums — labels, icons, colors used by
// more than one page/component. Single source of truth so they can't drift.
import type {
  AwardType,
  CaseStatus,
  ConspiracyDemandKind,
  ConspiracyPhase,
  CupType,
  ExposureLevel,
  FederationLogType,
} from '@football-gm/contracts';

export const AWARD_LABEL: Record<AwardType, string> = {
  max_goleador: 'Máximo goleador',
  max_asistente: 'Máximo asistente',
  mejor_portero: 'Mejor portero',
  mejor_joven: 'Mejor joven',
};

export const AWARD_ICON: Record<AwardType, string> = {
  max_goleador: '⚽',
  max_asistente: '🅰️',
  mejor_portero: '🧤',
  mejor_joven: '💎',
};

export const CUP_TIPO_LABEL: Record<CupType, string> = {
  copa: 'Copa',
  liga_juvenil: 'Liga juvenil',
  torneo_verano: 'Torneo de verano',
  inter_ligas: 'Copa Inter-Ligas',
};

export const MEDAL_COLORS = ['#F59E0B', '#9CA3AF', '#D97706'];

export const FED_LOG_STYLE: Record<FederationLogType, { emoji: string; color: string }> = {
  prestige_snapshot: { emoji: '📊', color: 'teal' },
  sponsor_signed: { emoji: '🤝', color: 'green' },
  negotiation_started: { emoji: '💬', color: 'blue' },
  negotiation_effective: { emoji: '✅', color: 'blue' },
  team_created: { emoji: '🏗️', color: 'grape' },
  team_left: { emoji: '🚪', color: 'red' },
  rescue: { emoji: '💸', color: 'orange' },
  norm_created: { emoji: '📐', color: 'cyan' },
  sanction: { emoji: '⚖️', color: 'red' },
  mandate_result: { emoji: '🎯', color: 'yellow' },
  title: { emoji: '🏆', color: 'yellow' },
  president_change: { emoji: '👔', color: 'grape' },
  political_capital: { emoji: '🗳️', color: 'violet' },
  assembly_result: { emoji: '⚖️', color: 'violet' },
  pledge_result: { emoji: '🤝', color: 'orange' },
  integrity_case: { emoji: '🕵️', color: 'red' },
  scandal: { emoji: '🚨', color: 'red' },
  conspiracy: { emoji: '🏴', color: 'red' },
};

export const EXPOSURE_LEVEL_LABEL: Record<ExposureLevel, { label: string; color: string }> = {
  tranquilo: { label: 'Todo tranquilo', color: 'gray' },
  murmullos: { label: 'Corren murmullos', color: 'yellow' },
  prensa_pregunta: { label: 'La prensa hace preguntas', color: 'red' },
};

export const CASE_STATUS_LABEL: Record<CaseStatus, { label: string; color: string }> = {
  abierto: { label: 'Sin resolver', color: 'yellow' },
  investigando: { label: 'Investigando', color: 'blue' },
  confirmado: { label: 'Amaño confirmado', color: 'red' },
  archivado: { label: 'Archivado', color: 'gray' },
  enterrado: { label: 'Enterrado', color: 'grape' },
  filtrado: { label: 'Filtrado', color: 'red' },
  sin_pruebas: { label: 'Sin pruebas', color: 'gray' },
};

export const CONSPIRACY_PHASE_LABEL: Record<ConspiracyPhase, string> = {
  rumor: 'Rumores',
  organizada: 'Conspiración organizada',
  ultimatum: 'Ultimátum',
  desactivada: 'Desactivada',
  consumada: 'Consumada',
};

export const CONSPIRACY_DEMAND_LABEL: Record<ConspiracyDemandKind, string> = {
  mejora_reparto_grandes: 'Mejorar el reparto de premios (+15%)',
  plazas_copa_garantizadas: 'Plaza garantizada en la copa',
  derogar_norma: 'Derogar una norma',
  inversion_estadios: 'Inversión en estadios',
};
