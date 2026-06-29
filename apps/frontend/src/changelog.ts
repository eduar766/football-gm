export interface ChangelogEntry {
  version: string;
  date: string;
  changes: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: 'Beta 0.1',
    date: '2026-06',
    changes: [
      'Primera versión beta pública',
      'Simulación de ligas rivales con clasificaciones en vivo',
      'Panel "Mundo" con todas las clasificaciones rivales en tiempo real',
      'Historial de campeones de federaciones rivales',
      'Ranking mundial de federaciones por coeficiente acumulado',
      'Copas recurrentes con formato ida y vuelta',
      'Sistema de negociaciones con equipos rivales',
      'Normas de competición con penalizaciones y bonificaciones',
      'Economía con contratos comerciales y repartos de premios',
      'Mandatos de junta con objetivos anuales',
    ],
  },
];

export const CURRENT_VERSION = CHANGELOG[0].version;
