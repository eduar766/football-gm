import { Box, Group, Text } from '@mantine/core';
import type { CupMatchDto } from '@football-gm/contracts';

interface BracketRound {
  label: string;
  matches: CupMatchDto[];
}

interface BracketViewProps {
  rounds: BracketRound[];
  championTeamName?: string | null;
}

const SLOT_H = 80;
const COL_W = 210;
const CONN_W = 36;

function getCenter(roundIdx: number, matchIdx: number, maxSlots: number): number {
  const scale = maxSlots / Math.pow(2, roundIdx);
  return (matchIdx * scale + scale / 2) * SLOT_H;
}

function MatchCard({ match, isChampion }: { match: CupMatchDto; isChampion?: boolean }) {
  const isBye = match.homeTeamName === 'BYE' || match.awayTeamName === 'BYE';
  if (isBye) return null;

  const homeWin = match.played && match.winnerTeamId === match.homeTeamId;
  const awayWin = match.played && match.winnerTeamId === match.awayTeamId;

  return (
    <Box
      style={{
        background: isChampion
          ? 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(245,158,11,0.05))'
          : 'rgba(255,255,255,0.04)',
        border: isChampion
          ? '1px solid rgba(245,158,11,0.4)'
          : '1px solid rgba(255,255,255,0.08)',
        borderRadius: 6,
        padding: '6px 10px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        transition: 'border-color 0.15s, background 0.15s',
      }}
    >
      {/* Home */}
      <Group gap={4} justify="flex-end" wrap="nowrap">
        <Text
          size="xs"
          fw={homeWin ? 700 : 400}
          ta="right"
          truncate="end"
          style={{
            flex: 1,
            color: homeWin ? '#F9FAFB' : awayWin ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.7)',
          }}
        >
          {match.homeTeamName}
        </Text>
        {match.played && (
          <Text fw={800} size="xs" style={{ fontFamily: 'var(--mantine-font-family-monospace)', minWidth: 16, textAlign: 'center', color: homeWin ? '#F59E0B' : '#F9FAFB' }}>
            {match.homeGoals}
          </Text>
        )}
      </Group>

      {/* Separator */}
      <Box style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '3px 0' }} />

      {/* Away */}
      <Group gap={4} justify="flex-end" wrap="nowrap">
        <Text
          size="xs"
          fw={awayWin ? 700 : 400}
          ta="right"
          truncate="end"
          style={{
            flex: 1,
            color: awayWin ? '#F9FAFB' : homeWin ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.7)',
          }}
        >
          {match.awayTeamName}
        </Text>
        {match.played && (
          <Text fw={800} size="xs" style={{ fontFamily: 'var(--mantine-font-family-monospace)', minWidth: 16, textAlign: 'center', color: awayWin ? '#F59E0B' : '#F9FAFB' }}>
            {match.awayGoals}
          </Text>
        )}
      </Group>
    </Box>
  );
}

export function BracketView({ rounds, championTeamName }: BracketViewProps) {
  const cleanRounds = rounds
    .map((r) => ({
      ...r,
      matches: r.matches.filter(
        (m) => m.homeTeamName !== 'BYE' && m.awayTeamName !== 'BYE',
      ),
    }))
    .filter((r) => r.matches.length > 0);

  if (cleanRounds.length === 0) {
    return (
      <Text c="dimmed" size="sm" ta="center" py="md">
        Sin partidos para mostrar.
      </Text>
    );
  }

  const maxSlots = cleanRounds[0].matches.length;
  const totalHeight = maxSlots * SLOT_H;
  const totalWidth = cleanRounds.length * (COL_W + CONN_W) - CONN_W;

  return (
    <div
      style={{
        overflowX: 'auto',
        overflowY: 'hidden',
        paddingBottom: 8,
      }}
    >
      <div
        style={{
          position: 'relative',
          width: Math.max(totalWidth, 300),
          height: totalHeight + 32,
          minWidth: totalWidth,
        }}
      >
        {/* SVG connectors */}
        <svg
          style={{
            position: 'absolute',
            top: 16,
            left: 0,
            width: '100%',
            height: totalHeight,
            pointerEvents: 'none',
          }}
        >
          {cleanRounds.slice(0, -1).map((_, ri) => {
            const nextRound = cleanRounds[ri + 1];
            if (!nextRound) return null;
            return nextRound.matches.map((_, mi) => {
              const feeder1Center = getCenter(ri, mi * 2, maxSlots);
              const feeder2Center = getCenter(ri, mi * 2 + 1, maxSlots);
              const nextCenter = getCenter(ri + 1, mi, maxSlots);

              const feederX = ri * (COL_W + CONN_W) + COL_W;
              const nextX = (ri + 1) * (COL_W + CONN_W);
              const midX = feederX + CONN_W / 2;

              return (
                <g key={`conn-${ri}-${mi}`}>
                  {/* Top feeder → midpoint */}
                  <line
                    x1={feederX}
                    y1={feeder1Center}
                    x2={midX}
                    y2={feeder1Center}
                    stroke="rgba(255,255,255,0.1)"
                    strokeWidth={1.5}
                  />
                  {/* Bottom feeder → midpoint */}
                  <line
                    x1={feederX}
                    y1={feeder2Center}
                    x2={midX}
                    y2={feeder2Center}
                    stroke="rgba(255,255,255,0.1)"
                    strokeWidth={1.5}
                  />
                  {/* Vertical line */}
                  <line
                    x1={midX}
                    y1={feeder1Center}
                    x2={midX}
                    y2={feeder2Center}
                    stroke="rgba(255,255,255,0.1)"
                    strokeWidth={1.5}
                  />
                  {/* Midpoint → next match */}
                  <line
                    x1={midX}
                    y1={nextCenter}
                    x2={nextX}
                    y2={nextCenter}
                    stroke="rgba(255,255,255,0.1)"
                    strokeWidth={1.5}
                  />
                </g>
              );
            });
          })}
        </svg>

        {/* Round columns */}
        {cleanRounds.map((round, ri) => (
          <div
            key={ri}
            style={{
              position: 'absolute',
              left: ri * (COL_W + CONN_W),
              top: 16,
              width: COL_W,
              height: totalHeight,
            }}
          >
            {/* Round label */}
            <div
              style={{
                position: 'absolute',
                top: -14,
                left: 0,
                width: COL_W,
                textAlign: 'center',
              }}
            >
              <Text
                size="xs"
                fw={600}
                c="dimmed"
                tt="uppercase"
                style={{ letterSpacing: '0.05em', fontSize: '10px' }}
              >
                {round.label}
              </Text>
            </div>

            {/* Matches */}
            {round.matches.map((match, mi) => {
              const center = getCenter(ri, mi, maxSlots);
                  const isChampion = Boolean(
                    championTeamName &&
                    match.played &&
                    match.winnerTeamId !== null &&
                    (match.winnerTeamId === match.homeTeamId
                      ? match.homeTeamName
                      : match.awayTeamName) === championTeamName
                  );

              return (
                <div
                  key={mi}
                  style={{
                    position: 'absolute',
                    top: center - SLOT_H / 2,
                    left: 0,
                    width: COL_W,
                    height: SLOT_H - 8,
                  }}
                >
                  <MatchCard match={match} isChampion={isChampion} />
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
