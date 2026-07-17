import { Badge, Group, Paper, Select, Skeleton, Text } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { IconBriefcase } from '@tabler/icons-react';
import type { PressAnswer, RefereeTrait } from '@football-gm/contracts';
import { api } from '../../api';
import { useMutationWithFeedback } from '../../useMutationWithFeedback';
import { QK } from '../../query-keys';

const REFEREE_TRAIT_LABEL: Record<RefereeTrait, string> = {
  estricto: 'Estricto',
  permisivo: 'Permisivo',
  estrella: 'Estrella',
  novato: 'Novato',
};

const PRESS_ANSWER_LABEL: Record<PressAnswer, string> = {
  institucional: 'Institucional',
  populista: 'Populista',
  evasiva: 'Evasiva',
};

export function DeskPanel({ gameId }: { gameId: string }) {
  const id = Number(gameId);
  const desk = useQuery({ queryKey: QK.desk(id), queryFn: () => api.desk(id) });

  const setDesk = useMutationWithFeedback({
    mutationFn: (body: Parameters<typeof api.setDesk>[1]) => api.setDesk(id, body),
    queryKeyToInvalidate: ['desk'],
  });

  if (desk.isLoading) return <Skeleton height={80} radius="md" mb="md" />;
  const d = desk.data;
  if (!d || d.primetimeCandidates.length === 0) return null;

  const fixtureKey = (f: { homeId: number; awayId: number }) => `${f.homeId}-${f.awayId}`;
  const pendingPrimetimeKey = d.pending?.primetimeMatch ? fixtureKey(d.pending.primetimeMatch) : null;

  return (
    <Paper
      p="md"
      mb="md"
      style={{ border: '1px solid rgba(255,255,255,0.06)', borderLeft: '3px solid #8B5CF6' }}
    >
      <Group gap="xs" mb="sm">
        <IconBriefcase size={16} color="#8B5CF6" />
        <Text fw={700} size="sm">El despacho — jornada {d.matchday}</Text>
        <Text size="xs" c="dimmed">Opcional: si no decides nada, se auto-resuelve.</Text>
      </Group>

      <Group gap="md" align="flex-end" wrap="wrap">
        <Select
          label="Partido de la jornada"
          placeholder="Auto (mayor nivel combinado)"
          data={d.primetimeCandidates.map((f) => ({ value: fixtureKey(f), label: `${f.homeName} vs ${f.awayName}` }))}
          value={pendingPrimetimeKey}
          onChange={(val) => {
            const f = d.primetimeCandidates.find((c) => fixtureKey(c) === val);
            setDesk.mutate({ primetimeMatch: f ? { homeId: f.homeId, awayId: f.awayId } : null });
          }}
          clearable
          size="xs"
          style={{ minWidth: 220 }}
        />

        {d.hotMatches.map((f) => {
          const assigned = d.pending?.refereeAssignments.find(
            (ra) => ra.homeId === f.homeId && ra.awayId === f.awayId,
          );
          return (
            <Select
              key={fixtureKey(f)}
              label={<Group gap={4}><Badge size="xs" color="orange">Caliente</Badge><span>{f.homeName} vs {f.awayName}</span></Group>}
              placeholder="Auto (rotación)"
              data={d.availableReferees.map((r) => ({ value: String(r.id), label: `${r.name} (${REFEREE_TRAIT_LABEL[r.trait]})` }))}
              value={assigned ? String(assigned.refereeId) : null}
              onChange={(val) => {
                const otherAssignments = (d.pending?.refereeAssignments ?? []).filter(
                  (ra) => !(ra.homeId === f.homeId && ra.awayId === f.awayId),
                );
                const next = val
                  ? [...otherAssignments, { homeId: f.homeId, awayId: f.awayId, refereeId: Number(val) }]
                  : otherAssignments;
                setDesk.mutate({ refereeAssignments: next });
              }}
              clearable
              size="xs"
              style={{ minWidth: 220 }}
            />
          );
        })}

        {d.pressQuestionEligible && (
          <Select
            label="Pregunta de prensa"
            placeholder="Auto (evasiva)"
            data={(Object.keys(PRESS_ANSWER_LABEL) as PressAnswer[]).map((k) => ({ value: k, label: PRESS_ANSWER_LABEL[k] }))}
            value={d.pending?.pressAnswer ?? null}
            onChange={(val) => setDesk.mutate({ pressAnswer: (val as PressAnswer) ?? null })}
            clearable
            size="xs"
            style={{ minWidth: 180 }}
          />
        )}
      </Group>
    </Paper>
  );
}
