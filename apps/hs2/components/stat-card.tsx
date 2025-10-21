import { Card, Stat } from '@chakra-ui/react';

interface StatCardProps {
  label: string;
  value: number | string;
}

export default function StatCard({ label, value }: StatCardProps) {
  return (
    <Card.Root>
      <Card.Body>
        <Stat.Root>
          <Stat.ValueText>{value}</Stat.ValueText>
          <Stat.Label>{label}</Stat.Label>
        </Stat.Root>
      </Card.Body>
    </Card.Root>
  );
}
