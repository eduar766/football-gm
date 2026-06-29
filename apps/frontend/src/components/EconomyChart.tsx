import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import { Paper, Text } from '@mantine/core';
import { money } from '../utils/format';

interface EconomyChartData {
  income: number;
  operatingCost: number;
  prizes: number;
  talent: number;
  net: number;
}

interface TooltipPayload {
  value: number;
  name: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (!active || !payload?.length) return null;
  const value = payload[0].value;
  return (
    <Paper p="sm" radius="md" style={{
      backgroundColor: '#1A2332',
      border: '1px solid rgba(255,255,255,0.1)',
    }}>
      <Text size="sm" fw={600} c="dimmed">{label}</Text>
      <Text size="sm" c={value >= 0 ? 'green' : 'red'} style={{ fontFamily: 'var(--mantine-font-family-monospace)' }}>
        {value >= 0 ? '+' : '−'}{money(Math.abs(value))}
      </Text>
    </Paper>
  );
};

export function EconomyChart({ data }: { data: EconomyChartData }) {
  const chartData = [
    { name: 'Ingresos', value: data.income, color: 'url(#gradGreen)' },
    { name: 'Operativo', value: -data.operatingCost, color: 'url(#gradRed)' },
    { name: 'Premios', value: -data.prizes, color: 'url(#gradOrange)' },
    { name: 'Talento', value: -data.talent, color: 'url(#gradBlue)' },
    { name: 'Neto', value: data.net, color: data.net >= 0 ? 'url(#gradGreen)' : 'url(#gradRed)' },
  ];

  return (
    <Paper withBorder p="md">
      <Text fw={700} mb="sm">
        Resumen financiero
      </Text>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
          <defs>
            <linearGradient id="gradGreen" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10B981" stopOpacity={1} />
              <stop offset="100%" stopColor="#059669" stopOpacity={0.8} />
            </linearGradient>
            <linearGradient id="gradRed" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#EF4444" stopOpacity={1} />
              <stop offset="100%" stopColor="#DC2626" stopOpacity={0.8} />
            </linearGradient>
            <linearGradient id="gradOrange" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#F97316" stopOpacity={1} />
              <stop offset="100%" stopColor="#EA580C" stopOpacity={0.8} />
            </linearGradient>
            <linearGradient id="gradBlue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3B82F6" stopOpacity={1} />
              <stop offset="100%" stopColor="#2563EB" stopOpacity={0.8} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.4)', fontFamily: 'var(--mantine-font-family-monospace)' }}
          />
          <YAxis
            tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.4)', fontFamily: 'var(--mantine-font-family-monospace)' }}
            tickFormatter={(v) => money(v)}
            width={80}
          />
          <Tooltip content={<CustomTooltip />} />
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
