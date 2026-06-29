import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { HeadlinesFeed } from '../components/dashboard/HeadlinesFeed';
import type { HeadlineDto } from '@football-gm/contracts';

function wrapper({ children }: { children: React.ReactNode }) {
  return <MantineProvider>{children}</MantineProvider>;
}

const makeHeadline = (overrides: Partial<HeadlineDto>): HeadlineDto => ({
  type: 'goleada',
  text: 'Team A golea 5-0 a Team B',
  teamId: 1,
  importance: 80,
  ...overrides,
});

describe('HeadlinesFeed', () => {
  it('renders headline text', () => {
    const headlines = [makeHeadline({ text: 'Golazo de Player X' })];
    render(<HeadlinesFeed headlines={headlines} />, { wrapper });
    expect(screen.getByText('Golazo de Player X')).toBeDefined();
  });

  it('renders section title', () => {
    render(<HeadlinesFeed headlines={[makeHeadline({})]} />, { wrapper });
    expect(screen.getByText('Titulares')).toBeDefined();
  });

  it('returns null when headlines array is empty', () => {
    const { container } = render(<HeadlinesFeed headlines={[]} />, { wrapper });
    expect(container.querySelector('[class*="mantine"]')).toBeNull();
  });

  it('renders multiple headlines', () => {
    const headlines = [
      makeHeadline({ text: 'Headline 1' }),
      makeHeadline({ text: 'Headline 2' }),
      makeHeadline({ text: 'Headline 3' }),
    ];
    render(<HeadlinesFeed headlines={headlines} />, { wrapper });
    expect(screen.getByText('Headline 1')).toBeDefined();
    expect(screen.getByText('Headline 2')).toBeDefined();
    expect(screen.getByText('Headline 3')).toBeDefined();
  });
});
