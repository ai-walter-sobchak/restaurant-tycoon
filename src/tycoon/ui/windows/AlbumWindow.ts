/**
 * Phase 2.3: Album window — placeholder list + fake progression text. Theme purple.
 */

export const ALBUM_WINDOW_CONFIG = {
  title: 'Album',
  themeColor: 'purple',
  tabs: [
    { id: 'collection', label: 'Collection' },
    { id: 'progress', label: 'Progress' },
  ],
} as const;
