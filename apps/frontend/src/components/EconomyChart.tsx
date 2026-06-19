import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Paper, Text } from '@mantine/core';
import { money } from '../utils/format';

interface EconomyChartData {
  income: number;
  operatingCost: number;
  prizes: number;
  talent: number;
  net: number;
}

export function EconomyChart({ data }: { data: EconomyChartData }) {
  const chartData = [
    { name: 'Ingresos', value: data.income, color: 'var(--mantine-color-green-6)' },
    { name: 'Operativo', value: -data.operatingCost, color: 'var(--mantine-color-red-4)' },
    { name: 'Premios', value: -data.prizes, color: 'var(--mantine-color-orange-4)' },
    { name: 'Talento', value: -data.talent, color: 'var(--mantine-color-blue-4)' },
    { name: 'Neto', value: data.net, color: data.net >= 0 ? 'var(--mantine-color-green-6)' : 'var(--mantine-color-red-6)' },
  ];

  return (
    <Paper withBorder p="md">
      <Text fw={700} mb="sm">
        Resumen financiero
      </Text>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--mantine-color-dimmed)' }} />
          <YAxis
            tick={{ fontSize: 11, fill: 'var(--mantine-color-dimmed)' }}
            tickFormatter={(v) => money(v)}
            width={80}
          />
          <Tooltip
            formatter={(value) => money(Math.abs(Number(value ?? 0)))}
            contentStyle={{
              backgroundColor: 'var(--mantine-color-dark-6)',
              border: '1px solid var(--mantine-color-dark-4)',
              borderRadius: '8px',
              color: 'var(--mantine-color-white)',
            }}
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Paper>
  );
}
