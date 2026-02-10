/**
 * Phase 2: Build mode toggle. Mode state machine (PLAY | BUILD), movement lock, cursor/camera.
 * No placement logic yet.
 */

import type { Player } from 'hytopia';
import type { PlayerEntity } from 'hytopia';
import type { PlayerMode } from './types.js';
import { getPlayerProfile, updatePlayerProfile } from './persistence/playerProfile.js';
import BuildController from './build/BuildModeController.js';

const modeMap = new Map<string, PlayerMode>();

export function getPlayerMode(player: Player): PlayerMode {
  return modeMap.get(player.id) ?? 'PLAY';
}

export function setPlayerMode(player: Player, mode: PlayerMode): void {
  modeMap.set(player.id, mode);
  updatePlayerProfile(player, { lastMode: mode });
}

const DEV = typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production';

/**
 * Enter BUILD: disable movement; keep pointer locked so player can look around and see the ghost.
 */
export function enterBuildMode(player: Player, entity: PlayerEntity): void {
  setPlayerMode(player, 'BUILD');
  entity.setTickWithPlayerInputEnabled(false);
  player.ui.lockPointer(true);
  BuildController.enterBuildMode(player, entity, null);
  if (DEV) console.log('[Build] enterBuildMode', player.id);
}

/**
 * Exit BUILD: restore movement and pointer lock.
 */
export function exitBuildMode(player: Player, entity: PlayerEntity): void {
  setPlayerMode(player, 'PLAY');
  entity.setTickWithPlayerInputEnabled(true);
  player.ui.lockPointer(true);
  BuildController.exitBuildMode(player, entity, 'manual');
  if (DEV) console.log('[Build] exitBuildMode', player.id);
}

/**
 * Clear mode on leave (call from main on LEFT_WORLD).
 */
export function clearPlayerMode(playerId: string): void {
  modeMap.delete(playerId);
  BuildController.cleanupPlayer(playerId);
}
