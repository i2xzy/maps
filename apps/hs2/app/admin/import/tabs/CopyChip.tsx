'use client';

import { Button, Clipboard } from '@chakra-ui/react';

// A small click-to-copy chip built on Chakra's Clipboard, which handles the copy
// and the transient "Copied" state. Copies `value`; shows `label` (default `value`).
export function CopyChip({ value, label }: { value: string; label?: string }) {
  return (
    <Clipboard.Root value={value} timeout={1200}>
      <Clipboard.Trigger asChild>
        <Button size='xs' variant='outline' fontFamily='mono'>
          <Clipboard.Indicator copied='Copied'>{label ?? value}</Clipboard.Indicator>
        </Button>
      </Clipboard.Trigger>
    </Clipboard.Root>
  );
}
