/**
 * Phase 3: Server-authoritative place/delete — validate and apply.
 */

import type { World } from 'hytopia';
import type { Player } from 'hytopia';
import type { Entity } from 'hytopia';
import type { PlotId, Vec3, PlacedItem, PlacementRotation, PlotState } from '../types.js';
import { getPlot } from '../plots.js';
import { isPointInPlot } from '../plots.js';
import { getCatalogItem } from './catalog.js';
import { snapToGridPlotRelative, clampToPlot, overlapsExisting } from './grid.js';
import { getPlayerProfile, updatePlayerProfile } from '../persistence/playerProfile.js';
import {
  getCachedPlotState,
  setCachedPlotState,
  registerPlotStateInCache,
} from '../persistence/plotStateCache.js';
import { getPlotState } from '../persistence/plotStore.js';

const DEV = typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production';

function generatePlacedId(): string {
  return `placed-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

const REFUND_RATIO = 0.5;

function defaultPlotState(plotId: PlotId, ownerId: string | null): PlotState {
  return {
    schemaVersion: 1,
    updatedAt: Date.now(),
    ownerId,
    placedItems: [],
    restaurantSettings: { isOpen: false },
    rating: 0,
  };
}

async function ensurePlotState(plotId: PlotId, ownerId: string | null): Promise<PlotState> {
  let state = getCachedPlotState(plotId);
  if (state) return state;
  const loaded = await getPlotState(plotId, 0);
  state = loaded ?? defaultPlotState(plotId, ownerId);
  registerPlotStateInCache(plotId, state);
  return state;
}

function rotationYToQuaternion(deg: PlacementRotation): { x: number; y: number; z: number; w: number } {
  const rad = (deg * Math.PI) / 180;
  return { x: 0, y: Math.sin(rad / 2), z: 0, w: Math.cos(rad / 2) };
}

export interface PlaceResult {
  ok: boolean;
  error?: string;
  placedItem?: PlacedItem;
}

export async function handlePlace(
  world: World,
  player: Player,
  plotId: PlotId,
  itemType: string,
  position: Vec3,
  rotation: PlacementRotation
): Promise<PlaceResult> {
  const plot = getPlot(plotId);
  if (!plot) {
    if (DEV) console.log('[Build] handlePlace rejected: Invalid plot');
    return { ok: false, error: 'Invalid plot' };
  }
  const profile = getPlayerProfile(player);
  if (!profile || profile.plotId !== plotId) {
    if (DEV) console.log('[Build] handlePlace rejected: You do not own this plot');
    return { ok: false, error: 'You do not own this plot' };
  }
  const catalog = getCatalogItem(itemType);
  if (!catalog) {
    if (DEV) console.log('[Build] handlePlace rejected: Unknown item', itemType);
    return { ok: false, error: 'Unknown item' };
  }
  if (profile.cash < catalog.cost) {
    if (DEV) console.log('[Build] handlePlace rejected: Not enough cash', profile.cash, '<', catalog.cost);
    return { ok: false, error: 'Not enough cash' };
  }

  const snapped = snapToGridPlotRelative(plot, position);
  const clamped = clampToPlot(plot, snapped);
  if (!isPointInPlot(plot, clamped)) {
    if (DEV) console.log('[Build] handlePlace rejected: Outside plot bounds');
    return { ok: false, error: 'Outside plot bounds' };
  }

  const state = await ensurePlotState(plotId, player.id);
  if (overlapsExisting(clamped, catalog.footprint, rotation, state.placedItems)) {
    if (DEV) console.log('[Build] handlePlace rejected: Overlaps existing item');
    return { ok: false, error: 'Overlaps existing item' };
  }

  const { Entity, RigidBodyType } = await import('hytopia');
  const entity = new Entity({
    modelUri: catalog.modelUri,
    isEnvironmental: true,
    rigidBodyOptions: { type: RigidBodyType.FIXED },
  });
  const q = rotationYToQuaternion(rotation);
  entity.spawn(world, clamped, q);

  const placedItem: PlacedItem = {
    id: generatePlacedId(),
    catalogId: itemType,
    position: clamped,
    rotationY: rotation,
    createdAt: Date.now(),
    entityId: entity.id,
  };

  const newState: PlotState = {
    ...state,
    placedItems: [...state.placedItems, placedItem],
    updatedAt: Date.now(),
  };
  setCachedPlotState(plotId, newState);
  updatePlayerProfile(player, { cash: profile.cash - catalog.cost });

  if (DEV) console.log('[Build] handlePlace accepted', itemType, 'at', clamped.x?.toFixed(1), clamped.y?.toFixed(1), clamped.z?.toFixed(1));
  return { ok: true, placedItem };
}

export interface DeleteResult {
  ok: boolean;
  error?: string;
  refund?: number;
}

export async function handleDelete(
  world: World,
  player: Player,
  plotId: PlotId,
  placedItemId: string
): Promise<DeleteResult> {
  const profile = getPlayerProfile(player);
  if (!profile || profile.plotId !== plotId) {
    if (DEV) console.log('[Build] handleDelete rejected: You do not own this plot');
    return { ok: false, error: 'You do not own this plot' };
  }
  const state = getCachedPlotState(plotId) ?? (await getPlotState(plotId, 0));
  if (!state) {
    if (DEV) console.log('[Build] handleDelete rejected: No plot state');
    return { ok: false, error: 'No plot state' };
  }
  const index = state.placedItems.findIndex((p) => p.id === placedItemId);
  if (index === -1) {
    if (DEV) console.log('[Build] handleDelete rejected: Item not found', placedItemId);
    return { ok: false, error: 'Item not found' };
  }

  const item = state.placedItems[index];
  const catalog = getCatalogItem(item.catalogId);
  const refund = catalog ? Math.floor(catalog.cost * REFUND_RATIO) : 0;

  const entityId = item.entityId;
  if (entityId != null) {
    const entities = world.entityManager.getAllEntities();
    for (const e of entities) {
      if (e.id === entityId) {
        e.despawn();
        break;
      }
    }
  }

  const newItems = state.placedItems.filter((p) => p.id !== placedItemId);
  setCachedPlotState(plotId, {
    ...state,
    placedItems: newItems,
    updatedAt: Date.now(),
  });
  if (refund > 0) updatePlayerProfile(player, { cash: profile.cash + refund });

  if (DEV) console.log('[Build] handleDelete accepted', placedItemId, 'refund', refund);
  return { ok: true, refund };
}

/** Find placed item at or near position (for delete by position). */
export function findPlacedItemAt(plotId: PlotId, position: Vec3): PlacedItem | undefined {
  const state = getCachedPlotState(plotId);
  if (!state) return undefined;
  const cellX = Math.floor(position.x);
  const cellZ = Math.floor(position.z);
  return state.placedItems.find((p) => {
    const px = Math.floor(p.position.x);
    const pz = Math.floor(p.position.z);
    return px === cellX && pz === cellZ;
  });
}

/** Rebuild entities for a plot from its state (call on server start or when loading plot). */
export async function rebuildPlotEntities(world: World, plotId: PlotId): Promise<void> {
  let state = getCachedPlotState(plotId);
  if (!state) {
    const loaded = await getPlotState(plotId, 0);
    if (!loaded?.placedItems.length) return;
    state = loaded;
    registerPlotStateInCache(plotId, state);
  }
  if (!state.placedItems.length) return;
  const { Entity, RigidBodyType } = await import('hytopia');
  const updatedItems: PlacedItem[] = [];
  for (const item of state.placedItems) {
    const catalog = getCatalogItem(item.catalogId);
    if (!catalog) {
      updatedItems.push(item);
      continue;
    }
    const entity = new Entity({
      modelUri: catalog.modelUri,
      isEnvironmental: true,
      rigidBodyOptions: { type: RigidBodyType.FIXED },
    });
    const q = rotationYToQuaternion(item.rotationY);
    entity.spawn(world, item.position, q);
    updatedItems.push({ ...item, entityId: entity.id });
  }
  setCachedPlotState(plotId, { ...state, placedItems: updatedItems, updatedAt: Date.now() });
}
