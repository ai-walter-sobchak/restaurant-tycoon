/**
 * Central HUD state derived from player profile (and later plot state).
 * Read-only, server-authoritative. Used to push state to client UI.
 */

import type { Player } from 'hytopia';
import type { PlayerProfile } from '../types.js';
import type { PlayerMode, ModuleKind } from '../types.js';
import { getPlayerProfile } from '../persistence/playerProfile.js';
import type { TopCenterModesState } from './TopCenterModes.js';
import type { TopRightStatsState } from './TopRightStats.js';
import type { RightRailState } from './RightRail.js';
import type { LeftRailState } from './LeftRail.js';
import { getTopCenterState } from './TopCenterModes.js';
import { getTopRightState } from './TopRightStats.js';
import { getCachedPlotState } from '../persistence/plotStateCache.js';
import { hasMinimumSetup } from '../sim/zones.js';
import { getSimState } from '../sim/state.js';
import { getRightRailState } from './RightRail.js';
import { getLeftRailState } from './LeftRail.js';
import { getWindowConfig } from './window/WindowManager.js';
import { getModuleKeyHints } from '../input/KeybindManager.js';

/** Serializable window config for client (title, themeColor, optional tabs). */
export interface WindowConfigState {
  title: string;
  themeColor: string;
  tabs?: { id: string; label: string }[];
}

/** Build catalog item (serializable for client). */
export interface BuildCatalogItemState {
  itemType: string;
  cost: number;
  footprint: { w: number; d: number };
}

/** Build selection (selected item + rotation). */
export interface BuildSelectionState {
  itemType: string | null;
  rotation: number;
}

/** Build debug panel (dev-only). */
export interface BuildDebugState {
  selectedItemType: string | null;
  buildModeActive: boolean;
  lastRaycastHit: { x: number; y: number; z: number } | null;
  snappedPos: { x: number; y: number; z: number } | null;
  ghostSpawned: boolean;
  lastPlaceAttempt: { at: number; result: string } | null;
  /** Placed item id currently targeted for delete (if any) */
  targetedPlacedItemId?: string | null;
  /** Computed refund (integer dollars) for targeted item */
  targetedRefund?: number | null;
}

/** Sim debug panel: NPC and sim stats (dev-only). */
export interface SimDebugState {
  activeNPCCount: number;
  npcLastSpawnTime: number | null;
  npcSpawnInterval: number;
  lastArrivedNpcId: string | null;
}

/** Module → display key for HUD labels (e.g. BUILD → 'B'). */
export type ModuleKeyHints = Record<string, string>;

/** Order summary for HUD (serializable). */
export interface OrderSummaryState {
  orderId: string;
  dishId: string;
  status: string;
  seatId: string;
}

export interface HUDState {
  mode: PlayerMode;
  activeModule: ModuleKind;
  windowConfig: WindowConfigState | null;
  buildCatalog: BuildCatalogItemState[] | null;
  buildSelection: BuildSelectionState | null;
  buildDebug: BuildDebugState | null;
  simDebug: SimDebugState | null;
  moduleKeyHints: ModuleKeyHints;
  topCenter: TopCenterModesState;
  topRight: TopRightStatsState;
  rightRail: RightRailState;
  leftRail: LeftRailState;
  /** Phase 4: orders for current plot (when restaurant open). */
  orders: OrderSummaryState[];
}

/**
 * Build HUD state from player and optional profile/mode/activeModule/build.
 */
export function getHUDState(
  player: Player,
  options?: {
    profile?: PlayerProfile;
    mode?: PlayerMode;
    activeModule?: ModuleKind;
    buildCatalog?: BuildCatalogItemState[] | null;
    buildSelection?: BuildSelectionState | null;
    buildDebug?: BuildDebugState | null;
  }
): HUDState {
  const p = options?.profile ?? getPlayerProfile(player) ?? undefined;
  const mode = options?.mode ?? 'PLAY';
  const activeModule = options?.activeModule ?? 'NONE';
  const winConfig = getWindowConfig(activeModule);
  const windowConfig: WindowConfigState | null = winConfig
    ? {
        title: winConfig.title,
        themeColor: winConfig.themeColor,
        tabs: winConfig.tabs ? [...winConfig.tabs] : undefined,
      }
    : null;
  const buildCatalog = options?.buildCatalog ?? (activeModule === 'BUILD' ? [] : null);
  const buildSelection = options?.buildSelection ?? null;
  const buildDebug = options?.buildDebug ?? null;
  const moduleKeyHints = getModuleKeyHints();
  const plotId = p?.plotId ?? null;
  const plotState = plotId != null ? getCachedPlotState(plotId) : undefined;
  const nextGoal =
    plotState && !plotState.restaurantSettings?.isOpen && !hasMinimumSetup(plotState)
      ? 'Place a stove and table, then open.'
      : null;
  const rating = plotState?.rating ?? (p ? 0 : 0);
  const orders: OrderSummaryState[] =
    plotId != null && plotState?.restaurantSettings?.isOpen
      ? getSimState(plotId).orders.map((o) => ({
          orderId: o.orderId,
          dishId: o.dishId,
          status: o.status,
          seatId: o.seatId,
        }))
      : [];
  
  // Build simDebug from NPC state (if restaurant is open)
  let simDebug: SimDebugState | null = null;
  if (plotId != null && plotState?.restaurantSettings?.isOpen) {
    const sim = getSimState(plotId);
    simDebug = {
      activeNPCCount: sim.npcs.size,
      npcLastSpawnTime: sim.npcLastSpawnAt > 0 ? sim.npcLastSpawnAt : null,
      npcSpawnInterval: 6000, // Import from config if needed
      lastArrivedNpcId: sim.lastArrivedNpcId,
    };
  }

  return {
    mode,
    activeModule,
    windowConfig,
    buildCatalog: buildCatalog ?? null,
    buildSelection: buildSelection ?? null,
    buildDebug: buildDebug ?? null,
    simDebug,
    moduleKeyHints,
    topCenter: getTopCenterState(
      activeModule === 'BUILD' || activeModule === 'SHOP' || activeModule === 'RESTAURANT' ? activeModule : 'NONE',
      { restaurantOpen: p?.restaurantOpen ?? false, nextGoal }
    ),
    topRight: { ...getTopRightState(p), rating },
    rightRail: getRightRailState(),
    leftRail: getLeftRailState(),
    orders,
  };
}
