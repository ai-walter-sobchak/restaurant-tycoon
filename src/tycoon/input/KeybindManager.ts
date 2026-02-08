/**
 * Phase 2.4: Global keyboard shortcuts for modules.
 * Maps keys → module actions; routes through ModuleRouter (no duplicate logic).
 * Single keydown listener on client sends key; server resolves and toggles/closes.
 */

import type { ModuleKind } from '../types.js';

/** Action from a key: close current modal/build, or toggle a specific module. */
export type KeybindAction = Exclude<ModuleKind, 'NONE'> | 'close';

/** Phase 4: Build (B), Shop (O), Album (P), Rewards (R), Daily (N), Season (V). Escape closes. */
export const DEFAULT_KEYBINDS: Record<string, KeybindAction> = {
  Escape: 'close',
  b: 'BUILD',
  B: 'BUILD',
  o: 'SHOP',
  O: 'SHOP',
  r: 'REWARDS',
  R: 'REWARDS',
  p: 'ALBUM',
  P: 'ALBUM',
  n: 'DAILY_REWARDS',
  N: 'DAILY_REWARDS',
  v: 'SEASON',
  V: 'SEASON',
};

/**
 * Resolve key to module action. Returns 'close' for Esc, a module to toggle, or null if unbound.
 */
export function getModuleForKey(key: string): KeybindAction | null {
  return DEFAULT_KEYBINDS[key] ?? null;
}

/** Display key per module for HUD labels (e.g. "Shop (O)"). No key = ''. */
export function getModuleKeyHints(): Record<string, string> {
  const hints: Record<string, string> = {};
  for (const [key, module] of Object.entries(DEFAULT_KEYBINDS)) {
    if (module === 'close') continue;
    const upper = key.length === 1 ? key.toUpperCase() : key;
    if (!hints[module] || upper === key) hints[module] = upper;
  }
  return hints;
}
