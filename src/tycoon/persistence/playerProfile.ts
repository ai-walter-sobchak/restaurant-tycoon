/**
 * Player persisted data: load/save helpers (merge-safe updates).
 * Uses player.getPersistedData() / player.setPersistedData().
 */

import type { Player } from 'hytopia';
import type { PlayerProfile } from '../types.js';
import { STARTING_CASH } from '../config.js';
import { PLAYER_PROFILE_SCHEMA_VERSION } from '../types.js';
import { migratePlayerProfile } from './migrate.js';

const PROFILE_KEY = 'profile';

export function getPlayerProfile(player: Player): PlayerProfile | undefined {
  const data = player.getPersistedData();
  if (!data || typeof data !== 'object') return undefined;
  const raw = (data as Record<string, unknown>)[PROFILE_KEY];
  if (!raw || typeof raw !== 'object') return undefined;
  const migrated = migratePlayerProfile(raw as Record<string, unknown>);
  return migrated as PlayerProfile;
}

export function ensurePlayerProfile(player: Player): PlayerProfile {
  const existing = getPlayerProfile(player);
  if (existing) return existing;
  const profile: PlayerProfile = {
    schemaVersion: PLAYER_PROFILE_SCHEMA_VERSION,
    updatedAt: Date.now(),
    cash: STARTING_CASH,
    unlocks: ['dish_burger'],
    staff: [],
    cosmetics: {},
    plotId: null,
    restaurantOpen: false,
  };
  player.setPersistedData({ [PROFILE_KEY]: profile });
  return profile;
}

/** Merge-safe update: only send the profile key with updated fields. */
export function updatePlayerProfile(
  player: Player,
  patch: Partial<Omit<PlayerProfile, 'schemaVersion' | 'updatedAt'>>
): PlayerProfile {
  const current = ensurePlayerProfile(player);
  const updated: PlayerProfile = {
    ...current,
    ...patch,
    schemaVersion: PLAYER_PROFILE_SCHEMA_VERSION,
    updatedAt: Date.now(),
  };
  player.setPersistedData({ [PROFILE_KEY]: updated });
  return updated;
}
