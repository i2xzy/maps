import { redirect } from 'next/navigation';

// The only admin surface is the import wizard, so /admin sends you there.
export default function AdminIndexPage() {
  redirect('/admin/import');
}
