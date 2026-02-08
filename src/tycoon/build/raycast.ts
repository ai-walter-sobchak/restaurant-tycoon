/**
 * Phase 3/4: Raycast for placement hit.
 * Server: ray from camera look direction (origin at player entity; no screen cursor API on server).
 * Client can send tap/click for mobile; server uses camera.facingDirection for ghost/placement.
 * Fallback: intersect with horizontal plane at groundY if physics raycast misses.
 */

import type { Player } from 'hytopia';
import type { Entity } from 'hytopia';
import type { World } from 'hytopia';
import type { Vec3 } from '../types.js';

export interface PointerRay {
  origin: Vec3;
  direction: Vec3;
}

const RAY_LENGTH = 50;

/**
 * Screen-to-world equivalent on server: ray from player position in camera facing direction.
 * (No cursor position on server; camera.facingDirection is the look direction. Ghost follows this ray.)
 */
export function getPointerRayFromPlayer(player: Player, playerEntity: Entity): PointerRay {
  const pos = playerEntity.position;
  const dir = player.camera.facingDirection;
  const origin: Vec3 = { x: pos.x, y: pos.y, z: pos.z };
  const len = Math.sqrt(dir.x * dir.x + dir.y * dir.y + dir.z * dir.z) || 1;
  const direction: Vec3 = {
    x: dir.x / len,
    y: dir.y / len,
    z: dir.z / len,
  };
  return { origin, direction };
}

/**
 * Intersect ray with horizontal plane y = groundY. Returns hit point or null if no intersection.
 * When the ray is parallel to the plane (e.g. looking level), returns the point on the plane
 * directly below the ray origin so the ghost still has a placement target.
 */
export function raycastPlane(ray: PointerRay, groundY: number): Vec3 | null {
  const { origin, direction } = ray;
  const absDy = Math.abs(direction.y);
  if (absDy < 1e-6) {
    return { x: origin.x, y: groundY, z: origin.z };
  }
  const t = (groundY - origin.y) / direction.y;
  if (t < 0 || t > RAY_LENGTH) {
    return { x: origin.x, y: groundY, z: origin.z };
  }
  return {
    x: origin.x + t * direction.x,
    y: groundY,
    z: origin.z + t * direction.z,
  };
}

/** If physics hit is above this much over groundY, treat as wall and use plane fallback. */
const FLOOR_VS_WALL_THRESHOLD = 0.5;

/**
 * Cast ray in world simulation; return hit point or null.
 * Prefer map floor: if groundY is provided, treat hits above (groundY + threshold) as walls and use plane at groundY.
 * If physics raycast misses, use plane intersection at groundY so ghost still shows.
 */
export function raycastBuildSurface(
  world: World,
  ray: PointerRay,
  options?: { groundY?: number }
): Vec3 | null {
  const groundY = options?.groundY;
  let hit: { hitPoint?: { x: number; y: number; z: number } } | null = null;
  try {
    const sim = world.simulation;
    if (sim?.raycast) {
      hit = sim.raycast(
        ray.origin as import('hytopia').RAPIER.Vector3,
        ray.direction as import('hytopia').RAPIER.Vector3,
        RAY_LENGTH
      );
    }
  } catch (_) {
    hit = null;
  }
  if (hit?.hitPoint) {
    const p = hit.hitPoint;
    const pt = { x: p.x, y: p.y, z: p.z };
    if (groundY != null && pt.y > groundY + FLOOR_VS_WALL_THRESHOLD) {
      const planeHit = raycastPlane(ray, groundY);
      return planeHit ?? pt;
    }
    return pt;
  }
  if (groundY != null) {
    const planeHit = raycastPlane(ray, groundY);
    return planeHit ?? { x: ray.origin.x, y: groundY, z: ray.origin.z };
  }
  return null;
}
