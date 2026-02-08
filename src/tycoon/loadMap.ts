/**
 * Load and prepare world map for World.loadMap.
 * Filters out entities whose modelUri asset is missing (log warning, skip entity, do not crash).
 * Resolves assets from project assets/ and from @hytopia.com/assets (SDK default assets).
 * Supports "cozy v1" format: { name, version, blocks: [{ type, x, y, z }] } and converts to WorldMap.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { WorldMap } from 'hytopia';

/** Raw map JSON may include a version field; WorldMap does not. */
export interface RawWorldMap extends WorldMap {
  version?: string;
}

/** Cozy v1 map: blocks as array with type names. */
export interface CozyV1Map {
  name?: string;
  version?: string;
  blocks: Array<{ type: string; x: number; y: number; z: number }>;
}

/** Placeholder map (no blocks): e.g. diner-rectangular-starter-v2 with metadata only. */
export interface PlaceholderMap {
  name?: string;
  version?: string;
  description?: string;
  placeholder?: boolean;
  blocks?: undefined;
}

/** Default block type texture mapping for cozy type names (SDK block texture paths). */
const COZY_TYPE_TO_BLOCK: Record<
  string,
  { name: string; textureUri: string; isMultiTexture?: boolean }
> = {
  stone_floor: { name: 'cobblestone', textureUri: 'blocks/cobblestone.png' },
  stone_path: { name: 'cobblestone', textureUri: 'blocks/cobblestone.png' },
  stone_patio: { name: 'cobblestone', textureUri: 'blocks/cobblestone.png' },
  grass: { name: 'grass-block', textureUri: 'blocks/grass-block', isMultiTexture: true },
  flower: { name: 'grass-flower-block', textureUri: 'blocks/grass-flower-block', isMultiTexture: true },
  bench: { name: 'oak-log', textureUri: 'blocks/oak-log', isMultiTexture: true },
  tree: { name: 'oak-leaves', textureUri: 'blocks/oak-leaves.png' },
  wall: { name: 'bricks', textureUri: 'blocks/bricks.png' },
  plaster_wall: { name: 'bricks', textureUri: 'blocks/bricks.png' },
  stone: { name: 'stone', textureUri: 'blocks/stone.png' },
  gravel: { name: 'sand', textureUri: 'blocks/sand.png' },
  doorway: { name: 'bricks', textureUri: 'blocks/bricks.png' },
  window: { name: 'bricks', textureUri: 'blocks/bricks.png' },
  wood_beam: { name: 'oak-log', textureUri: 'blocks/oak-log', isMultiTexture: true },
  wood_table: { name: 'oak-log', textureUri: 'blocks/oak-log', isMultiTexture: true },
  patio_table: { name: 'oak-log', textureUri: 'blocks/oak-log', isMultiTexture: true },
  chair: { name: 'oak-log', textureUri: 'blocks/oak-log', isMultiTexture: true },
  counter_base: { name: 'cobblestone', textureUri: 'blocks/cobblestone.png' },
  prep_table: { name: 'cobblestone', textureUri: 'blocks/cobblestone.png' },
  oven: { name: 'bricks', textureUri: 'blocks/bricks.png' },
  stove: { name: 'bricks', textureUri: 'blocks/bricks.png' },
  sink: { name: 'bricks', textureUri: 'blocks/bricks.png' },
  roof_wood: { name: 'oak-log', textureUri: 'blocks/oak-log', isMultiTexture: true },
  vehicle_car: { name: 'stone', textureUri: 'blocks/stone.png' },
  path_stone: { name: 'cobblestone', textureUri: 'blocks/cobblestone.png' },
  bush: { name: 'oak-leaves', textureUri: 'blocks/oak-leaves.png' },
  stool: { name: 'oak-log', textureUri: 'blocks/oak-log', isMultiTexture: true },
  wood_trim: { name: 'oak-log', textureUri: 'blocks/oak-log', isMultiTexture: true },
};

function isCozyV1Map(raw: unknown): raw is CozyV1Map {
  return (
    raw != null &&
    typeof raw === 'object' &&
    Array.isArray((raw as CozyV1Map).blocks) &&
    (raw as CozyV1Map).blocks.length > 0 &&
    typeof (raw as CozyV1Map).blocks[0]?.type === 'string'
  );
}

/** Placeholder map: has placeholder: true and no (or empty) blocks. */
function isPlaceholderMap(raw: unknown): raw is PlaceholderMap {
  if (raw == null || typeof raw !== 'object') return false;
  const o = raw as { placeholder?: boolean; blocks?: unknown };
  if (!o.placeholder) return false;
  if (o.blocks != null && Array.isArray(o.blocks) && o.blocks.length > 0) return false;
  return true;
}

