import { Anchor, Box, Group } from '@mantine/core';
import { Link, Outlet } from '@tanstack/react-router';
import { IconTrophy } from '@tabler/icons-react';

export function RootLayout() {
  return (
    <>
      <Box
        px="md"
        py="xs"
        style={{
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          backgroundColor: '#0B0F14',
        }}
      >
        <Group gap="sm">
          <Anchor
            component={Link}
            to="/"
            fw={800}
            style={{
              fontFamily: '"Plus Jakarta Sans", sans-serif',
              fontSize: '18px',
              color: '#F0F2F5',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <IconTrophy size={20} color="#10B981" />
            FOOTBALL GM
          </Anchor>
        </Group>
      </Box>
      <Box className="page-enter">
        <Outlet />
      </Box>
    </>
  );
}
