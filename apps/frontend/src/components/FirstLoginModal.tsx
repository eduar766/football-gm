import { useState } from 'react';
import {
  Box,
  Button,
  Group,
  Modal,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import {
  IconBug,
  IconDownload,
  IconTrophy,
  IconWorld,
} from '@tabler/icons-react';

const ONBOARDING_KEY = 'fgm_onboarding_done';

export function useOnboardingModal() {
  const isDone = localStorage.getItem(ONBOARDING_KEY) === 'true';
  const [opened, setOpened] = useState(!isDone);

  const close = () => {
    localStorage.setItem(ONBOARDING_KEY, 'true');
    setOpened(false);
  };

  return { opened, close };
}

const SLIDES = [
  {
    icon: <IconTrophy size={40} color="#10B981" />,
    title: 'Bienvenido a Football GM Beta',
    body: [
      'Eres el comisionado, no el entrenador ni el jugador.',
      'Tu trabajo es hacer crecer la liga: atraer equipos, organizar competiciones, gestionar la economía y mantener el orden.',
      'Los equipos son autónomos — tú pones las reglas, ellos juegan.',
    ],
  },
  {
    icon: <IconWorld size={40} color="#3B82F6" />,
    title: 'Cómo empezar',
    body: [
      'Arranca la pretemporada con "Iniciar temporada" en el panel de Resumen.',
      'Avanza jornada a jornada o usa "Avanzar temporada" para simular de golpe.',
      'Usa impulsos para influir en partidos clave — son limitados por temporada.',
      'Negocia con equipos de otras ligas para hacerlos federados a la tuya.',
    ],
  },
  {
    icon: <IconBug size={40} color="#EF4444" />,
    title: 'Estamos en beta',
    body: [
      'Puedes encontrar bugs — usa el botón rojo 🐛 (esquina inferior derecha) para reportarlos directamente en GitHub.',
      'Exporta tu partida regularmente desde "Mis partidas" por si hay que hacer un reseteo.',
      'Tu feedback construye el juego. Gracias por estar aquí.',
    ],
  },
];

interface Props {
  opened: boolean;
  onClose: () => void;
}

export function FirstLoginModal({ opened, onClose }: Props) {
  const [step, setStep] = useState(0);
  const slide = SLIDES[step];
  const isLast = step === SLIDES.length - 1;

  const handleClose = () => {
    setStep(0);
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      centered
      size="md"
      withCloseButton={false}
    >
      <Stack gap="lg" p="sm">
        <Box ta="center">
          {slide.icon}
          <Title order={3} mt="md" mb="xs">
            {slide.title}
          </Title>
          <Stack gap={8}>
            {slide.body.map((line) => (
              <Text key={line} size="sm" c="dimmed">
                {line}
              </Text>
            ))}
          </Stack>
        </Box>

        {/* Step dots */}
        <Group justify="center" gap={6}>
          {SLIDES.map((_, i) => (
            <Box
              key={i}
              style={{
                width: i === step ? 20 : 8,
                height: 8,
                borderRadius: 4,
                background: i === step ? '#10B981' : 'rgba(255,255,255,0.2)',
                transition: 'width 0.2s, background 0.2s',
              }}
            />
          ))}
        </Group>

        <Group justify="space-between">
          <Button
            variant="subtle"
            color="gray"
            size="sm"
            disabled={step === 0}
            onClick={() => setStep((s) => s - 1)}
          >
            ← Anterior
          </Button>
          {isLast ? (
            <Button
              variant="gradient"
              gradient={{ from: '#10B981', to: '#059669' }}
              size="sm"
              leftSection={<IconDownload size={14} />}
              onClick={handleClose}
            >
              Empezar a jugar
            </Button>
          ) : (
            <Button
              variant="gradient"
              gradient={{ from: '#10B981', to: '#059669' }}
              size="sm"
              onClick={() => setStep((s) => s + 1)}
            >
              Siguiente →
            </Button>
          )}
        </Group>
      </Stack>
    </Modal>
  );
}
