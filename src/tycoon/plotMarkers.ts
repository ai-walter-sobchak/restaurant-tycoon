/**
 * Dev-only: spawn thin boundary markers at plot corners to confirm alignment on the map.
 * Set RENDER_PLOT_BOUNDS=1 (or run in dev) to enable.
 */

import type { World } from 'hytopia';
import type { Entity } from 'hytopia';
import { PLOTS } from './plots.js';
import type { PlotDefinition, Vec3 } from './types.js';

const DEV = typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production';
const RENDER_PLOT_BOUNDS = typeof process !== 'undefined' && process.env?.RENDER_PLOT_BOUNDS === '1';

/** Corner positions for a plot (floor Y). */
function getPlotCorners(plot: PlotDefinition): Vec3[] {
  const { min, max } = plot.bounds;
  const y = min.y;
  return [
    { x: min.x, y, z: min.z },
    { x: max.x, y, z: min.z },
    { x: min.x, y, z: max.z },
    { x: max.x, y, z: max.z },
  ];
}

let markerEntities: Entity[] = [];

/**
 * Spawn a small pillar/marker at each plot corner. Dev-only unless RENDER_PLOT_BOUNDS=1.
 * Call once after world.loadMap in initTycoon.
 */
export async function spawnPlotBoundaryMarkers(world: World): Promise<void> {
  if (!DEV && !RENDER_PLOT_BOUNDS) return;
  const { Entity, RigidBodyType } = await import('hytopia');
  for (const plot of PLOTS) {
    const corners = getPlotCorners(plot);
    for (const pos of corners) {
      const marker = new Entity({
        modelUri: 'models/structures/slabs/granite slab.gltf',
        isEnvironmental: true,
        rigidBodyOptions: { type: RigidBodyType.FIXED },
      });
      marker.spawn(world, pos);
      markerEntities.push(marker);
    }
  }
  if (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production') {
    console.log('[PlotMarkers] spawned', markerEntities.length, 'corner markers for', PLOTS.length, 'plots');
  }
}

/**
 * Remove all plot boundary markers (e.g. on world unload). Optional.
 */
export function removePlotBoundaryMarkers(): void {
  for (const e of markerEntities) {
    if (e?.isSpawned) e.despawn();
  }
  markerEntities = [];
}
