/**
 * NPC Entity factory: creates placeholder NPC meshes with unique ID + debug name.
 */

import { Entity, RigidBodyType } from 'hytopia';
import type { World } from 'hytopia';
import type { Vec3 } from '../../types.js';

const DEV = typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production';

/** Generate unique NPC id */
export function generateNpcId(): string {
  return `npc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Generate debug name for NPC */
export function generateNpcDebugName(counter: number): string {
  return `NPC-${String(counter).padStart(3, '0')}`;
}

/**
 * Create and spawn an NPC entity at position.
 * Returns the Entity for position/movement updates.
 */
export function spawnNPCEntity(
  world: World,
  npcId: string,
  debugName: string,
  position: Vec3
): Entity {
  // Placeholder: use a simple cube model. Can be customized later.
  const entity = new Entity({
    modelUri: 'assets://models/blocks/grass_block.gltf',
    isEnvironmental: false,
    rigidBodyOptions: {
      type: RigidBodyType.KINEMATIC_POSITION,
      isSensor: true,
    },
  });

  entity.spawn(world, position);
  
  // Optional: set a tint to distinguish NPCs
  try {
    entity.setTintColor({ r: 150, g: 200, b: 255 });
  } catch (_) {}

  if (DEV) {
    console.log('[NPC] spawned', npcId, debugName, `@(${position.x.toFixed(1)}, ${position.y.toFixed(1)}, ${position.z.toFixed(1)})`);
  }

  return entity;
}

/**
 * Despawn an NPC entity.
 */
export function despawnNPCEntity(entity: Entity, npcId: string, debugName: string): void {
  if (entity.isSpawned) {
    entity.despawn();
  }
  if (DEV) {
    console.log('[NPC] despawned', npcId, debugName);
  }
}
