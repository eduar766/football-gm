import { Badge, type BadgeProps } from '@mantine/core';

const COLOR_MAP: Record<string, BadgeProps['color']> = {
  green: 'accent',
  gold: 'gold',
  red: 'red',
  blue: 'blue',
  purple: 'violet',
  gray: 'gray',
  white: 'gray',
};

export function StatusPill({
  color = 'green',
  label,
  ...props
}: {
  color?: string;
  label: string;
} & Omit<BadgeProps, 'color' | 'children'>) {
  return (
    <Badge
      size="sm"
      variant="light"
      color={COLOR_MAP[color] ?? color}
      {...props}
    >
      {label}
    </Badge>
  );
}
