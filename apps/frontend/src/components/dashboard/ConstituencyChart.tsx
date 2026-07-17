import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { Paper, Text } from '@mantine/core';
import type { GameSummary } from '@football-gm/contracts';

// Fase 17B backlog pass: the two season-close mood meters, side by side —
// board confidence (la Junta) and public opinion (la Afición). One entry per
// closed season; hidden until there are at least 2 closes to draw a line.
export function ConstituencyChart({ summary }: { summary: GameSummary }) {
  const byYear = new Map<number, { year: number; confianza?: number; opinion?: number }>();
  for (const h of summary.boardConfidence.history) {
    byYear.set(h.year, { ...(byYear.get(h.year) ?? { year: h.year }), confianza: h.value });
  }
  for (const o of summary.opinionHistory) {
    byYear.set(o.year, { ...(byYear.get(o.year) ?? { year: o.year }), opinion: o.value });
  }
  const data = [...byYear.values()].sort((a, b) => a.year - b.year).map((d) => ({ ...d, name: `Año ${d.year}` }));
  if (data.length < 2) return null;

  return (
    <Paper withBorder p="md">
      <Text fw={700} mb="sm">Junta y afición, temporada a temporada</Text>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,176,205,0.08)" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: 'rgba(148,176,205,0.45)', fontFamily: 'var(--mantine-font-family-monospace)' }}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 11, fill: 'rgba(148,176,205,0.45)', fontFamily: 'var(--mantine-font-family-monospace)' }}
            width={35}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--surface-2)',
              border: '1px solid var(--border-2)',
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line type="monotone" dataKey="confianza" name="Confianza de la junta" stroke="#3B82F6" strokeWidth={2} dot={{ r: 3 }} />
          <Line type="monotone" dataKey="opinion" name="Opinión pública" stroke="#F59E0B" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </Paper>
  );
}
