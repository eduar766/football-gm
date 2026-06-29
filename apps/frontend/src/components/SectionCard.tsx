import { Box, Paper, Text, type BoxProps } from '@mantine/core';

export function SectionCard({
  title,
  children,
  ...props
}: {
  title: string;
  children: React.ReactNode;
} & Omit<BoxProps, 'title' | 'children'>) {
  return (
    <Paper withBorder p="md">
      <Text fw={700} mb="sm">
        {title}
      </Text>
      <Box {...props}>{children}</Box>
    </Paper>
  );
}
