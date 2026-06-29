import { Badge, Box, List, Modal, Stack, Text, Title } from '@mantine/core';
import { CHANGELOG } from '../changelog';

interface Props {
  opened: boolean;
  onClose: () => void;
}

export function ChangelogModal({ opened, onClose }: Props) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Novedades"
      centered
      size="md"
    >
      <Stack gap="lg">
        {CHANGELOG.map((entry) => (
          <Box key={entry.version}>
            <Box mb="xs">
              <Badge color="teal" variant="light" size="sm" mr="xs">
                {entry.version}
              </Badge>
              <Text size="xs" c="dimmed" component="span">
                {entry.date}
              </Text>
            </Box>
            <List size="sm" spacing={4}>
              {entry.changes.map((change) => (
                <List.Item key={change}>
                  <Title order={6} fw={400}>{change}</Title>
                </List.Item>
              ))}
            </List>
          </Box>
        ))}
      </Stack>
    </Modal>
  );
}
