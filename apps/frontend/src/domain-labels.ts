// Shared display lookups for domain enums — labels, icons, colors used by
// more than one page/component. Single source of truth so they can't drift.
import type { AwardType, CupType, FederationLogType } from '@football-gm/contracts';

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
};
