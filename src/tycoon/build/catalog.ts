/**
 * Phase 3: Build catalog — 3–5 placeable items with cost, footprint, rotation, model.
 */

import type { PlacementRotation } from '../types.js';

export interface CatalogItem {
  itemType: string;
  cost: number;
  /** Grid footprint width (x) and depth (z) in cells. */
  footprint: { w: number; d: number };
  rotationSupport: boolean;
  /** Model URI for spawn (e.g. models/structures/...). */
  modelUri: string;
}

export const BUILD_CATALOG: CatalogItem[] = [
  {
    itemType: 'floor_tile',
    cost: 10,
    footprint: { w: 1, d: 1 },
    rotationSupport: true,
    modelUri: 'models/structures/slabs/grass slab.gltf',
  },
  {
    itemType: 'wall_segment',
    cost: 25,
    footprint: { w: 1, d: 1 },
    rotationSupport: true,
    modelUri: 'models/structures/slabs/granite slab.gltf',
  },
  {
    itemType: 'table',
    cost: 50,
    footprint: { w: 2, d: 1 },
    rotationSupport: true,
    modelUri: 'models/structures/slabs/granite slab.gltf',
  },
  {
    itemType: 'chair',
    cost: 30,
    footprint: { w: 1, d: 1 },
    rotationSupport: true,
    modelUri: 'models/structures/slabs/grass flower slab.gltf',
  },
  {
    itemType: 'stove',
    cost: 100,
    footprint: { w: 1, d: 1 },
    rotationSupport: true,
    modelUri: 'models/structures/slabs/granite slab.gltf',
  },
];

export function getCatalogItem(itemType: string): CatalogItem | undefined {
  return BUILD_CATALOG.find((i) => i.itemType === itemType);
}

/** Next rotation step: 0 -> 90 -> 180 -> 270 -> 0 */
export function nextRotation(current: PlacementRotation): PlacementRotation {
  if (current === 0) return 90;
  if (current === 90) return 180;
  if (current === 180) return 270;
  return 0;
}
