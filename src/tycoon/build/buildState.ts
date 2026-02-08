/**
 * Per-player build state: selected item, rotation, last ghost position.
 */

import type { Vec3 } from '../types.js';
import type { PlacementRotation } from '../types.js';

export interface PlayerBuildState {
  selectedItemType: string | null;
  placementRotation: PlacementRotation;
  lastGhostPosition: Vec3 | null;
  /** Placed item id under cursor (for delete without client sending position). */
  lastDeleteTargetId: string | null;
  /** Last raycast hit (for debug panel). */
  lastRaycastHit: Vec3 | null;
  /** Last place attempt result (for debug panel). */
  lastPlaceAttempt?: { at: number; result: string };
}

const buildStateMap = new Map<string, PlayerBuildState>();

const DEFAULT_STATE: PlayerBuildState = {
  selectedItemType: null,
  placementRotation: 0,
  lastGhostPosition: null,
  lastDeleteTargetId: null,
  lastRaycastHit: null,
};

export function getBuildState(playerId: string): PlayerBuildState {
  return buildStateMap.get(playerId) ?? { ...DEFAULT_STATE };
}

export function setBuildState(playerId: string, patch: Partial<PlayerBuildState>): void {
  const current = getBuildState(playerId);
  buildStateMap.set(playerId, { ...current, ...patch });
}

export function clearBuildState(playerId: string): void {
  buildStateMap.delete(playerId);
}
