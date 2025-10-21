import { Database } from './database';

export type Feature = Database['public']['Tables']['features']['Row'];

export type FeatureSearchResult = Pick<Feature, 'id' | 'name' | 'type'>;

export type FeatureType = Feature['type'];

export type FeatureStatus = Feature['status'];
