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
    itemType: 'table',
    cost: 50,
    footprint: { w: 2, d: 1 },
    rotationSupport: true,
    modelUri: 'models/environment/Dungeon/wooden-table.gltf',
  },
  {
    itemType: 'chair',
    cost: 30,
    footprint: { w: 1, d: 1 },
    rotationSupport: true,
    modelUri: 'models/environment/Tropical/summer-chair.gltf',
  },
  {
    itemType: 'stove',
    cost: 100,
    footprint: { w: 1, d: 1 },
    rotationSupport: true,
    modelUri: 'models/environment/Essentials/cooking-bench.gltf',
  },
  {
    itemType: 'workbench',
    cost: 75,
    footprint: { w: 1, d: 1 },
    rotationSupport: true,
    modelUri: 'models/environment/Essentials/workbench.gltf',
  },
  {
    itemType: 'trash_bin',
    cost: 20,
    footprint: { w: 1, d: 1 },
    rotationSupport: true,
    modelUri: 'models/environment/City/trash-bin.gltf',
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
