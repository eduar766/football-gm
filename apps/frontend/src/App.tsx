import { Anchor, Box, Group } from '@mantine/core';
import { Link, Outlet } from '@tanstack/react-router';

export function RootLayout() {
  return (
    <>
      <Box
        px="md"
        py="xs"
        style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}
      >
        <Group>
          <Anchor component={Link} to="/" fw={700}>
            Football GM
          </Anchor>
        </Group>
      </Box>
      <Outlet />
    </>
  );
}
