/**
 * Phase 3: Placement input abstraction — single interface for desktop (mouse) and later mobile (tap).
 */

import type { Player } from 'hytopia';
import type { Entity } from 'hytopia';
import type { PointerRay } from './raycast.js';

export interface PointerPlacementInput {
  getPointerRay(player: Player, playerEntity: Entity): PointerRay;
  onPrimaryAction(callback: () => void): void;
  onSecondaryAction(callback: () => void);
  /** Call when entering build mode (e.g. register listeners). */
  start(): void;
  /** Call when exiting build mode (e.g. unregister listeners). */
  stop(): void;
}

/**
 * Desktop mouse implementation: ray from camera, primary = left click, secondary = right click.
 * Actual click handling is done by the caller (main loop) which receives input from client or
 * from world input. For now we expose getPointerRay; primary/secondary are invoked by the
 * build loop when it receives UI messages (place / delete) from client.
 */
export function createPointerPlacementInput(
  getRay: (player: Player, entity: Entity) => PointerRay
): PointerPlacementInput {
  let primaryCb: (() => void) | null = null;
  let secondaryCb: (() => void) | null = null;
  const api: PointerPlacementInput & { firePrimary(): void; fireSecondary(): void } = {
    getPointerRay: getRay,
    onPrimaryAction(cb: () => void) {
      primaryCb = cb;
    },
    onSecondaryAction(cb: () => void) {
      secondaryCb = cb;
    },
    start() {
      // Desktop: client sends place on left click; server invokes firePrimary when it receives build command.
    },
    stop() {},
    firePrimary() {
      primaryCb?.();
    },
    fireSecondary() {
      secondaryCb?.();
    },
  };
  return api;
}
