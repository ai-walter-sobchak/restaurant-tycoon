/**
 * Schema migrations: migratePlayerProfile, migratePlotMeta.
 * Never break existing saves; default missing fields safely.
 */

import type { PlotMeta, PlayerProfile, PlotState } from '../types.js';
import {
  PLOT_META_SCHEMA_VERSION,
  PLAYER_PROFILE_SCHEMA_VERSION,
  PLOT_STATE_SCHEMA_VERSION,
} from '../types.js';

export function migratePlayerProfile(old: Record<string, unknown>): PlayerProfile {
  const version = (old.schemaVersion as number) ?? 0;
  let profile = { ...old } as Record<string, unknown>;
  if (version < 1) {
    profile = {
      schemaVersion: PLAYER_PROFILE_SCHEMA_VERSION,
      updatedAt: (old.updatedAt as number) ?? Date.now(),
      cash: (old.cash as number) ?? 0,
      unlocks: Array.isArray(old.unlocks) ? old.unlocks : [],
      staff: Array.isArray(old.staff) ? old.staff : [],
      cosmetics:
        old.cosmetics && typeof old.cosmetics === 'object'
          ? (old.cosmetics as Record<string, unknown>)
          : {},
      plotId: (old.plotId as number | null) ?? null,
    };
  }
  if ((profile as PlayerProfile).lastMode === undefined) {
    const m = (old.lastMode as string) ?? 'PLAY';
    (profile as Record<string, unknown>).lastMode = m === 'BUILD' ? 'BUILD' : 'PLAY';
  }
  if ((profile as PlayerProfile).restaurantOpen === undefined) {
    (profile as Record<string, unknown>).restaurantOpen = !!(old.restaurantOpen as boolean);
  }
  return profile as PlayerProfile;
}

export function migratePlotMeta(old: Record<string, unknown>): PlotMeta {
  const version = (old.schemaVersion as number) ?? 0;
  let meta = { ...old } as Record<string, unknown>;
  if (version < 1) {
    meta = {
      schemaVersion: PLOT_META_SCHEMA_VERSION,
      updatedAt: (old.updatedAt as number) ?? Date.now(),
      ownerId: (old.ownerId as string | null) ?? null,
      ownerName: (old.ownerName as string | null | undefined) ?? null,
      claimedAt: (old.claimedAt as number | null | undefined) ?? null,
      lastActiveAt: (old.lastActiveAt as number | null | undefined) ?? null,
    };
  }
  return meta as PlotMeta;
}

export function migratePlotState(old: Record<string, unknown>): PlotState {
  const version = (old.schemaVersion as number) ?? 0;
  let state = { ...old } as Record<string, unknown>;
  if (version < 1) {
    const placed = Array.isArray(old.placedItems)
      ? (old.placedItems as Record<string, unknown>[]).map((p) => ({
          id: (p.id as string) ?? '',
          catalogId: (p.catalogId as string) ?? '',
          position: (p.position as { x: number; y: number; z: number }) ?? { x: 0, y: 0, z: 0 },
          rotationY: ((p.rotationY as number) ?? 0) as 0 | 90 | 180 | 270,
          createdAt: (p.createdAt as number) ?? Date.now(),
          entityId: p.entityId as number | undefined,
        }))
      : [];
    state = {
      schemaVersion: PLOT_STATE_SCHEMA_VERSION,
      updatedAt: (old.updatedAt as number) ?? Date.now(),
      ownerId: (old.ownerId as string | null) ?? null,
      placedItems: placed,
      restaurantSettings:
        (old.restaurantSettings as { isOpen: boolean }) ?? { isOpen: false },
      rating: (old.rating as number) ?? 0,
    };
  }
  return state as PlotState;
}
