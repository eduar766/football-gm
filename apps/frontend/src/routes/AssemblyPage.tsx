import { useState } from 'react';
import {
  Badge,
  Button,
  Group,
  Menu,
  MultiSelect,
  NumberInput,
  Paper,
  Select,
  Skeleton,
  Stack,
  Tabs,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import { IconCheck, IconCoin, IconGavel, IconHandGrab, IconHistory, IconTrash, IconUsers, IconX } from '@tabler/icons-react';
import { EmptyState } from '../components/EmptyState';
import { PageHero } from '../components/PageHero';
import { api } from '../api';
import { useMutationWithFeedback } from '../useMutationWithFeedback';
import { QK } from '../query-keys';
import type {
  AssemblyProposalDto,
  NormType,
  PledgeKind,
  PresidentTrait,
  ProposalKind,
  ProposeMeasureRequest,
} from '@football-gm/contracts';

// Backlog pass: the full pledge menu — each entry is a concrete, verifiable
// promise (engine's verifyPledges checks it at closeSeason). plaza_copa needs
// a recurring cup; exencion_norma needs an active norm; the other two are
// always available.
export interface PledgeChoice {
  kind: PledgeKind;
  refId?: number;
  amount?: number;
  label: string;
}

const KIND_LABEL: Record<ProposalKind, string> = {
  norma_nueva: 'Nueva norma',
  derogar_norma: 'Derogar norma',
  cambio_reparto: 'Cambiar reparto de premios',
  copa_recurrente: 'Nueva copa recurrente',
  expansion_division: 'Expandir divisiones',
  cambio_formato: 'Cambiar formato de liga',
  admision_acelerada: 'Admisión acelerada',
};

const NORM_TYPE_LABEL: Record<NormType, string> = {
  tope_plantilla: 'Tope de plantilla',
  minimo_competitivo: 'Mínimo competitivo',
  tope_salarial: 'Tope salarial',
  tope_extrangeros: 'Tope de extranjeros',
  minimo_cantera: 'Mínimo cantera',
  tope_edad_media: 'Tope de edad media',
  tope_deficit: 'Tope de déficit (FFP)',
};

const TRAIT_LABEL: Record<PresidentTrait, string> = {
  leal: 'Leal',
  ambicioso: 'Ambicioso',
  tradicionalista: 'Tradicionalista',
  mercenario: 'Mercenario',
  institucional: 'Institucional',
};

const INTENTION_COLOR: Record<'favor' | 'contra' | 'indeciso', string> = {
  favor: '#10B981',
  contra: '#EF4444',
  indeciso: '#F59E0B',
};

function ProposalCard({
  p,
  index,
  politicalCapital,
  pledgeChoices,
  onReveal,
  onBuy,
  onPledge,
  onWithdraw,
  busy,
}: {
  p: AssemblyProposalDto;
  index: number;
  politicalCapital: number;
  pledgeChoices: PledgeChoice[];
  onReveal: (teamId: number) => void;
  onBuy: (teamId: number) => void;
  onPledge: (teamId: number, choice: PledgeChoice) => void;
  onWithdraw?: () => void;
  busy?: boolean;
}) {
  const isPending = p.status === 'en_tramite';
  const tally = { favor: 0, contra: 0, indeciso: 0 };
  for (const v of p.votes) {
    const shown = isPending ? (v.revealed ? v.intention : 'indeciso') : (v.final ?? 'indeciso');
    tally[shown]++;
  }
  const statusColor = p.status === 'aprobada' ? '#10B981' : p.status === 'rechazada' ? '#EF4444' : '#3B82F6';

  return (
    <Paper
      p="md"
      className="stagger-item"
      style={{
        border: '1px solid rgba(255,255,255,0.06)',
        borderLeft: `3px solid ${statusColor}`,
        animationDelay: `${index * 40}ms`,
      }}
    >
      <Group justify="space-between" mb="sm">
        <div>
          <Text fw={700}>{KIND_LABEL[p.kind]}</Text>
          <Text size="xs" c="dimmed">
            Año {p.year} · Mayoría {p.majority === 'dos_tercios' ? '2/3' : 'simple'}
          </Text>
        </div>
        <Group gap="xs">
          <Badge size="sm" color={p.status === 'aprobada' ? 'green' : p.status === 'rechazada' ? 'red' : 'blue'} variant="light">
            {p.status === 'en_tramite' ? 'En trámite' : p.status === 'aprobada' ? 'Aprobada' : 'Rechazada'}
          </Badge>
          {isPending && onWithdraw && (
            <Tooltip label="Retirar propuesta">
              <Button size="xs" variant="subtle" color="gray" onClick={onWithdraw} loading={busy}>
                <IconTrash size={14} />
              </Button>
            </Tooltip>
          )}
        </Group>
      </Group>

      <Group gap="xs" mb="sm">
        <Badge size="xs" color="green" variant="filled">{tally.favor} a favor</Badge>
        <Badge size="xs" color="red" variant="filled">{tally.contra} en contra</Badge>
        {isPending && <Badge size="xs" color="yellow" variant="filled">{tally.indeciso} ocultos/indecisos</Badge>}
      </Group>

      {isPending && (
        <Stack gap={4}>
          {p.votes.map((v) => (
            <Group key={v.teamId} justify="space-between" py={4} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <Group gap={6} wrap="nowrap">
                <Text size="sm" fw={500}>{v.teamName}</Text>
                {v.presidentTrait && (
                  <Badge size="xs" variant="light" color="gray">{TRAIT_LABEL[v.presidentTrait]}</Badge>
                )}
              </Group>
              <Group gap={6} wrap="nowrap">
                {v.revealed ? (
                  <Badge size="xs" style={{ background: `${INTENTION_COLOR[v.intention]}22`, color: INTENTION_COLOR[v.intention] }}>
                    {v.intention}
                  </Badge>
                ) : (
                  <Badge size="xs" color="gray" variant="light">oculto</Badge>
                )}
                {!v.revealed && (
                  <Button size="compact-xs" variant="subtle" onClick={() => onReveal(v.teamId)}>
                    Revelar
                  </Button>
                )}
                {!v.bought && v.pledgeId === null && (
                  <>
                    <Tooltip label="Comprar el voto (2 PC)">
                      <Button size="compact-xs" variant="light" color="grape" disabled={politicalCapital < 2} onClick={() => onBuy(v.teamId)}>
                        <IconCoin size={13} />
                      </Button>
                    </Tooltip>
                    <Menu shadow="md" width={260} position="bottom-end">
                      <Menu.Target>
                        <Tooltip label="Prometer algo a cambio del voto">
                          <Button size="compact-xs" variant="light" color="orange">
                            <IconHandGrab size={13} />
                          </Button>
                        </Tooltip>
                      </Menu.Target>
                      <Menu.Dropdown>
                        <Menu.Label>Libro de promesas</Menu.Label>
                        {pledgeChoices.map((c, ci) => (
                          <Menu.Item key={ci} onClick={() => onPledge(v.teamId, c)}>
                            {c.label}
                          </Menu.Item>
                        ))}
                      </Menu.Dropdown>
                    </Menu>
                  </>
                )}
                {v.bought && <Badge size="xs" color="grape" variant="filled">comprado</Badge>}
                {v.pledgeId !== null && <Badge size="xs" color="orange" variant="filled">prometido</Badge>}
              </Group>
            </Group>
          ))}
        </Stack>
      )}
    </Paper>
  );
}

export function AssemblyPage() {
  const { gameId } = useParams({ strict: false }) as { gameId: string };
  const id = Number(gameId);

  const assembly = useQuery({ queryKey: QK.assembly(id), queryFn: () => api.assembly(id) });
  const teams = useQuery({ queryKey: QK.teams(id), queryFn: () => api.teams(id) });
  const norms = useQuery({ queryKey: QK.norms(id), queryFn: () => api.norms(id) });
  const negotiations = useQuery({ queryKey: QK.negotiations(id), queryFn: () => api.negotiations(id) });
  const cups = useQuery({ queryKey: QK.cups(id), queryFn: () => api.cups(id) });

  const [kind, setKind] = useState<ProposalKind>('norma_nueva');
  const [normTipo, setNormTipo] = useState<NormType>('tope_plantilla');
  const [normValor, setNormValor] = useState(65);
  const [derogarNormId, setDerogarNormId] = useState<string | null>(null);
  const [repartoPool, setRepartoPool] = useState(5_000_000);
  const [repartoShares, setRepartoShares] = useState('40,25,20,15');
  const [cupName, setCupName] = useState('');
  const [cupParticipants, setCupParticipants] = useState<string[]>([]);
  const [formatoChoice, setFormatoChoice] = useState<'ida' | 'ida_vuelta'>('ida_vuelta');
  const [negotiationId, setNegotiationId] = useState<string | null>(null);
  const [force, setForce] = useState(false);

  const propose = useMutationWithFeedback({
    mutationFn: (body: ProposeMeasureRequest) => api.proposeMeasure(id, body),
    queryKeyToInvalidate: ['assembly', 'summary'],
    successMessage: 'Propuesta presentada a la asamblea',
  });
  const withdraw = useMutationWithFeedback({
    mutationFn: (proposalId: number) => api.withdrawProposal(id, proposalId),
    queryKeyToInvalidate: ['assembly'],
    successMessage: 'Propuesta retirada',
  });
  const reveal = useMutationWithFeedback({
    mutationFn: (vars: { proposalId: number; teamId: number }) => api.revealIntention(id, vars.proposalId, vars.teamId),
    queryKeyToInvalidate: ['assembly'],
    successMessage: 'Intención revelada',
  });
  const buy = useMutationWithFeedback({
    mutationFn: (vars: { proposalId: number; teamId: number }) => api.buyVote(id, vars.proposalId, vars.teamId),
    queryKeyToInvalidate: ['assembly', 'summary'],
    successMessage: 'Voto comprado',
  });
  const pledge = useMutationWithFeedback({
    mutationFn: (vars: { proposalId: number; teamId: number; choice: PledgeChoice }) =>
      api.pledgeForVote(id, vars.proposalId, vars.teamId, vars.choice.kind, vars.choice.refId, vars.choice.amount),
    queryKeyToInvalidate: ['assembly'],
    successMessage: 'Promesa hecha — recuerda cumplirla',
  });

  // Backlog pass: build the concrete pledge menu from current state — one
  // entry per recurring cup (plaza_copa) and active norm (exención), plus the
  // two always-available kinds.
  const pledgeChoices: PledgeChoice[] = [
    { kind: 'rescate_futuro', amount: 1_000_000, label: 'Rescate futuro garantizado (1M€)' },
    { kind: 'mejora_reparto', label: 'Mejora de reparto (no bajará su cuota)' },
    ...(cups.data?.cups ?? [])
      .filter((c) => c.recurring)
      .map((c) => ({ kind: 'plaza_copa' as const, refId: c.id, label: `Plaza en ${c.name}` })),
    ...(norms.data?.norms ?? [])
      .map((n) => ({ kind: 'exencion_norma' as const, refId: n.id, label: `Exención: ${NORM_TYPE_LABEL[n.tipo]}` })),
  ];

  if (assembly.isLoading || !assembly.data) {
    return (
      <div className="page-enter">
        <Skeleton height={120} radius="md" mb="md" />
        <Skeleton height={300} radius="md" />
      </div>
    );
  }

  const a = assembly.data;
  const active = a.proposals.filter((p) => p.status === 'en_tramite');
  const history = a.proposals.filter((p) => p.status !== 'en_tramite');

  const submit = () => {
    switch (kind) {
      case 'norma_nueva':
        propose.mutate({ kind, payload: { tipo: normTipo, valor: normValor }, force });
        return;
      case 'derogar_norma':
        if (!derogarNormId) return;
        propose.mutate({ kind, payload: { normId: Number(derogarNormId) }, force });
        return;
      case 'cambio_reparto':
        propose.mutate({
          kind,
          payload: { pool: repartoPool, shares: repartoShares.split(',').map((s) => Number(s.trim())).filter((n) => !Number.isNaN(n)) },
          force,
        });
        return;
      case 'copa_recurrente':
        if (!cupName.trim() || cupParticipants.length < 2) return;
        propose.mutate({
          kind,
          payload: {
            name: cupName.trim(),
            tipo: 'copa',
            formato: 'eliminatoria',
            categoria: 'primer_equipo',
            participantTeamIds: cupParticipants.map(Number),
          },
          force,
        });
        return;
      case 'expansion_division':
        propose.mutate({ kind, payload: {}, force });
        return;
      case 'cambio_formato':
        propose.mutate({ kind, payload: { format: formatoChoice }, force });
        return;
      case 'admision_acelerada':
        if (!negotiationId) return;
        propose.mutate({ kind, payload: { negotiationId: Number(negotiationId) }, force });
    }
  };

  return (
    <div className="page-enter">
      <PageHero
        icon={IconGavel}
        iconColor="#8B5CF6"
        title="Asamblea de Clubes"
        subtitle="Las decisiones estructurales se votan. Un club, un voto."
        actions={
          <Badge size="lg" variant="light" color="grape" leftSection={<IconCoin size={14} />}>
            {a.politicalCapital} PC
          </Badge>
        }
      />

      <Paper p="md" mb="lg" style={{ border: '1px solid rgba(139,92,246,0.2)', borderLeft: '3px solid #8B5CF6' }}>
        <Text fw={700} mb="sm">Presentar propuesta</Text>
        <Stack gap="sm">
          <Select
            label="Tipo de propuesta"
            data={Object.entries(KIND_LABEL).map(([value, label]) => ({ value, label }))}
            value={kind}
            onChange={(v) => v && setKind(v as ProposalKind)}
          />

          {kind === 'norma_nueva' && (
            <Group grow>
              <Select
                label="Norma"
                data={Object.entries(NORM_TYPE_LABEL).map(([value, label]) => ({ value, label }))}
                value={normTipo}
                onChange={(v) => v && setNormTipo(v as NormType)}
              />
              <NumberInput label="Valor" value={normValor} onChange={(v) => setNormValor(Number(v) || 0)} min={0} />
            </Group>
          )}

          {kind === 'derogar_norma' && (
            <Select
              label="Norma a derogar"
              placeholder={norms.data?.norms.length ? 'Elige una norma' : 'No hay normas activas'}
              data={(norms.data?.norms ?? []).map((n) => ({ value: String(n.id), label: `${NORM_TYPE_LABEL[n.tipo]} (${n.valor})` }))}
              value={derogarNormId}
              onChange={setDerogarNormId}
              disabled={!norms.data?.norms.length}
            />
          )}

          {kind === 'cambio_reparto' && (
            <Group grow>
              <NumberInput label="Bolsa total (€)" value={repartoPool} onChange={(v) => setRepartoPool(Number(v) || 0)} min={0} />
              <TextInput label="Reparto (% separados por coma)" value={repartoShares} onChange={(e) => setRepartoShares(e.currentTarget.value)} />
            </Group>
          )}

          {kind === 'copa_recurrente' && (
            <Stack gap="sm">
              <TextInput label="Nombre de la copa" value={cupName} onChange={(e) => setCupName(e.currentTarget.value)} />
              <MultiSelect
                label="Participantes"
                placeholder="Elige al menos 2 equipos"
                data={(teams.data ?? []).map((t) => ({ value: String(t.id), label: t.name }))}
                value={cupParticipants}
                onChange={setCupParticipants}
                searchable
              />
            </Stack>
          )}

          {kind === 'expansion_division' && (
            <Text size="sm" c="dimmed">Se propondrá una expansión automática de divisiones (plan calculado por el motor).</Text>
          )}

          {kind === 'cambio_formato' && (
            <Select
              label="Formato de liga"
              data={[{ value: 'ida', label: 'Solo ida' }, { value: 'ida_vuelta', label: 'Ida y vuelta' }]}
              value={formatoChoice}
              onChange={(v) => v && setFormatoChoice(v as 'ida' | 'ida_vuelta')}
            />
          )}

          {kind === 'admision_acelerada' && (
            <Select
              label="Negociación"
              placeholder={negotiations.data?.length ? 'Elige una negociación' : 'No hay negociaciones activas'}
              data={(negotiations.data ?? [])
                .filter((n) => n.state === 'gathering_requirements' || n.state === 'accepted')
                .map((n) => ({ value: String(n.id), label: n.targetTeamName }))}
              value={negotiationId}
              onChange={setNegotiationId}
              disabled={!negotiations.data?.length}
            />
          )}

          <Group justify="space-between">
            <Button
              size="xs"
              variant={force ? 'filled' : 'subtle'}
              color="orange"
              onClick={() => setForce((f) => !f)}
            >
              {force ? '✓ ' : ''}Forzar tras rechazo (−4 PC)
            </Button>
            <Button leftSection={<IconGavel size={14} />} loading={propose.isPending} onClick={submit}>
              Presentar a la asamblea
            </Button>
          </Group>
        </Stack>
      </Paper>

      <Tabs defaultValue="active" variant="pills" mb="md">
        <Tabs.List mb="md">
          <Tabs.Tab value="active" leftSection={<IconGavel size={14} />}>Activas ({active.length})</Tabs.Tab>
          <Tabs.Tab value="history" leftSection={<IconHistory size={14} />}>Historial ({history.length})</Tabs.Tab>
          <Tabs.Tab value="pledges" leftSection={<IconUsers size={14} />}>Promesas ({a.pledges.length})</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="active">
          {active.length === 0 ? (
            <EmptyState icon={IconGavel} title="Sin propuestas activas" description="Presenta una propuesta arriba para abrir una votación." />
          ) : (
            <Stack gap="md">
              {active.map((p, i) => (
                <ProposalCard
                  key={p.id}
                  p={p}
                  index={i}
                  politicalCapital={a.politicalCapital}
                  pledgeChoices={pledgeChoices}
                  onReveal={(teamId) => reveal.mutate({ proposalId: p.id, teamId })}
                  onBuy={(teamId) => buy.mutate({ proposalId: p.id, teamId })}
                  onPledge={(teamId, choice) => pledge.mutate({ proposalId: p.id, teamId, choice })}
                  onWithdraw={() => withdraw.mutate(p.id)}
                  busy={withdraw.isPending}
                />
              ))}
            </Stack>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="history">
          {history.length === 0 ? (
            <EmptyState icon={IconHistory} title="Sin historial todavía" />
          ) : (
            <Stack gap="md">
              {history.map((p, i) => (
                <ProposalCard
                  key={p.id}
                  p={p}
                  index={i}
                  politicalCapital={a.politicalCapital}
                  pledgeChoices={[]}
                  onReveal={() => {}}
                  onBuy={() => {}}
                  onPledge={() => {}}
                />
              ))}
            </Stack>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="pledges">
          {a.pledges.length === 0 ? (
            <EmptyState icon={IconUsers} title="Libro de promesas vacío" />
          ) : (
            <Stack gap={6}>
              {a.pledges.map((pl) => (
                <Paper key={pl.id} p="sm" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
                  <Group justify="space-between">
                    <Group gap="xs">
                      <Text size="sm" fw={600}>{pl.teamName}</Text>
                      <Text size="xs" c="dimmed">{pl.kind} · desde {pl.madeYear}, vence {pl.deadlineYear}</Text>
                    </Group>
                    <Badge
                      size="xs"
                      leftSection={pl.status === 'cumplida' ? <IconCheck size={10} /> : pl.status === 'rota' ? <IconX size={10} /> : undefined}
                      color={pl.status === 'cumplida' ? 'green' : pl.status === 'rota' ? 'red' : 'blue'}
                    >
                      {pl.status}
                    </Badge>
                  </Group>
                </Paper>
              ))}
            </Stack>
          )}
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}
