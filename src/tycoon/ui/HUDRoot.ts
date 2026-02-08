/**
 * HUD root: push server state to client, handle UI actions (build toggle in main).
 */

import type { Player } from 'hytopia';
import { getHUDState } from './useHUDState.js';
import type { BuildCatalogItemState, BuildSelectionState, BuildDebugState } from './useHUDState.js';
import { getPlayerMode } from '../buildMode.js';
import { getActiveModule } from './modules/ModuleRouter.js';

/**
 * Send current HUD state to the player's client. Call after join and when profile, mode, module, or build state changes.
 */
export function pushHUDState(
  player: Player,
  overrides?: {
    buildCatalog?: BuildCatalogItemState[] | null;
    buildSelection?: BuildSelectionState | null;
    buildDebug?: BuildDebugState | null;
  }
): void {
  const state = getHUDState(player, {
    mode: getPlayerMode(player),
    activeModule: getActiveModule(player),
    buildCatalog: overrides?.buildCatalog,
    buildSelection: overrides?.buildSelection,
    buildDebug: overrides?.buildDebug,
  });
  player.ui.sendData(state);
}

/**
 * Handle data from client (button clicks). Visual only: log and do nothing.
 */
export function handleHUDData(payload: { data: unknown }): void {
  const { data } = payload;
  if (data && typeof data === 'object' && 'zone' in (data as object)) {
    const d = data as { zone?: string; action?: string };
    console.log('[Tycoon HUD] click', d.zone, d.action ?? data);
  } else {
    console.log('[Tycoon HUD] data', data);
  }
}
