import { Text, Title } from '@mantine/core';

export function SectionTitle({
  title,
  subtitle,
  order = 3,
}: {
  title: string;
  subtitle?: string;
  order?: 3 | 4;
}) {
  return (
    <div>
      <Title order={order} fw={500}>
        {title}
      </Title>
      {subtitle ? (
        <Text size="md" c="dimmed" mt={4}>
          {subtitle}
        </Text>
      ) : null}
    </div>
  );
}
