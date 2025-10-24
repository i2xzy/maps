import { Database } from './database';

export type Grouping = Database['public']['Tables']['groupings']['Row'];

export type GroupingSearchResult = Pick<
  Grouping,
  'id' | 'name' | 'chainage_from'
>;
