/**
 * Phase 2.2: Single module router. Ensures only one module is open at a time.
 * Server-authoritative: open/close/toggle update state; caller (main) wires build mode and pushState.
 * Phase 2.4: Keyboard shortcuts route through main (keybind action → getModuleForKey → toggle/close here).
 */

import type { Player } from 'hytopia';
import type { ModuleKind } from '../../types.js';

const activeModuleMap = new Map<string, ModuleKind>();

export type ModuleKindValue = ModuleKind;

export function getActiveModule(player: Player): ModuleKind {
  return activeModuleMap.get(player.id) ?? 'NONE';
}

/** Open a module (closes any other). Returns new active module. */
export function open(player: Player, module: Exclude<ModuleKind, 'NONE'>): ModuleKind {
  const previous = activeModuleMap.get(player.id) ?? 'NONE';
  activeModuleMap.set(player.id, module);
  return module;
}

/** Close current module. Returns new active module (NONE). */
export function close(player: Player): ModuleKind {
  activeModuleMap.set(player.id, 'NONE');
  return 'NONE';
}

/** Toggle: if module is active, close; else open it (close others). */
export function toggle(player: Player, module: Exclude<ModuleKind, 'NONE'>): ModuleKind {
  const current = activeModuleMap.get(player.id) ?? 'NONE';
  if (current === module) {
    activeModuleMap.set(player.id, 'NONE');
    return 'NONE';
  }
  activeModuleMap.set(player.id, module);
  return module;
}

/** Clear on leave. */
export function clearModule(playerId: string): void {
  activeModuleMap.delete(playerId);
}
