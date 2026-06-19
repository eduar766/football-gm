export function money(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)} M€`;
  }
  return `${value.toLocaleString('es-ES')} €`;
}

export function pct(value: number): string {
  return `${(value * 100).toFixed(0)}%`;
}

export function trend(current: number, previous: number): 'up' | 'down' | 'same' {
  if (current > previous) return 'up';
  if (current < previous) return 'down';
  return 'same';
}
