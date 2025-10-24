import Link from 'next/link';
import { Card, Heading, Stack } from '@chakra-ui/react';
import { Text } from '@chakra-ui/react';

interface PlansListProps {
  region: string;
  plans:
    | {
        id: string;
        name: string;
        description: string | null;
      }[]
    | null;
}
const PlansList = ({ region, plans }: PlansListProps) => {
  return (
    <Stack gap={6}>
      <Heading as='h2'>Documents ({plans?.length || 0})</Heading>
      {plans?.map(plan => (
        <Link href={`/route/${region}/${plan.id}`} key={plan.id}>
          <Card.Root size={{ base: 'sm', md: 'md' }}>
            <Card.Body gap='2'>
              <Card.Title color='blue.400'>{plan.name}</Card.Title>
              <Text fontSize='sm' color='fg.muted'>
                {plan.description}
              </Text>
            </Card.Body>
          </Card.Root>
        </Link>
      ))}
    </Stack>
  );
};

export default PlansList;
