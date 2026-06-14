import type { SystemStyleObject } from '@chakra-ui/react';

/**
 * Thin, subtle, theme-aware scrollbar for the map's floating panels — replaces
 * the chunky native scrollbar. `scrollbar-width/color` covers modern Chrome,
 * Edge, Firefox and Safari; the `::-webkit-scrollbar` rules are a fallback for
 * older WebKit. The thumb only appears when there's overflow.
 */
export const thinScrollbar: SystemStyleObject = {
  scrollbarWidth: 'thin',
  scrollbarColor: 'var(--chakra-colors-border-emphasized) transparent',
  '&::-webkit-scrollbar': { width: '6px', height: '6px' },
  '&::-webkit-scrollbar-track': { background: 'transparent' },
  '&::-webkit-scrollbar-thumb': {
    background: 'var(--chakra-colors-border-emphasized)',
    borderRadius: '9999px',
  },
  '&::-webkit-scrollbar-thumb:hover': {
    background: 'var(--chakra-colors-fg-muted)',
  },
};
