'use client';

import {
  ChakraProvider,
  createSystem,
  defaultConfig,
  defineConfig,
  defineSlotRecipe,
} from '@chakra-ui/react';
import { ColorModeProvider, type ColorModeProviderProps } from './color-mode';

const cardRecipe = defineSlotRecipe({
  slots: ['root'],
  variants: {
    variant: {
      subtle: {},
    },
  },
  defaultVariants: {
    variant: 'subtle',
  },
});

const config = defineConfig({
  theme: {
    slotRecipes: {
      card: cardRecipe,
    },
  },
});

const system = createSystem(defaultConfig, config);

export function Provider(props: ColorModeProviderProps) {
  return (
    <ChakraProvider value={system}>
      <ColorModeProvider {...props} />
    </ChakraProvider>
  );
}
