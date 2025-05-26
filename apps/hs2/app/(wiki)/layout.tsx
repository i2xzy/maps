import { Container, SkipNavContent, SkipNavLink } from '@chakra-ui/react';
import { Header } from './header';

export default function Layout({ children }: { children: React.ReactNode }) {
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
