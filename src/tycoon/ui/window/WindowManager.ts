/**
 * Phase 2.3: Window state — one window at a time; config per module.
 * Integrates with ModuleRouter: opening a module opens its window config.
 */

import type { ModuleKind } from '../../types.js';
import type { WindowShellConfig } from './WindowShell.js';
import type { WindowTabItem } from './WindowTabs.js';
import { SHOP_WINDOW_CONFIG } from '../windows/ShopWindow.js';
import { ALBUM_WINDOW_CONFIG } from '../windows/AlbumWindow.js';
import { REWARDS_WINDOW_CONFIG } from '../windows/RewardsWindow.js';
import { DAILY_REWARDS_WINDOW_CONFIG } from '../windows/DailyRewardsWindow.js';
import { SEASON_WINDOW_CONFIG } from '../windows/SeasonWindow.js';

export interface WindowConfig extends WindowShellConfig {
  tabs?: readonly WindowTabItem[];
}

const MODULE_WINDOW_CONFIG: Partial<Record<ModuleKind, WindowConfig>> = {
  SHOP: SHOP_WINDOW_CONFIG as WindowConfig,
  RESTAURANT: { title: 'Restaurant', themeColor: 'green' },
  ALBUM: ALBUM_WINDOW_CONFIG as WindowConfig,
  REWARDS: REWARDS_WINDOW_CONFIG as WindowConfig,
  DAILY_REWARDS: DAILY_REWARDS_WINDOW_CONFIG as WindowConfig,
  SEASON: SEASON_WINDOW_CONFIG as WindowConfig,
  BUILD: { title: 'BUILD MODE', themeColor: 'blue' },
};

/**
 * Get window config for the active module. Returns null when NONE or unknown.
 */
export function getWindowConfig(module: ModuleKind): WindowConfig | null {
  if (module === 'NONE') return null;
  return MODULE_WINDOW_CONFIG[module] ?? { title: module, themeColor: 'blue' };
}
