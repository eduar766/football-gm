import { Box, Group, Text } from '@mantine/core';
import type { TablerIcon } from '@tabler/icons-react';

interface PageHeroProps {
  icon: TablerIcon;
  iconColor?: string;
  title: string;
  subtitle?: React.ReactNode;
  /** Optional mono eyebrow label above the title (HUD context line). */
  eyebrow?: string;
  /** Optional right-aligned slot for actions / stat readouts. */
  actions?: React.ReactNode;
}

export function PageHero({
  icon: Icon,
  iconColor = '#10B981',
  title,
  subtitle,
  eyebrow,
  actions,
}: PageHeroProps) {
  return (
    <Box
      className="page-enter"
      mb="lg"
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 16,
        padding: '26px 28px',
        background:
          'linear-gradient(135deg, var(--surface-1) 0%, #0c141a 55%, #0b1512 100%)',
        border: '1px solid var(--border-1)',
        boxShadow: 'var(--panel-shadow)',
      }}
    >
      {/* Accent bloom */}
      <Box
        aria-hidden
        style={{
          position: 'absolute',
          top: -80,
          left: -40,
          width: 340,
          height: 220,
          background: `radial-gradient(circle, ${iconColor}22 0%, transparent 70%)`,
          pointerEvents: 'none',
        }}
      />
      {/* Left accent bar */}
      <Box
        aria-hidden
        style={{
          position: 'absolute',
          left: 0,
          top: 18,
          bottom: 18,
          width: 3,
          borderRadius: 3,
          background: `linear-gradient(${iconColor}, transparent)`,
        }}
      />
      <Group justify="space-between" align="center" wrap="nowrap" style={{ position: 'relative' }}>
        <Group gap="md" wrap="nowrap" align="center">
          <Box
            style={{
              width: 52,
              height: 52,
              flexShrink: 0,
              borderRadius: 14,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: `${iconColor}18`,
              border: `1px solid ${iconColor}40`,
              boxShadow: `0 0 24px -8px ${iconColor}70`,
            }}
          >
            <Icon size={26} color={iconColor} stroke={1.8} />
          </Box>
          <div>
            {eyebrow && (
              <Text component="div" className="hud-eyebrow" mb={4}>
                {eyebrow}
              </Text>
            )}
            <Text
              component="h1"
              style={{
                margin: 0,
                fontFamily: 'var(--font-display)',
                fontSize: '30px',
                fontWeight: 700,
                lineHeight: 1.05,
                letterSpacing: '-0.01em',
                color: '#F4F7FA',
              }}
            >
              {title}
            </Text>
            {subtitle && (
              <Text size="sm" c="dimmed" mt={6} style={{ maxWidth: 620 }}>
                {subtitle}
              </Text>
            )}
          </div>
        </Group>
        {actions && <Box style={{ flexShrink: 0 }}>{actions}</Box>}
      </Group>
    </Box>
  );
}
