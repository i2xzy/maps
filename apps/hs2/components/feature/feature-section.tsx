import { Box, GridItem, Heading, SimpleGrid } from '@chakra-ui/react';
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
        {stats.map(({ label, value, helpText }, i) => (
          <GridItem
            key={label}
            colSpan={{ base: stats.length === 3 && i === 0 ? 2 : 1, md: 1 }}
          >
            <StatCard label={label} value={value || 0} helpText={helpText} />
          </GridItem>
        ))}
      </SimpleGrid>
    </Box>
  );
}
