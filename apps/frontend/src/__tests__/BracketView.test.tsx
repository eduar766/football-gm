import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { BracketView } from '../components/BracketView';
import type { CupMatchDto } from '@football-gm/contracts';

function wrapper({ children }: { children: React.ReactNode }) {
  return <MantineProvider>{children}</MantineProvider>;
}

const makeMatch = (overrides: Partial<CupMatchDto>): CupMatchDto => ({
  homeTeamId: 1,
  homeTeamName: 'Team A',
  awayTeamId: 2,
  awayTeamName: 'Team B',
  homeGoals: 2,
  awayGoals: 1,
  played: true,
  winnerTeamId: 1,
  ...overrides,
});

describe('BracketView', () => {
  it('renders match team names', () => {
    const rounds = [
      { label: 'Semifinal', matches: [makeMatch({})] },
    ];
    render(<BracketView rounds={rounds} />, { wrapper });
    expect(screen.getByText('Team A')).toBeDefined();
    expect(screen.getByText('Team B')).toBeDefined();
  });

  it('shows empty state when no rounds', () => {
    render(<BracketView rounds={[]} />, { wrapper });
    expect(screen.getByText('Sin partidos para mostrar.')).toBeDefined();
  });

  it('filters out BYE matches', () => {
    const rounds = [
      {
        label: 'Cuartos',
        matches: [
          makeMatch({ homeTeamName: 'BYE', awayTeamName: 'Team C' }),
          makeMatch({ homeTeamName: 'Team D', awayTeamName: 'Team E' }),
        ],
      },
    ];
    render(<BracketView rounds={rounds} />, { wrapper });
    expect(screen.queryByText('BYE')).toBeNull();
    expect(screen.getByText('Team D')).toBeDefined();
  });

  it('shows scores when match is played', () => {
    const rounds = [
      { label: 'Final', matches: [makeMatch({ homeGoals: 3, awayGoals: 0 })] },
    ];
    render(<BracketView rounds={rounds} />, { wrapper });
    expect(screen.getByText('3')).toBeDefined();
    expect(screen.getByText('0')).toBeDefined();
  });

  it('hides scores when match is not played', () => {
    const rounds = [
      {
        label: 'Final',
        matches: [makeMatch({ played: false, homeGoals: 0, awayGoals: 0, winnerTeamId: null })],
      },
    ];
    const { container } = render(<BracketView rounds={rounds} />, { wrapper });
    // Score text elements should not be present for unplayed matches
    const scoreElements = container.querySelectorAll('[data-fw="800"]');
    expect(scoreElements.length).toBe(0);
  });
});
