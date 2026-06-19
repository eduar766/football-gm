import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Paper, Text } from '@mantine/core';

interface PalmaresItem {
  teamId: number;
  teamName: string;
  titles: number;
}

const COLORS = [
  'var(--mantine-color-yellow-5)',
  'var(--mantine-color-gray-4)',
  'var(--mantine-color-orange-6)',
  'var(--mantine-color-blue-5)',
  'var(--mantine-color-green-5)',
  'var(--mantine-color-red-5)',
  'var(--mantine-color-purple-5)',
  'var(--mantine-color-teal-5)',
];

export function PalmaresChart({ data }: { data: PalmaresItem[] }) {
  if (data.length === 0) return null;

  const chartData = data.slice(0, 8).map((d) => ({
    name: d.teamName.length > 12 ? d.teamName.slice(0, 12) + '…' : d.teamName,
    titles: d.titles,
  }));

  return (
    <Paper withBorder p="md">
      <Text fw={700} mb="sm">
        Títulos por equipo
      </Text>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
          <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--mantine-color-dimmed)' }} />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 11, fill: 'var(--mantine-color-dimmed)' }}
            width={100}
          />
          <Tooltip
            formatter={(value) => [`${value} títulos`, '']}
            contentStyle={{
              backgroundColor: 'var(--mantine-color-dark-6)',
              border: '1px solid var(--mantine-color-dark-4)',
              borderRadius: '8px',
              color: 'var(--mantine-color-white)',
            }}
          />
          <Bar dataKey="titles" radius={[0, 4, 4, 0]}>
            {chartData.map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Paper>
  );
}
