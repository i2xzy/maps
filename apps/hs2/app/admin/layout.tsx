import { Button, Container, Flex, HStack, Heading, Link, Text } from '@chakra-ui/react';

import { requireAdmin } from '@/lib/admin';
import { signOut } from '../sign-in/actions';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireAdmin();

  return (
    <Flex direction='column' minH='100vh'>
      <Flex
        as='header'
        align='center'
        justify='space-between'
        px={6}
        py={3}
        borderBottomWidth='1px'
      >
        <HStack gap={4}>
          <Heading size='md'>Admin</Heading>
          <Link href='/' fontSize='sm' color='fg.muted'>
            View site
          </Link>
        </HStack>
        <HStack gap={4}>
          <Text fontSize='sm' color='fg.muted'>
            {user.email}
          </Text>
          <form action={signOut}>
            <Button type='submit' size='sm' variant='outline'>
              Sign out
            </Button>
          </form>
        </HStack>
      </Flex>
      <Container maxW='7xl' py={8} flex='1'>
        {children}
      </Container>
    </Flex>
  );
}
