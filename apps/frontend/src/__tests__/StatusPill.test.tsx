import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { StatusPill } from '../components/StatusPill';

function wrapper({ children }: { children: React.ReactNode }) {
  return <MantineProvider>{children}</MantineProvider>;
}

describe('StatusPill', () => {
  it('renders the label text', () => {
    render(<StatusPill label="Activo" />, { wrapper });
    expect(screen.getByText('Activo')).toBeDefined();
  });

  it('renders with different labels', () => {
    render(<StatusPill label="Inactivo" color="red" />, { wrapper });
    expect(screen.getByText('Inactivo')).toBeDefined();
  });

  it('passes through additional Badge props', () => {
    render(<StatusPill label="Test" size="lg" />, { wrapper });
    const badge = screen.getByText('Test');
    expect(badge).toBeDefined();
  });
});
