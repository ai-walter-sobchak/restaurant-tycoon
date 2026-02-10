/**
 * BuildModeController
 * Central owner of build-mode state, input routing, preview lifecycle and placement.
 * Enforces single-source-of-truth for build state and single exit path.
 */

import type { World, Player, Entity } from 'hytopia';
import type { PlotId, Vec3 } from '../types.js';
import { getBuildState, setBuildState, clearBuildState } from './buildState.js';
import { getPointerRayFromPlayer, raycastBuildSurface } from './raycast.js';
import { snapToGridPlotRelative, clampToPlot, overlapsExisting } from './grid.js';
import { getCatalogItem, nextRotation } from './catalog.js';
import { updateGhost, removeGhost, getGhostEntity } from './ghost.js';
import { getPlot, isPointInPlot } from '../plots.js';
import { handlePlace, handleDelete, findPlacedItemAt, findPlacedItemNear } from './serverHandlers.js';
import { getPlayerProfile } from '../persistence/playerProfile.js';
import { getCachedPlotState } from '../persistence/plotStateCache.js';
import { getActiveModule } from '../ui/modules/ModuleRouter.js';
import { getPlayerMode, setPlayerMode } from '../buildMode.js';

const DEV = typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production';

// Track currently highlighted entity per player so we can clear tint when target changes
const highlightedEntityByPlayer = new Map<string, string | number | null>();

export type BuildModeState = 'OFF' | 'MENU_OPEN' | 'PLACING';

interface InternalPlayerEntry {
  player: Player;
  entity: Entity;
  plotId: PlotId | null;
}

const modeMap = new Map<string, BuildModeState>();

function log(...args: unknown[]) {
  if (DEV) console.log('[BuildController]', ...args);
}

export function getMode(playerId: string): BuildModeState {
  return modeMap.get(playerId) ?? 'OFF';
}

export function enterBuildMode(player: Player, entity: Entity, plotId: PlotId | null): void {
  modeMap.set(player.id, 'MENU_OPEN');
  setPlayerMode(player, 'BUILD');
  // initialize per-player build state
  setBuildState(player.id, { selectedItemType: null, placementRotation: 0, lastGhostPosition: null, lastDeleteTargetId: null, lastRaycastHit: null });
  log('enterBuildMode', player.id);
}

export function exitBuildMode(player: Player, entity: Entity, reason = 'unknown'): void {
  const prev = modeMap.get(player.id) ?? 'OFF';
  modeMap.set(player.id, 'OFF');
  setPlayerMode(player, 'PLAY');
  removeGhost(player.id);
  clearBuildState(player.id);
  log('exitBuildMode', player.id, 'reason', reason, 'from', prev);
}

export function cleanupPlayer(playerId: string): void {
  modeMap.delete(playerId);
  removeGhost(playerId);
  clearBuildState(playerId);
  log('cleanupPlayer', playerId);
}

export function selectItem(player: Player, itemType: string | null): void {
  if (getActiveModule(player) !== 'BUILD') return;
  setBuildState(player.id, { selectedItemType: itemType });
  if (!itemType) {
    removeGhost(player.id);
    modeMap.set(player.id, 'MENU_OPEN');
    log('deselected', player.id);
    return;
  }
  modeMap.set(player.id, 'PLACING');
  log('selected', player.id, itemType);
}

export function rotateSelection(player: Player): void {
  const s = getBuildState(player.id);
  setBuildState(player.id, { placementRotation: nextRotation(s.placementRotation) });
  log('rotated', player.id, 'to', getBuildState(player.id).placementRotation);
}

/**
 * Tick update for one player while build module is active. Responsible for raycast, snapping, ghost update and state writes.
 */
