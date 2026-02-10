/**
 * NPC Spawner: manages NPC spawning, interval, max concurrent limit, and cleanup.
 * Single owner of spawn logic per plot.
 */

import type { World } from 'hytopia';
import type { PlotId, PlotState, Vec3, SimNPC, PlotSimState } from '../../types.js';
import { generateNpcId, generateNpcDebugName, spawnNPCEntity } from './NPCEntity.js';
import {
  NPC_SPAWN_INTERVAL_MS,
  NPC_MAX_CONCURRENT,
  NPC_MOVEMENT_SPEED,
  NPC_ARRIVE_CLEANUP_DELAY_MS,
} from '../../config.js';

const DEV = typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production';

/**
 * Get spawn points from plot. Looks for placed items with catalogId 'spawn_point',
 * or falls back to plot.entrance if not found.
 */
function getSpawnPointsFromPlot(plotState: PlotState, plotEntrance?: Vec3): Vec3[] {
  const points: Vec3[] = [];
  
  // Look for explicitly placed spawn points
  for (const item of plotState.placedItems ?? []) {
    if (item.catalogId === 'spawn_point') {
      points.push({ ...item.position });
    }
  }
  
  // Fallback: use plot entrance
  if (points.length === 0 && plotEntrance) {
    points.push({ ...plotEntrance });
  }
  
  return points;
}

/**
 * Get target points for NPC movement. For now, pick any seating zone or random position.
 * Can be extended to use placed items with catalogId 'waypoint' or 'target_point'.
 */
function getTargetPointsFromPlot(plotState: PlotState, plotBoundsMax?: Vec3): Vec3[] {
  const points: Vec3[] = [];
  
  // Look for seating zones (they're good crowd gathering points)
  for (const item of plotState.placedItems ?? []) {
    if (item.catalogId === 'table') {
      points.push({ ...item.position });
    }
  }
  
  // Fallback: if no tables, use plot center
  if (points.length === 0 && plotBoundsMax) {
    points.push({
      x: plotBoundsMax.x / 2,
      y: plotBoundsMax.y,
      z: plotBoundsMax.z / 2,
    });
  }
  
  return points;
}

/**
 * Spawn a single NPC: create entity, add to sim state.
 */
export function spawnOneNPC(
  world: World,
  plotState: PlotState,
  sim: PlotSimState,
  spawnPoint: Vec3
): void {
  // Limit concurrent NPCs
  if (sim.npcs.size >= NPC_MAX_CONCURRENT) {
    if (DEV) console.log('[NPC] skip spawn (max concurrent reached)');
    return;
  }
  
  // Generate unique NPC
  sim.npcCounter = (sim.npcCounter ?? 0) + 1;
  const npcId = generateNpcId();
  const debugName = generateNpcDebugName(sim.npcCounter);
  
  // Pick random target from plot
  const targets = getTargetPointsFromPlot(plotState);
  const targetPoint = targets.length > 0 ? targets[Math.floor(Math.random() * targets.length)] : spawnPoint;
  
  // Spawn entity
  const entity = spawnNPCEntity(world, npcId, debugName, spawnPoint);
  
  // Create NPC record
  const npc: SimNPC = {
    npcId,
    debugName,
    entityId: entity.id,
    position: { ...spawnPoint },
    targetPosition: { ...targetPoint },
    movementSpeed: NPC_MOVEMENT_SPEED,
    spawnedAt: Date.now(),
    arrivedAt: null,
    onArrivedFired: false,
  };
  
  sim.npcs.set(npcId, npc);
  
  if (DEV) {
    console.log('[NPC Spawner] spawned', npcId, npc.debugName, `target=(${targetPoint.x.toFixed(1)}, ${targetPoint.z.toFixed(1)})`);
  }
}

/**
 * Run NPC spawner tick: spawn if interval elapsed and below max concurrent.
 */
export function runNPCSpawnerTick(
  world: World,
  plotState: PlotState,
  sim: PlotSimState,
  now: number,
  plotEntrance?: Vec3,
  plotBoundsMax?: Vec3
): void {
  // Spawn new NPC if interval elapsed
  const lastSpawn = sim.npcLastSpawnAt ?? 0;
  if (now - lastSpawn >= NPC_SPAWN_INTERVAL_MS) {
    const spawnPoints = getSpawnPointsFromPlot(plotState, plotEntrance);
    if (spawnPoints.length > 0) {
      const spawnPoint = spawnPoints[Math.floor(Math.random() * spawnPoints.length)];
      spawnOneNPC(world, plotState, sim, spawnPoint);
      sim.npcLastSpawnAt = now;
    }
  }
}

/**
 * Clean up NPCs: despawn those that have arrived + aged beyond cleanup delay,
 * or manually remove by npcId.
 */
export function cleanupNPCs(sim: PlotSimState, now: number): string[] {
  const cleaned: string[] = [];
  
  for (const [npcId, npc] of sim.npcs.entries()) {
    // Remove if arrived and aged
    if (npc.arrivedAt !== null && now - npc.arrivedAt >= NPC_ARRIVE_CLEANUP_DELAY_MS) {
      sim.npcs.delete(npcId);
      cleaned.push(npcId);
      if (DEV) {
        console.log('[NPC Spawner] cleaned up', npcId, npc.debugName, `aged ${now - npc.spawnedAt}ms`);
      }
    }
  }
  
  return cleaned;
}

/**
 * Clear all NPCs from plot (e.g., when restaurant closes).
 */
export function clearAllNPCs(sim: PlotSimState): void {
  const count = sim.npcs.size;
  sim.npcs.clear();
  if (DEV && count > 0) {
    console.log('[NPC Spawner] cleared', count, 'NPCs');
  }
}
