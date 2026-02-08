/**
 * Phase 3: Ghost entity lifecycle — show placement preview, valid/invalid state.
 */

import { Entity, RigidBodyType } from 'hytopia';
import type { World } from 'hytopia';
import type { Vec3 } from '../types.js';
import type { PlacementRotation } from '../types.js';
import { getCatalogItem } from './catalog.js';

const ghostMap = new Map<string, Entity>();

const DEV = typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production';

function rotationYToQuaternion(deg: PlacementRotation): { x: number; y: number; z: number; w: number } {
  const rad = (deg * Math.PI) / 180;
  const hy = Math.sin(rad / 2);
  const hw = Math.cos(rad / 2);
  return { x: 0, y: hy, z: 0, w: hw };
}

/**
 * Spawn or update ghost at position with rotation (per player).
 */
export function updateGhost(
  playerId: string,
  world: World,
  itemType: string,
  position: Vec3,
  rotationY: PlacementRotation,
  valid: boolean
): void {
  const item = getCatalogItem(itemType);
  if (!item) return;
  let ghost = ghostMap.get(playerId);
  if (!ghost || !ghost.isSpawned) {
    if (ghost?.isSpawned) ghost.despawn();
    ghost = new Entity({
      modelUri: item.modelUri,
      isEnvironmental: false,
      rigidBodyOptions: { type: RigidBodyType.KINEMATIC_POSITION, isSensor: true },
    });
    ghostMap.set(playerId, ghost);
  }
  const q = rotationYToQuaternion(rotationY);
  const wasSpawned = ghost.isSpawned;
  if (!ghost.isSpawned) {
    ghost.spawn(world, position, q);
    if (DEV) console.log('[Build] ghost spawn', playerId, 'pos', position.x?.toFixed(1), position.y?.toFixed(1), position.z?.toFixed(1), 'valid', valid);
  } else {
    const rb = ghost.rigidBody;
    if (rb) {
      rb.setNextKinematicPosition(position);
      rb.setNextKinematicRotation(q);
    }
  }
  try {
    ghost.setTintColor(valid ? { r: 200, g: 255, b: 200 } : { r: 255, g: 180, b: 180 });
  } catch (_) {}
}

/**
 * Remove ghost entity for a player.
 */
export function removeGhost(playerId: string): void {
  const ghost = ghostMap.get(playerId);
  if (ghost?.isSpawned) ghost.despawn();
  ghostMap.delete(playerId);
  if (DEV) console.log('[Build] ghost removed', playerId);
}

/**
 * Get current ghost entity for a player.
 */
export function getGhostEntity(playerId: string): Entity | null {
  return ghostMap.get(playerId) ?? null;
}
