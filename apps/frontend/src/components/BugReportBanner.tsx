import { ActionIcon, Group, Tooltip } from '@mantine/core';
import { IconBug, IconBulb } from '@tabler/icons-react';

const REPO = 'eduar766/football-gm';
const BUG_URL = `https://github.com/${REPO}/issues/new?labels=bug&template=bug_report.md`;
const IDEA_URL = `https://github.com/${REPO}/issues/new?labels=enhancement&template=feature_request.md`;

export function BugReportBanner() {
  return (
    <Group
      gap={6}
      style={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        zIndex: 200,
      }}
    >
      <Tooltip label="Reportar un bug" position="top" withArrow>
        <ActionIcon
          component="a"
          href={BUG_URL}
          target="_blank"
          rel="noopener noreferrer"
          size="lg"
          variant="filled"
          color="red"
          radius="xl"
          aria-label="Reportar bug"
        >
          <IconBug size={18} />
        </ActionIcon>
      </Tooltip>
      <Tooltip label="Sugerir una mejora" position="top" withArrow>
        <ActionIcon
          component="a"
          href={IDEA_URL}
          target="_blank"
          rel="noopener noreferrer"
          size="lg"
          variant="filled"
          color="violet"
          radius="xl"
          aria-label="Sugerir mejora"
        >
          <IconBulb size={18} />
        </ActionIcon>
      </Tooltip>
    </Group>
  );
}
