import { Card, Stat } from '@chakra-ui/react';

interface StatCardProps {
  label: string;
  value: number | string;
  helpText?: string;
}

export default function StatCard({ label, value, helpText }: StatCardProps) {
  return (
    <Card.Root h='full' size={{ base: 'sm', md: 'md' }}>
      <Card.Body>
        <Stat.Root>
          <Stat.ValueText>{value}</Stat.ValueText>
          <Stat.Label>{label}</Stat.Label>
          {helpText && <Stat.HelpText hideBelow='md'>{helpText}</Stat.HelpText>}
        </Stat.Root>
      </Card.Body>
    </Card.Root>
  );
}
