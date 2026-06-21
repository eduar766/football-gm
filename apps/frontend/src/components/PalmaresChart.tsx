import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
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
      <Text size="sm" fw={700} style={{ fontFamily: '"Geist Mono", monospace' }}>
        {value} títulos
      </Text>
    </Paper>
  );
};

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
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis
            type="number"
            tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.4)', fontFamily: '"Geist Mono", monospace' }}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.4)', fontFamily: '"Geist Mono", monospace' }}
            width={100}
          />
          <Tooltip content={<CustomTooltip />} />
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
