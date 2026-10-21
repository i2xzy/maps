'use client';

import { useState } from 'react';
import { Button } from '@chakra-ui/react';

// A small click-to-copy chip. Copies `value`; shows `label` (default `value`).
export function CopyChip({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      size='xs'
      variant='outline'
      fontFamily='mono'
      onClick={() => {
        void navigator.clipboard?.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
    >
      {copied ? 'Copied' : (label ?? value)}
    </Button>
  );
}
