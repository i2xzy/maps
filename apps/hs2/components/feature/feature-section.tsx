import { Box, Heading, SimpleGrid } from '@chakra-ui/react';
import StatCard from '../stat-card';

interface FeatureSectionProps {
  title?: string;
  stats: Array<{ label: string; value?: string | number; helpText?: string }>;
}

export default function FeatureSection({ title, stats }: FeatureSectionProps) {
  return (
    <Box>
      {title && (
        <Heading as='h3' size='lg' mb={6} textAlign='center'>
          {title}
        </Heading>
      )}
      <SimpleGrid columns={{ base: 2, md: 3, lg: 4 }} gap={4}>
        {stats.map(({ label, value, helpText }) => (
          <StatCard
            key={label}
            label={label}
            value={value || 0}
            helpText={helpText}
          />
        ))}
      </SimpleGrid>
    </Box>
  );
}
