/**
 * Phase 3: Build commands — client to server message types.
 */

import type { Vec3 } from '../types.js';
import type { PlacementRotation } from '../types.js';

export type BuildCommand =
  | { action: 'place'; itemType: string; position: Vec3; rotation: PlacementRotation }
  | { action: 'delete'; position?: Vec3; placedItemId?: string }
  | { action: 'rotate' };

export function isBuildCommand(data: unknown): data is BuildCommand {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  if (d.action === 'place') {
    return (
      typeof d.itemType === 'string' &&
      d.position != null &&
      typeof (d.position as Vec3).x === 'number' &&
      typeof (d.position as Vec3).z === 'number' &&
      (d.rotation === 0 || d.rotation === 90 || d.rotation === 180 || d.rotation === 270)
    );
  }
  if (d.action === 'delete') {
    return d.position != null || typeof d.placedItemId === 'string';
  }
  if (d.action === 'rotate') return true;
  return false;
}
