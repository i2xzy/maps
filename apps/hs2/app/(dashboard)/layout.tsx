import { Container, SkipNavContent, SkipNavLink } from '@chakra-ui/react';
import Header from '@/components/header';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <SkipNavLink>Skip to Content</SkipNavLink>
      <Header />
      <main>
        <Container display='flex'>
          <SkipNavContent />
          {children}
        </Container>
      </main>
    </>
  );
}
