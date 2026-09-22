/**
 * Curated browse categories.
 *
 * <p>Audius classifies uploads with a fixed genre list that has no entry for Indian
 * styles — a Punjabi track is typically filed under Pop, Hip-Hop/Rap or Soundtrack. Genre
 * filtering therefore cannot surface this music at all; only full-text search can.
 *
 * <p>Each category is a saved search rather than a genre filter, which is what makes this
 * content reachable without the listener having to guess the right words.
 */
export interface BrowseCategory {
  /** URL-safe identifier. */
  readonly id: string;
  /** Label shown on the tile. */
  readonly label: string;
  /** The search term actually sent to the backend. */
  readonly query: string;
  /** Decorative glyph. */
  readonly icon: string;
  /** Two-colour gradient for the tile. */
  readonly gradient: string;
  /** Grouping used by the browse page. */
  readonly group: CategoryGroup;
}

export type CategoryGroup = 'indian' | 'regional' | 'devotional' | 'global';

export const CATEGORY_GROUP_LABELS: Record<CategoryGroup, string> = {
  indian: 'Indian',
  regional: 'Regional Indian',
  devotional: 'Devotional & classical',
  global: 'Global genres',
};

/**
 * The browse catalogue.
 *
 * <p>Every entry below was verified to return playable results from the live Audius API.
 */
export const BROWSE_CATEGORIES: readonly BrowseCategory[] = [
  // ---------------------------------------------------------------- Indian
  {
    id: 'bollywood',
    label: 'Bollywood',
    query: 'bollywood',
    icon: '🎬',
    gradient: 'linear-gradient(135deg, #f43f5e, #f97316)',
    group: 'indian',
  },
  {
    id: 'punjabi',
    label: 'Punjabi',
    query: 'punjabi',
    icon: '🪘',
    gradient: 'linear-gradient(135deg, #f59e0b, #ef4444)',
    group: 'indian',
  },
  {
    id: 'bhojpuri',
    label: 'Bhojpuri',
    query: 'bhojpuri',
    icon: '🎤',
    gradient: 'linear-gradient(135deg, #10b981, #059669)',
    group: 'indian',
  },
  {
    id: 'hindi',
    label: 'Hindi',
    query: 'hindi song',
    icon: '🎵',
    gradient: 'linear-gradient(135deg, #8b5cf6, #d946ef)',
    group: 'indian',
  },
  
  {
    id: 'desi-hiphop',
    label: 'Desi Hip-Hop',
    query: 'desi hip hop',
    icon: '🔥',
    gradient: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    group: 'indian',
  },

  // -------------------------------------------------------------- Regional
  {
    id: 'haryanvi',
    label: 'Haryanvi',
    query: 'haryanvi',
    icon: '🌾',
    gradient: 'linear-gradient(135deg, #84cc16, #22c55e)',
    group: 'regional',
  },
  
  {
    id: 'maharana',
    label: 'Veer Ras',
    query: 'maharana pratap',
    icon: '🛡️',
    gradient: 'linear-gradient(135deg, #dc2626, #f59e0b)',
    group: 'regional',
  },
  {
    id: 'rajasthani',
    label: 'Rajasthani',
    query: 'rajasthani',
    icon: '🏰',
    gradient: 'linear-gradient(135deg, #f97316, #eab308)',
    group: 'regional',
  },
  {
    id: 'marathi',
    label: 'Marathi',
    query: 'marathi',
    icon: '🥁',
    gradient: 'linear-gradient(135deg, #ec4899, #f43f5e)',
    group: 'regional',
  },
  
  {
    id: 'bengali',
    label: 'Bengali',
    query: 'bengali',
    icon: '🎻',
    gradient: 'linear-gradient(135deg, #06b6d4, #3b82f6)',
    group: 'regional',
  },
  
  {
    id: 'kannada',
    label: 'Kannada',
    query: 'kannada',
    icon: '🎸',
    gradient: 'linear-gradient(135deg, #a855f7, #6366f1)',
    group: 'regional',
  },
  {
    id: 'malayalam',
    label: 'Malayalam',
    query: 'malayalam',
    icon: '🌴',
    gradient: 'linear-gradient(135deg, #22c55e, #14b8a6)',
    group: 'regional',
  },

  // ------------------------------------------------------------ Devotional
  {
    id: 'bhajan',
    label: 'Bhajan',
    query: 'bhajan',
    icon: '🙏',
    gradient: 'linear-gradient(135deg, #f59e0b, #fbbf24)',
    group: 'devotional',
  },
  {
    id: 'sufi',
    label: 'Sufi',
    query: 'sufi',
    icon: '🕊️',
    gradient: 'linear-gradient(135deg, #14b8a6, #10b981)',
    group: 'devotional',
  },
  {
    id: 'qawwali',
    label: 'Qawwali',
    query: 'qawwali',
    icon: '🪗',
    gradient: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
    group: 'devotional',
  },
  {
    id: 'ghazal',
    label: 'Ghazal',
    query: 'ghazal',
    icon: '🌙',
    gradient: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    group: 'devotional',
  },
  {
    id: 'classical-indian',
    label: 'Indian Classical',
    query: 'sitar tabla',
    icon: '🪕',
    gradient: 'linear-gradient(135deg, #d97706, #b45309)',
    group: 'devotional',
  },

  // ---------------------------------------------------------------- Global
  {
    id: 'electronic',
    label: 'Electronic',
    query: 'electronic',
    icon: '⚡',
    gradient: 'linear-gradient(135deg, #06b6d4, #8b5cf6)',
    group: 'global',
  },
  {
    id: 'hiphop',
    label: 'Hip-Hop',
    query: 'hip hop',
    icon: '🎧',
    gradient: 'linear-gradient(135deg, #f43f5e, #a855f7)',
    group: 'global',
  },
  {
    id: 'lofi',
    label: 'Lo-fi',
    query: 'lofi',
    icon: '🌧️',
    gradient: 'linear-gradient(135deg, #64748b, #6366f1)',
    group: 'global',
  },
  {
    id: 'rock',
    label: 'Rock',
    query: 'rock',
    icon: '🎸',
    gradient: 'linear-gradient(135deg, #dc2626, #f97316)',
    group: 'global',
  },
  {
    id: 'pop',
    label: 'Pop',
    query: 'pop',
    icon: '✨',
    gradient: 'linear-gradient(135deg, #ec4899, #8b5cf6)',
    group: 'global',
  },
  {
    id: 'afrobeats',
    label: 'Afrobeats',
    query: 'afrobeats',
    icon: '🌍',
    gradient: 'linear-gradient(135deg, #eab308, #22c55e)',
    group: 'global',
  },
];

/** Groups the catalogue in display order. */
export function categoriesByGroup(): { group: CategoryGroup; label: string; items: BrowseCategory[] }[] {
  const order: CategoryGroup[] = ['indian', 'regional', 'devotional', 'global'];
  return order.map((group) => ({
    group,
    label: CATEGORY_GROUP_LABELS[group],
    items: BROWSE_CATEGORIES.filter((category) => category.group === group),
  }));
}

/** Looks up one category by its id. */
export function findCategory(id: string): BrowseCategory | undefined {
  return BROWSE_CATEGORIES.find((category) => category.id === id);
}
