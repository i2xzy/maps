import type { Metadata } from 'next';

import { ImportWizard } from './ImportWizard';

export const metadata: Metadata = { title: 'Import layer' };

export default function ImportPage() {
  return <ImportWizard />;
}
