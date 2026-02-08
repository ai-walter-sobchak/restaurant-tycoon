/**
 * Phase 3: Grid snap and occupancy for placement.
 * Plot-relative: snappedPos = plotOrigin + snappedLocal.
 */

import type { PlotDefinition, Vec3, PlacedItem, PlacementRotation } from '../types.js';
import { GRID_CELL_SIZE } from '../config.js';
import { getPlotOrigin } from '../plots.js';
import { getCatalogItem } from './catalog.js';

export function snapToGrid(worldPos: Vec3): Vec3 {
  const s = GRID_CELL_SIZE;
  return {
    x: Math.floor(worldPos.x / s) * s + s * 0.5,
    y: worldPos.y,
    z: Math.floor(worldPos.z / s) * s + s * 0.5,
  };
}

/** Snap world hit to plot-local grid, then return world position: plotOrigin + snappedLocal. */
export function snapToGridPlotRelative(plot: PlotDefinition, worldHit: Vec3): Vec3 {
  const origin = getPlotOrigin(plot);
  const local = {
    x: worldHit.x - origin.x,
    y: worldHit.y - origin.y,
    z: worldHit.z - origin.z,
  };
  const s = GRID_CELL_SIZE;
  const snappedLocal = {
    x: Math.floor(local.x / s) * s + s * 0.5,
    y: local.y,
    z: Math.floor(local.z / s) * s + s * 0.5,
  };
  return {
    x: origin.x + snappedLocal.x,
    y: origin.y + snappedLocal.y,
    z: origin.z + snappedLocal.z,
  };
}

export function gridCellFromWorld(pos: Vec3): { x: number; z: number } {
  const s = GRID_CELL_SIZE;
  return {
    x: Math.floor(pos.x / s),
    z: Math.floor(pos.z / s),
  };
}

/** Clamp position to plot bounds (horizontal); keep y. */
export function clampToPlot(plot: PlotDefinition, pos: Vec3): Vec3 {
  const { min, max } = plot.bounds;
  return {
    x: Math.max(min.x, Math.min(max.x, pos.x)),
    y: pos.y,
    z: Math.max(min.z, Math.min(max.z, pos.z)),
  };
}

/** Get grid cells occupied by a placed item (footprint + rotation). */
export function getOccupiedCells(
  pos: Vec3,
  footprint: { w: number; d: number },
  rotationY: PlacementRotation
): { x: number; z: number }[] {
  const cell = gridCellFromWorld(pos);
  const cells: { x: number; z: number }[] = [];
  let w = footprint.w;
  let d = footprint.d;
  if (rotationY === 90 || rotationY === 270) {
    [w, d] = [d, w];
  }
  for (let ix = 0; ix < w; ix++) {
    for (let iz = 0; iz < d; iz++) {
      cells.push({ x: cell.x + ix, z: cell.z + iz });
    }
  }
  return cells;
}

/** Check if two cell sets overlap. */
function cellsOverlap(a: { x: number; z: number }[], b: { x: number; z: number }[]): boolean {
  const set = new Set(a.map((c) => `${c.x},${c.z}`));
  for (const c of b) {
    if (set.has(`${c.x},${c.z}`)) return true;
  }
  return false;
}

/** Check if item at pos with footprint/rotation overlaps any existing placed items. */
export function overlapsExisting(
  pos: Vec3,
  footprint: { w: number; d: number },
  rotationY: PlacementRotation,
  existing: PlacedItem[],
  excludeId?: string
): boolean {
  const candidate = getOccupiedCells(pos, footprint, rotationY);
  for (const item of existing) {
    if (excludeId && item.id === excludeId) continue;
    const catalog = getCatalogItem(item.catalogId);
    const otherFootprint = catalog?.footprint ?? { w: 1, d: 1 };
    const otherCells = getOccupiedCells(item.position, otherFootprint, item.rotationY);
    if (cellsOverlap(candidate, otherCells)) return true;
  }
  return false;
}
