/**
 * Phase 4: Functional zones derived from placed items (not geometry).
 * Stove → cooking zone; table → seating + pickup; order zone = first table or entrance.
 */

import type { PlotState, PlacedItem, Vec3 } from '../types.js';
import type { PlotDefinition } from '../types.js';

export interface ZonePoint {
  position: Vec3;
  placedItemId: string;
}

/** Cooking zones: one per placed stove (catalogId === 'stove'). */
export function getCookingZones(plotState: PlotState): ZonePoint[] {
  const out: ZonePoint[] = [];
  for (const item of plotState.placedItems ?? []) {
    if (item.catalogId === 'stove') {
      out.push({ position: { ...item.position }, placedItemId: item.id });
    }
  }
  return out;
}

/** Seating/pickup zones: one per placed table (catalogId === 'table'). */
export function getSeatingZones(plotState: PlotState): ZonePoint[] {
  const out: ZonePoint[] = [];
  for (const item of plotState.placedItems ?? []) {
    if (item.catalogId === 'table') {
      out.push({ position: { ...item.position }, placedItemId: item.id });
    }
  }
  return out;
}

/** Single order zone: first table position, or plot entrance if no tables. */
export function getOrderZone(plotState: PlotState, plot: PlotDefinition | undefined): ZonePoint | null {
  const seats = getSeatingZones(plotState);
  if (seats.length > 0) {
    return seats[0];
  }
  if (plot) {
    return {
      position: { ...plot.entrance },
      placedItemId: '__entrance__',
    };
  }
  return null;
}

/** Whether the plot has minimum setup: at least one stove and one table. */
export function hasMinimumSetup(plotState: PlotState): boolean {
  const stoves = getCookingZones(plotState).length;
  const tables = getSeatingZones(plotState).length;
  return stoves >= 1 && tables >= 1;
}

/** Distance between two points (XZ only, for interaction range). */
export function distanceXZ(a: Vec3, b: Vec3): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

/** Find zone point (by placedItemId) in seating or cooking zones. */
export function getZoneByPlacedId(
  plotState: PlotState,
  placedItemId: string
): { kind: 'cooking' | 'seating'; position: Vec3 } | null {
  for (const z of getCookingZones(plotState)) {
    if (z.placedItemId === placedItemId) return { kind: 'cooking', position: z.position };
  }
  for (const z of getSeatingZones(plotState)) {
    if (z.placedItemId === placedItemId) return { kind: 'seating', position: z.position };
  }
  return null;
}
