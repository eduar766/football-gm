import { Component, type ReactNode } from 'react';
import { Box, Button, Code, Group, Paper, Text, Title } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  override render() {
    if (this.state.hasError) {
      return (
        <Box p="xl">
          <Paper withBorder p="xl" maw={600} mx="auto" ta="center">
            <IconAlertTriangle size={48} color="var(--mantine-color-yellow-6)" />
            <Title order={3} mt="md">
              Algo salió mal
            </Title>
            <Text c="dimmed" mt="sm">
              Ha ocurrido un error inesperado. Puedes recargar la página para intentar de nuevo.
            </Text>
            {this.state.error && (
              <Code block mt="md" ta="left" style={{ whiteSpace: 'pre-wrap' }}>
                {this.state.error.message}
              </Code>
            )}
            <Group justify="center" mt="xl">
              <Button onClick={() => window.location.reload()}>Recargar página</Button>
              <Button variant="light" onClick={() => this.setState({ hasError: false, error: null })}>
                Intentar de nuevo
              </Button>
            </Group>
          </Paper>
        </Box>
      );
    }

    return this.props.children;
  }
}