export function tickForPlayer(
  world: World,
  entry: InternalPlayerEntry,
  tickCountMap: Map<string, number>,
  pushHUDStateBuild: (p: Player) => void,
  BUILD_PUSH_INTERVAL_TICKS: number
): void {
  const player = entry.player;
  if (getActiveModule(player) !== 'BUILD') return;
  const plot = entry.plotId != null ? getPlot(entry.plotId) : null;
  const groundY = plot?.bounds.min.y ?? Math.max(0, entry.entity.position.y - 1);
  const ray = getPointerRayFromPlayer(player, entry.entity);
  const hit = raycastBuildSurface(world, ray, { groundY });
  const s = getBuildState(player.id);
  let lastGhostPosition: Vec3 | null = null;
  let lastDeleteTargetId: string | null = null;
  
  if (hit) {
    const snapped = plot ? snapToGridPlotRelative(plot, hit) : { x: Math.floor(hit.x) + 0.5, y: hit.y, z: Math.floor(hit.z) + 0.5 };
    const clamped = plot ? clampToPlot(plot, snapped) : snapped;
    if (entry.plotId != null) {
      // prefer exact cell match, but fall back to a tolerant near-match so aiming is forgiving
      lastDeleteTargetId = findPlacedItemAt(entry.plotId, clamped)?.id ?? findPlacedItemNear(entry.plotId, clamped)?.id ?? null;
    }
    if (DEV && entry.plotId != null) {
      try {
        const plotState = getCachedPlotState(entry.plotId);
        const nearby = (plotState?.placedItems ?? []).map((p) => {
          const dx = p.position.x - clamped.x;
          const dz = p.position.z - clamped.z;
          return { id: p.id, entityId: p.entityId, x: p.position.x, z: p.position.z, dist: Math.sqrt(dx * dx + dz * dz) };
        });
        console.log('[Build] selection debug', player.id, 'snapped', { x: clamped.x.toFixed(2), z: clamped.z.toFixed(2) }, 'targetId', lastDeleteTargetId, 'nearby', nearby);
      } catch (_) {}
    }
    const itemType = s.selectedItemType;
    if (itemType) {
      const catalog = getCatalogItem(itemType);
      if (catalog) {
        lastGhostPosition = clamped;
        const valid = plot
          ? (() => {
              const plotState = getCachedPlotState(entry.plotId!);
              const existing = plotState?.placedItems ?? [];
              return isPointInPlot(plot, clamped) && !overlapsExisting(clamped, catalog.footprint, s.placementRotation, existing);
            })()
          : false;
        updateGhost(player.id, world, itemType, clamped, s.placementRotation, valid);
      }
    }
  } else if (s.selectedItemType) {
    removeGhost(player.id);
  }
  
  setBuildState(player.id, { lastGhostPosition, lastDeleteTargetId, lastRaycastHit: hit ? { ...hit } : null });

  // Highlight the targeted placed item (if any) so player can see what will be deleted.
  try {
    const prevEntityId = highlightedEntityByPlayer.get(player.id) ?? null;
    let currentEntityId: string | number | null = null;
    if (entry.plotId != null && lastDeleteTargetId) {
      const plotState = getCachedPlotState(entry.plotId);
      const placed = plotState?.placedItems.find((p) => p.id === lastDeleteTargetId);
      // entityId is stored when plots are rebuilt/placed on server
      currentEntityId = (placed?.entityId as unknown as number) ?? null;
    }
    if (prevEntityId !== currentEntityId) {
      // clear previous tint
      if (prevEntityId != null) {
        const entities = world.entityManager.getAllEntities?.() ?? [];
        for (const e of entities) {
          if (String(e.id) === String(prevEntityId)) {
            try {
              e.setTintColor?.(null as any);
            } catch (_) {}
            break;
          }
        }
      }
      // apply tint to new target
      if (currentEntityId != null) {
        const entities = world.entityManager.getAllEntities?.() ?? [];
        for (const e of entities) {
          if (String(e.id) === String(currentEntityId)) {
            try {
              e.setTintColor?.({ r: 255, g: 255, b: 0 }); // bright yellow tint
            } catch (_) {}
            break;
          }
        }
      }
      highlightedEntityByPlayer.set(player.id, currentEntityId);
    }
  } catch (_) {}
  
  const t = (tickCountMap.get(player.id) ?? 0) + 1;
  tickCountMap.set(player.id, t);
  if (t % BUILD_PUSH_INTERVAL_TICKS === 0) pushHUDStateBuild(player);
}

export async function attemptPlace(world: World, player: Player, entry: InternalPlayerEntry): Promise<{ ok: boolean; error?: string }> {
  const s = getBuildState(player.id);
  // Debug: always log place attempts to help identify missing state
  console.log('[BuildController] place request', player.id, 'sel=', s.selectedItemType, 'ghost=', !!s.lastGhostPosition, 'plotId=', entry?.plotId);
  if (!s.selectedItemType || !s.lastGhostPosition || entry.plotId == null) {
    const reason = !s.selectedItemType ? 'no-selection' : !s.lastGhostPosition ? 'no-ghost' : 'no-plot';
    // record attempt for HUD visibility
    setBuildState(player.id, { lastPlaceAttempt: { at: Date.now(), result: 'rejected:' + reason } });
    console.log('[BuildController] place rejected early', player.id, reason);
    return { ok: false, error: 'Select an item and aim at a valid spot.' };
  }
  const result = await handlePlace(world, player, entry.plotId, s.selectedItemType, s.lastGhostPosition, s.placementRotation);
  const resultStr = result.ok ? 'ok' : (result.error ?? 'rejected');
  setBuildState(player.id, { lastPlaceAttempt: { at: Date.now(), result: resultStr } });
  log('placeAttempt', player.id, resultStr);
  return { ok: result.ok, error: result.error };
}

export async function attemptDelete(world: World, player: Player, entry: InternalPlayerEntry, positionedId?: string): Promise<{ ok: boolean; error?: string; refund?: number } | null> {
  if (entry.plotId == null) return null;
  const plotId = entry.plotId;
  let placedItemId: string | undefined = positionedId;
  if (!placedItemId) {
    placedItemId = getBuildState(player.id).lastDeleteTargetId ?? undefined;
  }
  if (!placedItemId) return { ok: false, error: 'No target to delete' };
  const res = await handleDelete(world, player, plotId, placedItemId);
  log('deleteAttempt', player.id, placedItemId, res.ok ? 'ok' : res.error);
  if (res.ok) {
    // clear last delete target so UI/outline updates immediately
    try {
      setBuildState(player.id, { lastDeleteTargetId: null });
      const prev = highlightedEntityByPlayer.get(player.id);
      if (prev != null) {
        const entities = world.entityManager.getAllEntities?.() ?? [];
        for (const e of entities) {
          if (String(e.id) === String(prev)) {
            try { e.setTintColor?.(null as any); } catch (_) {}
            break;
          }
        }
        highlightedEntityByPlayer.set(player.id, null);
      }
    } catch (_) {}
  }
  return res;
}

export default {
  enterBuildMode,
  exitBuildMode,
  cleanupPlayer,
  selectItem,
  rotateSelection,
  tickForPlayer,
  attemptPlace,
  attemptDelete,
};
