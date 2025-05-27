'use client';

import {
  Box,
  Center,
  chakra,
  Combobox,
  Container,
  HStack,
  Spacer,
  Span,
  Spinner,
  Text,
  useListCollection,
} from '@chakra-ui/react';
import { useState } from 'react';
import { useAsync } from 'react-use';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

import { createClient } from '@supabase/client';
import { FeatureSearchResult } from '@supabase/types';
import { ColorModeButton } from '@ui/components/color-mode';
import { Logo } from '@ui/components/logo';
import CommandMenu from '@ui/components/command-menu';
import { FeatureIcon } from '@ui/components/feature-icon';

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
  variants: {
    variant: {
      tab: {
        py: '2',
        borderBottomWidth: '2px',
        borderColor: 'transparent',
        transition: 'border-color 0.2s',
        _hover: { borderColor: 'border' },
        _currentPage: { borderColor: 'teal.solid!' },
      },
    },
  },
});

const items = [
  { title: 'Map', url: '/map' },
  { title: 'Wiki', url: '/wiki' },
  { title: 'About', url: '/about' },
];

export const Header = () => {
  const currentUrl = usePathname();
  const router = useRouter();
  const [inputValue, setInputValue] = useState('');

  const { collection, set } = useListCollection<FeatureSearchResult>({
    initialItems: [],
    itemToString: item => item.name,
    itemToValue: item => item.id,
  });

  const state = useAsync(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('features')
      .select('id, name, type')
      .ilike('name', `%${inputValue}%`)
      .order('name', { ascending: true });
    set(data || []);
  }, [inputValue, set]);

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
              <CommandMenu
                collection={collection}
                onOpenChange={open => {
                  if (!open) set([]);
                }}
                onValueChange={value => {
                  router.push(`/feature/${value}`);
                  set([]);
                }}
                onInputValueChange={setInputValue}
              >
                {state.loading && collection.items?.length === 0 && (
                  <Center p='3' h='100%'>
                    <HStack p='2'>
                      <Spinner size='xs' borderWidth='1px' />
                      <Span>Loading...</Span>
                    </HStack>
                  </Center>
                )}
                {!state.loading &&
                  inputValue &&
                  collection.items?.length === 0 && (
                    <Center p='3' h='100%'>
                      <Text color='fg.muted' textStyle='sm'>
                        No results found for{' '}
                        <Text as='strong'>{inputValue}</Text>
                      </Text>
                    </Center>
                  )}

                {collection.items?.map(item => (
                  <Combobox.Item
                    key={item.name}
                    item={item}
                    persistFocus
                    height='auto'
                    px='4'
                    py='3'
                  >
                    <HStack>
                      <FeatureIcon feature={item} />
                      <Text fontWeight='medium'>{item.name}</Text>
                    </HStack>
                  </Combobox.Item>
                ))}
              </CommandMenu>
              <ColorModeButton />
            </HStack>
          </HStack>
          {/* <HeaderSecondaryNavbar /> */}
        </Box>
      </Container>
    </HeaderRoot>
  );
};
