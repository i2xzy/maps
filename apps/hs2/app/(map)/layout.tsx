import { Flex, Box, SkipNavContent, SkipNavLink } from '@chakra-ui/react';
import Header from '@/components/header';

/**
 * Full-bleed layout for the map workspace. Unlike the (dashboard) layout, the
 * map has no centered Container — it fills the viewport below the sticky
 * header so controls can float over a full-height map (Google My Maps style).
 */
export default function MapLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Flex direction='column' h='100dvh' overflow='hidden'>
      <SkipNavLink>Skip to Content</SkipNavLink>
      <Header />
      <Box as='main' flex='1' position='relative' minH='0'>
        <SkipNavContent />
        {children}
      </Box>
    </Flex>
  );
}
