'use client';

import { useEffect, useState } from 'react';
import {
  Box,
  Dialog,
  Input,
  Portal,
  Combobox,
  ListCollection,
  CollectionItem,
} from '@chakra-ui/react';

import { MobileSearchButton, SearchButton } from './SearchButton';

interface Props {
  collection: ListCollection<CollectionItem>;
  onValueChange: (value: string[]) => void;
  onInputValueChange: (value: string) => void;
  placeholder?: string;
  disableHotkey?: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

export const CommandMenu = ({
  collection,
  onOpenChange,
  onValueChange,
  onInputValueChange,
  placeholder,
  disableHotkey,
  children,
}: Props) => {
  const [open, setOpen] = useState(false);

  useHotkey(setOpen, { disable: disableHotkey });

  return (
    <Dialog.Root
      placement='center'
      motionPreset='slide-in-bottom'
      open={open}
      onOpenChange={event => {
        setOpen(event.open);
        onOpenChange(event.open);
      }}
    >
      <Dialog.Trigger asChild>
        <Box>
          <Box hideBelow='md'>
            <SearchButton width='256px' size='sm' flexShrink='1' />
          </Box>
          <Box hideFrom='md'>
            <MobileSearchButton />
          </Box>
        </Box>
      </Dialog.Trigger>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content p='2' width={{ base: '100%', sm: 'lg' }}>
            <Combobox.Root
              open
              disableLayer
              inputBehavior='autohighlight'
              placeholder={placeholder || 'Search...'}
              selectionBehavior='clear'
              loopFocus={false}
              collection={collection}
              onValueChange={e => {
                setOpen(false);
                onValueChange(e.value);
              }}
              onInputValueChange={e => onInputValueChange(e.inputValue)}
              h='50vh'
            >
              <Combobox.Control>
                <Combobox.Input asChild>
                  <Input />
                </Combobox.Input>
              </Combobox.Control>
              <Combobox.Positioner>
                <Combobox.Content
                  boxShadow='none'
                  px='0'
                  py='0'
                  overflow='auto'
                  overscrollBehavior='contain'
                >
                  {children}
                </Combobox.Content>
              </Combobox.Positioner>
            </Combobox.Root>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
};

const useHotkey = (
  setOpen: (open: boolean) => void,
  options: { disable?: boolean }
) => {
  const { disable } = options;

  useEffect(() => {
    if (disable) return;

    const isMac = /(Mac|iPhone|iPod|iPad)/i.test(navigator?.platform);
    const hotkey = isMac ? 'metaKey' : 'ctrlKey';

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key?.toLowerCase() === 'k' && event[hotkey]) {
        event.preventDefault();
        setOpen(true);
      }
    };

    document.addEventListener('keydown', handleKeydown, true);

    return () => {
      document.removeEventListener('keydown', handleKeydown, true);
    };
  }, [setOpen, disable]);
};
