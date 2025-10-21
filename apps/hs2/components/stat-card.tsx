import { Card, Stat } from '@chakra-ui/react';

interface StatCardProps {
  label: string;
  value: number | string;
  helpText?: string;
}

export default function StatCard({ label, value, helpText }: StatCardProps) {
  return (
    <Card.Root>
      <Card.Body>
        <Stat.Root>
          <Stat.ValueText>{value}</Stat.ValueText>
          <Stat.Label>{label}</Stat.Label>
          {helpText && <Stat.HelpText>{helpText}</Stat.HelpText>}
        </Stat.Root>
      </Card.Body>
    </Card.Root>
  );
}
