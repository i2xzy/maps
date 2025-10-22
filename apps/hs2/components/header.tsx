'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Box,
  chakra,
  Container,
  Drawer,
  HStack,
  IconButton,
  Spacer,
  VStack,
} from '@chakra-ui/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LuMenu, LuX } from 'react-icons/lu';

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

const TopNavMobileLink = chakra(Link, {
  base: {
    display: 'block',
    py: '2',
    px: '4',
    color: 'fg.muted',
    w: 'full',
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

const HeaderMobileMenuDropdown = () => {
  const [isOpen, setIsOpen] = useState(false);

  const pathname = usePathname();
  const pathnameRef = useRef(pathname);

  useEffect(() => {
    if (pathnameRef.current !== pathname) {
      setIsOpen(false);
    }
    pathnameRef.current = pathname;
  }, [pathname, setIsOpen]);

  return (
    <Drawer.Root open={isOpen} onOpenChange={e => setIsOpen(e.open)}>
      <Drawer.Backdrop />
      <Drawer.Trigger asChild>
        <IconButton variant='ghost' size='sm'>
          <LuMenu />
        </IconButton>
      </Drawer.Trigger>
      <Drawer.Positioner>
        <Drawer.Content borderTopRadius='md' maxH='var(--content-height)'>
          <Drawer.CloseTrigger asChild>
            <IconButton size='sm' variant='ghost'>
              <LuX />
            </IconButton>
          </Drawer.CloseTrigger>
          <Drawer.Body display='flex' flexDir='column' gap='10' py='5' flex='1'>
            <VStack align='start' justify='stretch'>
              {items.map(item => (
                <TopNavMobileLink
                  key={item.title}
                  href={item.url || '#'}
                  aria-current={
                    pathname.startsWith(item.url) ? 'page' : undefined
                  }
                >
                  {item.title}
                </TopNavMobileLink>
              ))}
            </VStack>
          </Drawer.Body>
        </Drawer.Content>
      </Drawer.Positioner>
    </Drawer.Root>
  );
};

const Header = ({ children }: { children?: React.ReactNode }) => {
  const currentUrl = usePathname();

  return (
    <HeaderRoot>
      <Container>
        <HStack py='2'>
          <HStack gap='8' minH='48px'>
            <Link href='/' aria-label='Chakra UI, Back to homepage'>
              <Logo />
            </Link>
            <HStack gap='6' aria-label='primary navigation' hideBelow='md'>
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
          </HStack>
          <Spacer />
          <HStack gap='2' minH='48px' flexShrink='1' minW='0'>
            {children}
            <ColorModeButton size='sm' />
            <Box hideFrom='md'>
              <HeaderMobileMenuDropdown />
            </Box>
          </HStack>
        </HStack>
      </Container>
    </HeaderRoot>
  );
};

export default Header;
