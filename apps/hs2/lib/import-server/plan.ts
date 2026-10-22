import type { Client } from '@supabase/server';
import type { SpanLookup } from '@/lib/import';

export function serverSpanLookup(supabase: Client): SpanLookup {
  return async (from, to) => {
    const { data, error } = await supabase.rpc('chainage_span', {
      p_start: from,
      p_end: to,
    });
    if (error) throw error;
    return (data ?? []).map((row) => row.feature_name);
  };
}