/** Minimal rectangular floor for placeholder maps (e.g. 32x24 at y=0). */
const PLACEHOLDER_FLOOR_ID = 1;
function createPlaceholderWorldMap(): RawWorldMap {
  const blockTypes = [
    { id: PLACEHOLDER_FLOOR_ID, name: 'cobblestone', textureUri: 'blocks/cobblestone.png', isCustom: false, isMultiTexture: false },
  ];
  const blocks: Record<string, number> = {};
  const w = 32;
  const d = 24;
  for (let x = 0; x < w; x++) {
    for (let z = 0; z < d; z++) {
      blocks[`${x},0,${z}`] = PLACEHOLDER_FLOOR_ID;
    }
  }
  return { version: '2.0.0', blockTypes, blocks, entities: {} };
}

/**
 * Convert cozy v1 map (blocks array with type names) to RawWorldMap (blockTypes + blocks object).
 */
export function convertCozyMapToWorldMap(cozy: CozyV1Map): RawWorldMap {
  const typeToId = new Map<string, number>();
  const blockTypes: Array<{ id: number; name: string; textureUri: string; isCustom: boolean; isMultiTexture: boolean }> = [];
  let nextId = 1;
  for (const b of cozy.blocks) {
    if (!typeToId.has(b.type)) {
      const def = COZY_TYPE_TO_BLOCK[b.type] ?? {
        name: b.type,
        textureUri: 'blocks/stone.png',
      };
      typeToId.set(b.type, nextId);
      blockTypes.push({
        id: nextId,
        name: def.name,
        textureUri: def.textureUri,
        isCustom: false,
        isMultiTexture: !!def.isMultiTexture,
      });
      nextId++;
    }
  }
  const blocks: Record<string, number> = {};
  for (const b of cozy.blocks) {
    const id = typeToId.get(b.type);
    if (id != null) blocks[`${b.x},${b.y},${b.z}`] = id;
  }
  return {
    version: cozy.version ?? '2.0.0',
    blockTypes,
    blocks,
    entities: {},
  };
}

/** Check if a model URI exists in project assets or in @hytopia.com/assets (SDK default assets). */
function assetExists(uri: string, projectAssetsDir: string): boolean {
  const projectPath = path.join(projectAssetsDir, uri);
  if (fs.existsSync(projectPath)) return true;
  const cwd = process.cwd();
  const sdkPath = path.join(cwd, 'node_modules', '@hytopia.com', 'assets', uri);
  try {
    return fs.existsSync(sdkPath);
  } catch {
    return false;
  }
}

/**
 * Returns a WorldMap safe for loadMap: only entities with existing modelUri are included.
 * If raw is in cozy v1 format (blocks array with type names), converts it first.
 * Looks in assetsDir (default process.cwd()/assets) then in node_modules/@hytopia.com/assets.
 * If an entity's modelUri is not found in either, logs a warning and omits it.
 */
export function prepareMapForLoad(
  raw: RawWorldMap | CozyV1Map | PlaceholderMap,
  assetsDir?: string
): WorldMap {
  let normalized: RawWorldMap;
  if (isPlaceholderMap(raw)) {
    normalized = createPlaceholderWorldMap();
  } else if (isCozyV1Map(raw)) {
    normalized = convertCozyMapToWorldMap(raw);
  } else {
    normalized = raw as RawWorldMap;
  }
  const dir = assetsDir ?? path.join(process.cwd(), 'assets');
  const map: WorldMap = {
    blockTypes: normalized.blockTypes,
    blocks: normalized.blocks,
    entities: normalized.entities,
  };

  if (!normalized.entities || typeof normalized.entities !== 'object') {
    return map;
  }

  const filtered: Record<string, unknown> = {};
  let skipped = 0;
  for (const [pos, entity] of Object.entries(normalized.entities)) {
    const opts = entity as { modelUri?: string; name?: string };
    const uri = opts?.modelUri;
    if (!uri || typeof uri !== 'string') {
      filtered[pos] = entity;
      continue;
    }
    try {
      if (assetExists(uri, dir)) {
        filtered[pos] = entity;
      } else {
        console.warn('[loadMap] Skipping entity at', pos, '- asset not found:', uri);
        skipped++;
      }
    } catch {
      filtered[pos] = entity;
    }
  }
  if (skipped > 0) {
    console.warn('[loadMap] Skipped', skipped, 'entity/entities with missing modelUri.');
  }
  map.entities = filtered as WorldMap['entities'];
  return map;
}
