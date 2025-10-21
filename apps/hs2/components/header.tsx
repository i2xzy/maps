'use client';

import { Box, chakra, Container, HStack, Spacer } from '@chakra-ui/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { ColorModeButton } from '@ui/components/color-mode';
import { Logo } from '@ui/components/logo';

const HeaderRoot = chakra('header', {
  base: {
    bg: 'bg',
    position: 'sticky',
    top: '0',
    display: 'flex',
    justifyContent: 'center',
    width: '100%',
    minHeight: '64px',
    borderBottom: '1px solid',
    borderColor: 'border.muted',
    zIndex: '10',
  },
});

const TopNavLink = chakra(Link, {
  base: {
    fontSize: 'sm',
    color: 'fg.muted',
    _currentPage: {
      color: 'fg',
      fontWeight: 'medium',
    },
    _hover: {
      color: 'fg',
    },
  },
});

const items = [
  { title: 'Map', url: '/map' },
  { title: 'Structures', url: '/structures' },
  { title: 'News', url: '/news' },
  { title: 'About', url: '/about' },
];

const Header = ({ children }: { children?: React.ReactNode }) => {
  const currentUrl = usePathname();

  return (
    <HeaderRoot>
      <Container>
        <Box hideBelow='md'>
          <HStack py='2'>
            <HStack gap='8' minH='48px' aria-label='primary navigation'>
              <Link href='/' aria-label='Chakra UI, Back to homepage'>
                <Logo />
              </Link>
              {items.map(item => (
                <TopNavLink
                  key={item.title}
                  href={item.url || '#'}
                  aria-current={
                    currentUrl.startsWith(item.url) ? 'page' : undefined
                  }
                >
                  {item.title}
                </TopNavLink>
              ))}
            </HStack>
            <Spacer />
            <HStack gap='2' minH='48px' flexShrink='1' minW='0'>
              {children}
              <ColorModeButton />
            </HStack>
          </HStack>
        </Box>
      </Container>
    </HeaderRoot>
  );
};

export default Header;
