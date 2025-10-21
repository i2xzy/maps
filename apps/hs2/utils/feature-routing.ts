/**
 * Feature routing utilities for generating correct hrefs based on feature types
 */

// Map feature types to their parent categories and URL structure
const FEATURE_TYPE_MAPPING = {
  // Tunnels
  tunnel: { parent: 'tunnels', useSubtype: false },
  cut_and_cover: { parent: 'tunnels', useSubtype: true },

  // Bridges
  overbridge: { parent: 'bridges', useSubtype: true },
  underbridge: { parent: 'bridges', useSubtype: true },
  underpass: { parent: 'bridges', useSubtype: true },

  // Viaducts
  viaduct: { parent: 'viaducts', useSubtype: false },
  box_structure: { parent: 'viaducts', useSubtype: true },

  // Stations
  station: { parent: 'stations', useSubtype: false },

  // Other types (fallback)
  embankment: { parent: 'structures', useSubtype: false },
  cutting: { parent: 'structures', useSubtype: false },
  shaft: { parent: 'structures', useSubtype: false },
  culvert: { parent: 'structures', useSubtype: false },
} as const;

type FeatureType = keyof typeof FEATURE_TYPE_MAPPING;

/**
 * Generate the correct href for a feature based on its type
 */
export function getFeatureHref(featureType: string, featureId: string): string {
  const mapping = FEATURE_TYPE_MAPPING[featureType as FeatureType];

  if (!mapping) {
    // Fallback for unknown types
    console.warn(`Unknown feature type: ${featureType}`);
    return `/structures/${featureType}s/${featureId}`;
  }

  const { parent, useSubtype } = mapping;

  if (useSubtype) {
    // Use subtype routing: /structures/bridges/overbridge/123
    return `/structures/${parent}/${featureType}s/${featureId}`;
  } else {
    // Use direct routing: /structures/tunnels/123
    return `/structures/${parent}/${featureId}`;
  }
}

/**
 * Get the parent category for a feature type
 */
export function getFeatureParentCategory(featureType: string): string {
  const mapping = FEATURE_TYPE_MAPPING[featureType as FeatureType];
  return mapping?.parent || 'structures';
}

/**
 * Check if a feature type uses subtype routing
 */
export function usesSubtypeRouting(featureType: string): boolean {
  const mapping = FEATURE_TYPE_MAPPING[featureType as FeatureType];
  return mapping?.useSubtype || false;
}

/**
 * Get the display name for a feature category
 */
export function getFeatureCategoryDisplayName(featureType: string): string {
  const parent = getFeatureParentCategory(featureType);

  switch (parent) {
    case 'tunnels':
      return 'Tunnels';
    case 'bridges':
      return 'Bridges';
    case 'viaducts':
      return 'Viaducts';
    case 'stations':
      return 'Stations';
    default:
      return 'Structures';
  }
}
