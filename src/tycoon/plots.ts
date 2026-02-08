/**
 * Plot system: single plot for one restaurant (aligned to restaurant-map.json).
 * Expand to multiple plots later. Helpers: getPlot, getPlotOrigin, isPointInPlot, isWithinPlotBounds.
 */

import type { PlotDefinition, PlotId, Vec3, AABB } from './types.js';
import { PLOT_GRID_SIZE, GRID_CELL_SIZE, MAP_PLOT_FLOOR_Y } from './config.js';

/** Single plot: bounds (min/max), spawn, entrance. Aligned to map. */
export const PLOTS: PlotDefinition[] = buildPlots();

/** Floor Y for building on the imported map (top of ground block). */
export const PLOT_FLOOR_Y = MAP_PLOT_FLOOR_Y;

function buildPlots(): PlotDefinition[] {
  const floorY = MAP_PLOT_FLOOR_Y;
  const buildMaxY = floorY + 9;
  const spawnY = floorY + 1;
  const strideX = PLOT_GRID_SIZE * GRID_CELL_SIZE;
  const strideZ = PLOT_GRID_SIZE * GRID_CELL_SIZE;
  // Single plot for diner-rectangular-starter-v3 (blocks x -18..18, z -13..14, floor y=0)
  const minX = -5;
  const minZ = 2;
  const maxX = minX + strideX - GRID_CELL_SIZE * 0.5;
  const maxZ = minZ + strideZ - GRID_CELL_SIZE * 0.5;
  const midX = minX + Math.floor(strideX / 2);
  const midZ = minZ + Math.floor(strideZ / 2);

  return [
    {
      plotId: 0 as PlotId,
      bounds: {
        min: { x: minX, y: floorY, z: minZ },
        max: { x: maxX, y: buildMaxY, z: maxZ },
      },
      spawn: { x: midX, y: spawnY, z: midZ },
      entrance: { x: midX, y: floorY, z: minZ - 0.5 },
    },
  ];
}

export function getPlot(plotId: PlotId): PlotDefinition | undefined {
  return PLOTS[plotId];
}

/** Grid origin for plot-relative snapping (min corner of plot bounds). */
export function getPlotOrigin(plot: PlotDefinition): Vec3 {
  return { ...plot.bounds.min };
}

export function isPointInPlot(plot: PlotDefinition, pos: Vec3): boolean {
  const { min, max } = plot.bounds;
  return (
    pos.x >= min.x &&
    pos.x <= max.x &&
    pos.y >= min.y &&
    pos.y <= max.y &&
    pos.z >= min.z &&
    pos.z <= max.z
  );
}

/** Stub: returns true for now. Use later for AABB-in-plot checks. */
export function isWithinPlotBounds(_plot: PlotDefinition, _aabb: AABB): boolean {
  return true;
}
