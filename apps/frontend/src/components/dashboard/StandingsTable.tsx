import { Link } from '@tanstack/react-router';
import {
  Box,
  Group,
  SegmentedControl,
  Skeleton,
  Stack,
  Table,
  Text,
  Tooltip,
} from '@mantine/core';
import type { StandingRowDto, DivisionRef } from '@football-gm/contracts';

export function StandingsTable({
  gameId,
  division,
  setDivision,
  year,
  divisionName,
  availableDivisions,
  rows,
  isLoading,
}: {
  gameId: string;
  division: number;
  setDivision: (v: number) => void;
  year: number;
  divisionName?: string;
  availableDivisions: DivisionRef[];
  rows: StandingRowDto[];
  isLoading: boolean;
}) {
  return (
    <Group justify="space-between" mb="sm">
      <Text fw={700}>
        {divisionName ?? 'Clasificación'} · Temporada {year}
      </Text>
      {availableDivisions.length > 1 && (
        <SegmentedControl
          size="xs"
          value={String(division)}
          onChange={(v) => setDivision(Number(v))}
          data={availableDivisions.map((d) => ({
            label: d.name,
            value: String(d.orden),
          }))}
        />
      )}
      {isLoading ? (
        <Stack>
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} height={32} />
          ))}
        </Stack>
      ) : (
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>#</Table.Th>
              <Table.Th>Equipo</Table.Th>
              <Tooltip label="Partidos Jugados" position="bottom" withArrow>
                <Table.Th ta="right">PJ</Table.Th>
              </Tooltip>
              <Tooltip label="Ganados" position="bottom" withArrow>
                <Table.Th ta="right">G</Table.Th>
              </Tooltip>
              <Tooltip label="Empatados" position="bottom" withArrow>
                <Table.Th ta="right">E</Table.Th>
              </Tooltip>
              <Tooltip label="Perdidos" position="bottom" withArrow>
                <Table.Th ta="right">P</Table.Th>
              </Tooltip>
              <Tooltip label="Diferencia de Goles" position="bottom" withArrow>
                <Table.Th ta="right">DG</Table.Th>
              </Tooltip>
              <Tooltip label="Puntos" position="bottom" withArrow>
                <Table.Th ta="right">Pts</Table.Th>
              </Tooltip>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((r, i) => {
              const pos = i + 1;
              const isTop3 = pos <= 3;
              const posColors: Record<number, { bg: string; text: string }> = {
                1: { bg: '#F59E0B', text: '#fff' },
                2: { bg: '#9CA3AF', text: '#fff' },
                3: { bg: '#D97706', text: '#fff' },
              };
              return (
                <Table.Tr
                  key={r.teamId}
                  className="stagger-item"
                  style={{
                    borderLeft: isTop3 ? '3px solid #10B981' : '3px solid transparent',
                    animationDelay: `${i * 40}ms`,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderLeftColor = '#10B981'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderLeftColor = isTop3 ? '#10B981' : 'transparent'; }}
                >
                  <Table.Td>
                    {isTop3 ? (
                      <Box style={{ width: 20, height: 20, borderRadius: '50%', background: posColors[pos].bg, color: posColors[pos].text, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>
                        {pos}
                      </Box>
                    ) : pos}
                  </Table.Td>
                  <Table.Td>
                    <Link to="/games/$gameId/teams/$teamId" params={{ gameId, teamId: String(r.teamId) }}>
                      <Text fw={isTop3 ? 600 : 400}>{r.name}</Text>
                    </Link>
                  </Table.Td>
                  <Table.Td ta="right">{r.played}</Table.Td>
                  <Table.Td ta="right">{r.won}</Table.Td>
                  <Table.Td ta="right">{r.drawn}</Table.Td>
                  <Table.Td ta="right">{r.lost}</Table.Td>
                  <Table.Td ta="right" style={{ color: r.goalDiff > 0 ? '#10B981' : r.goalDiff < 0 ? '#EF4444' : undefined }}>
                    {r.goalDiff > 0 ? `+${r.goalDiff}` : r.goalDiff}
                  </Table.Td>
                  <Table.Td ta="right" style={{ fontWeight: 800, fontSize: '1.05em' }}>
                    {r.points}
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      )}
    </Group>
  );
}
