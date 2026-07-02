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
      backgroundColor: 'var(--surface-2)',
      border: '1px solid var(--border-2)',
      boxShadow: 'var(--panel-shadow)',
    }}>
      <Text size="sm" fw={600} c="dimmed">{label}</Text>
      <Text size="sm" c={value >= 0 ? 'teal' : 'red'} style={{ fontFamily: 'var(--mantine-font-family-monospace)' }}>
        {value >= 0 ? '+' : '−'}{money(Math.abs(value))}
      </Text>
    </Paper>
  );
};

export function EconomyChart({ data }: { data: EconomyChartData }) {
  const chartData = [
    { name: 'Ingresos', value: data.income, color: 'url(#gradGreen)' },
    { name: 'Operativo', value: -data.operatingCost, color: 'url(#gradRed)' },
    { name: 'Premios', value: -data.prizes, color: 'url(#gradGold)' },
    { name: 'Talento', value: -data.talent, color: 'url(#gradViolet)' },
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
              <stop offset="0%" stopColor="#34d399" stopOpacity={1} />
              <stop offset="100%" stopColor="#10b981" stopOpacity={0.8} />
            </linearGradient>
            <linearGradient id="gradRed" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#EF4444" stopOpacity={1} />
              <stop offset="100%" stopColor="#DC2626" stopOpacity={0.8} />
            </linearGradient>
            <linearGradient id="gradGold" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity={1} />
              <stop offset="100%" stopColor="#d97706" stopOpacity={0.8} />
            </linearGradient>
            <linearGradient id="gradViolet" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8b5cf6" stopOpacity={1} />
              <stop offset="100%" stopColor="#7c3aed" stopOpacity={0.8} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,176,205,0.08)" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: 'rgba(148,176,205,0.45)', fontFamily: 'var(--mantine-font-family-monospace)' }}
          />
          <YAxis
            tick={{ fontSize: 11, fill: 'rgba(148,176,205,0.45)', fontFamily: 'var(--mantine-font-family-monospace)' }}
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
