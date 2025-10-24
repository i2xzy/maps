import { Container } from '@chakra-ui/react';

export default function RouteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Container maxW='5xl' py={8}>
      {children}
    </Container>
  );
}
