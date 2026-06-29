import { useState } from 'react';
import { Alert, Text } from '@mantine/core';
import { IconDownload } from '@tabler/icons-react';

const DISMISSED_KEY = 'fgm_export_reminder_dismissed';
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function isDismissed(): boolean {
  const raw = localStorage.getItem(DISMISSED_KEY);
  if (!raw) return false;
  const ts = Number(raw);
  return Date.now() - ts < DISMISS_DURATION_MS;
}

interface Props {
  hasGames: boolean;
}

export function ExportReminderBanner({ hasGames }: Props) {
  const [visible, setVisible] = useState(() => hasGames && !isDismissed());

  if (!visible) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    setVisible(false);
  };

  return (
    <Alert
      icon={<IconDownload size={16} />}
      color="yellow"
      variant="light"
      withCloseButton
      closeButtonLabel="Cerrar"
      onClose={dismiss}
      styles={{ closeButton: { color: 'var(--mantine-color-yellow-6)' } }}
    >
      <Text size="sm">
        Recuerda exportar tus partidas regularmente — estamos en beta y puede haber resets
        de datos.
      </Text>
    </Alert>
  );
}
