/**
 * NPC Controller: per-NPC movement, arrival detection, and event emission.
 * Movement is delta-time based (frame-rate independent).
 */

import type { Entity } from 'hytopia';
import type { Vec3, SimNPC } from '../../types.js';

const DEV = typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production';

/** Arrival detection threshold (distance in units) */
const ARRIVAL_THRESHOLD = 0.5;

/**
 * Update NPC movement and position for one tick.
 * Returns true if NPC has arrived at target (with onArrived event fired).
 */
export function updateNPCMovement(
  npc: SimNPC,
  entity: Entity,
  deltaTimeMs: number
): { arrived: boolean } {
  // Skip if already arrived and event fired
  if (npc.arrivedAt !== null && npc.onArrivedFired) {
    return { arrived: false };
  }

  const dx = npc.targetPosition.x - npc.position.x;
  const dy = npc.targetPosition.y - npc.position.y;
  const dz = npc.targetPosition.z - npc.position.z;
  const distanceRemaining = Math.sqrt(dx * dx + dy * dy + dz * dz);

  // Check if arrived
  if (distanceRemaining <= ARRIVAL_THRESHOLD) {
    if (npc.arrivedAt === null) {
      npc.arrivedAt = Date.now();
      if (DEV) {
        console.log('[NPC] arrived', npc.npcId, npc.debugName, `after ${npc.arrivedAt - npc.spawnedAt}ms`);
      }
    }
    if (!npc.onArrivedFired) {
      npc.onArrivedFired = true;
      return { arrived: true };
    }
    return { arrived: false };
  }

  // Move towards target: speed * deltaTime
  const deltaTimeSec = deltaTimeMs / 1000;
  const moveDistance = npc.movementSpeed * deltaTimeSec;

  if (moveDistance >= distanceRemaining) {
    // Reached target this frame
    npc.position = { ...npc.targetPosition };
  } else {
    // Move partway
    const ratio = moveDistance / distanceRemaining;
    npc.position = {
      x: npc.position.x + dx * ratio,
      y: npc.position.y + dy * ratio,
      z: npc.position.z + dz * ratio,
    };
  }

  // Update entity position via kinematic body
  if (entity.isSpawned && entity.rawRigidBody) {
    entity.rawRigidBody.setNextKinematicPosition(npc.position);
  }

  if (DEV && distanceRemaining <= ARRIVAL_THRESHOLD + 2) {
    console.log('[NPC] moving', npc.npcId, `dist=${distanceRemaining.toFixed(2)}`);
  }

  return { arrived: false };
}

/**
 * Get distance from current position to target.
 */
export function distanceToTarget(npc: SimNPC): number {
  const dx = npc.targetPosition.x - npc.position.x;
  const dy = npc.targetPosition.y - npc.position.y;
  const dz = npc.targetPosition.z - npc.position.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
