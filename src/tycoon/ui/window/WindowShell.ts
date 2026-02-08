/**
 * Phase 2.3: Window shell — title bar with theme color, close (X).
 * Shared by all module windows.
 */

export interface WindowShellConfig {
  title: string;
  /** Theme color name for title bar (blue, green, purple, orange, etc.). */
  themeColor: string;
}

export const THEME_COLORS: Record<string, string> = {
  blue: '#4a90d9',
  green: '#5cb85c',
  purple: '#9b59b6',
  orange: '#e67e22',
  gold: '#f1c40f',
  teal: '#1abc9c',
  red: '#e74c3c',
};
