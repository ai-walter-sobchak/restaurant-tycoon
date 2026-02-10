/**
 * Phase 1: Plot assignment + persistence + spawn routing.
 * No build mode, no NPCs, no UI.
 * - 16 plots; on join assign deterministically, persist ownership and player->plot.
 * - Spawn at plot.spawn or lobby; track playerId -> { playerEntity, plotId }.
 * - Capacity: no plots -> lobby + "Server is full (no plots available)."
 */

import { DefaultPlayerEntity, PlayerEvent, PlayerUIEvent, WorldLoopEvent, PlayerManager } from 'hytopia';
import type { World, Player, Entity } from 'hytopia';
import type { PlayerEntity } from 'hytopia';
import restaurantMapRaw from '../../assets/restaurant-map.diner-rectangular-starter-v3.json';
import { prepareMapForLoad } from './loadMap.js';
import { pushHUDState, handleHUDData } from './ui/HUDRoot.js';
import {
  getPlayerMode,
  enterBuildMode,
  exitBuildMode,
  clearPlayerMode,
} from './buildMode.js';
import {
  getActiveModule,
  open as moduleOpen,
  close as moduleClose,
  toggle as moduleToggle,
  clearModule,
} from './ui/modules/ModuleRouter.js';
import { PLOTS, getPlot, isPointInPlot } from './plots.js';
import { spawnPlotBoundaryMarkers } from './plotMarkers.js';
import {
  getPlayerProfile,
  ensurePlayerProfile,
  updatePlayerProfile,
} from './persistence/playerProfile.js';
import { MONEY_CHEAT_CODE } from './config.js';
import { getPlotMeta, getPlotState, setPlotState, getDefaultPlotState } from './persistence/plotStore.js';
import {
  getCachedPlotMeta,
  setCachedPlotMeta,
  registerPlotMetaInCache,
  flushAllDirty,
} from './persistence/cache.js';
import {
  getCachedPlotState,
  setCachedPlotState,
  registerPlotStateInCache,
  flushAllDirtyState,
} from './persistence/plotStateCache.js';
import { PLOT_META_SCHEMA_VERSION, type PlotId, type PlotMeta, type Vec3 } from './types.js';
import { LOBBY_SPAWN, SPAWN_HEIGHT_OFFSET, SPAWN_NUDGE_UP } from './config.js';
import { getPointerRayFromPlayer } from './build/raycast.js';
import { raycastBuildSurface } from './build/raycast.js';
import { snapToGridPlotRelative, clampToPlot, overlapsExisting } from './build/grid.js';
import { getCatalogItem, nextRotation, BUILD_CATALOG } from './build/catalog.js';
import { getBuildState, setBuildState, clearBuildState } from './build/buildState.js';
import { updateGhost, removeGhost, getGhostEntity } from './build/ghost.js';
import {
  handlePlace,
  handleDelete,
  findPlacedItemAt,
  rebuildPlotEntities,
} from './build/serverHandlers.js';
import type { BuildCatalogItemState, BuildSelectionState, BuildDebugState } from './ui/useHUDState.js';
import { getModuleForKey } from './input/KeybindManager.js';
import type { ModuleKind } from './types.js';
import { clearSimState, getSimState } from './sim/state.js';
import { runSimTick } from './sim/loop.js';
import { handleInteract, clearCarriedOnLeave } from './sim/interact.js';
import { hasMinimumSetup } from './sim/zones.js';
import { runNPCSpawnerTick, cleanupNPCs, clearAllNPCs } from './sim/npc/NPCSpawner.js';
import { updateNPCMovement } from './sim/npc/NPCController.js';
import { despawnNPCEntity } from './sim/npc/NPCEntity.js';
import BuildController from './build/BuildModeController.js';

const DEV = typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production';

/** In-memory: playerId -> { playerEntity, plotId } for later phases. */
const playerMap = new Map<string, { playerEntity: Entity; plotId: PlotId | null }>();

/** Command handler registry: command name -> handler function */
const commandHandlers = new Map<string, (player: Player, args: string[]) => void | Promise<void>>();

/** Tick counter per player for throttled BUILD HUD push (so client gets ghost/snapped state). */
const buildTickCount = new Map<string, number>();
const BUILD_PUSH_INTERVAL_TICKS = 5;

/** Sim tick throttle: last run time (ms) per plot. */
const lastSimTickByPlot = new Map<PlotId, number>();
const SIM_TICK_INTERVAL_MS = 500;

/** NPC tick tracking: last run time (ms) per plot. */
const lastNPCTickByPlot = new Map<PlotId, number>();
const NPC_TICK_INTERVAL_MS = 33; // ~30 fps for NPC movement

function defaultPlotMeta(plotId: PlotId): PlotMeta {
  return {
    schemaVersion: PLOT_META_SCHEMA_VERSION,
    updatedAt: Date.now(),
    ownerId: null,
    ownerName: null,
    claimedAt: null,
    lastActiveAt: null,
  };
}

async function loadOrGetPlotMeta(plotId: PlotId): Promise<PlotMeta> {
  const cached = getCachedPlotMeta(plotId);
  if (cached) return cached;
  const loaded = await getPlotMeta(plotId, 0);
  const meta = loaded ?? defaultPlotMeta(plotId);
  registerPlotMetaInCache(plotId, meta);
  return meta;
}

export type AssignResult =
  | { plotId: PlotId; kind: 'reattach' }
  | { plotId: PlotId; kind: 'claim' }
  | { plotId: null; kind: 'full' };

/** Deterministic plot assignment: reattach if profile.plotId is valid and meta.ownerId match; else claim first unowned; else full. */
async function assignPlotOnJoin(player: Player): Promise<AssignResult> {
  const profile = ensurePlayerProfile(player);
  const now = Date.now();

  if (profile.plotId !== null && getPlot(profile.plotId)) {
    const meta = await loadOrGetPlotMeta(profile.plotId);
    if (meta.ownerId === player.id) {
      setCachedPlotMeta(profile.plotId, {
        ...meta,
        lastActiveAt: now,
        updatedAt: now,
      });
      return { plotId: profile.plotId, kind: 'reattach' };
    }
  }

  for (let i = 0; i < PLOTS.length; i++) {
    const plotId = i as PlotId;
    const meta = await loadOrGetPlotMeta(plotId);
    if (meta.ownerId === null) {
      const updated: PlotMeta = {
        schemaVersion: PLOT_META_SCHEMA_VERSION,
        updatedAt: now,
        ownerId: player.id,
        ownerName: player.username ?? null,
        claimedAt: now,
        lastActiveAt: now,
      };
      setCachedPlotMeta(plotId, updated);
      updatePlayerProfile(player, { plotId });
      return { plotId, kind: 'claim' };
    }
  }

  updatePlayerProfile(player, { plotId: null });
  return { plotId: null, kind: 'full' };
}

export async function initTycoon(world: World): Promise<void> {
  const worldMap = prepareMapForLoad(restaurantMapRaw as import('./loadMap.js').RawWorldMap);
  world.loadMap(worldMap);

  await spawnPlotBoundaryMarkers(world);

  for (let i = 0; i < PLOTS.length; i++) {
    registerPlotMetaInCache(i as PlotId, defaultPlotMeta(i as PlotId));
  }
  for (let i = 0; i < PLOTS.length; i++) {
    const plotId = i as PlotId;
    const loaded = await getPlotMeta(plotId, 0);
    if (loaded) registerPlotMetaInCache(plotId, loaded);
  }

  for (let i = 0; i < PLOTS.length; i++) {
    const plotId = i as PlotId;
    let state = await getPlotState(plotId, 0);
    if (!state) {
      state = getDefaultPlotState(plotId);
      await setPlotState(plotId, state);
    }
    registerPlotStateInCache(plotId, state);
    if (state.placedItems?.length) {
      await rebuildPlotEntities(world, plotId);
    }
  }

  function getBuildCatalogForHUD(): BuildCatalogItemState[] {
    return BUILD_CATALOG.map((c) => ({
      itemType: c.itemType,
      cost: c.cost,
      footprint: c.footprint,
    }));
  }

  function getBuildSelectionForHUD(playerId: string): BuildSelectionState {
    const s = getBuildState(playerId);
    return { itemType: s.selectedItemType, rotation: s.placementRotation };
  }

  function pushHUDStateBuild(player: Player): void {
    if (getActiveModule(player) === 'BUILD') {
      let buildDebug: BuildDebugState | null = null;
      const s = getBuildState(player.id);
      const ghost = getGhostEntity(player.id);
      // Always include debug info so HUD can show targeted refund (useful while testing).
      buildDebug = {
        selectedItemType: s.selectedItemType,
        buildModeActive: getPlayerMode(player) === 'BUILD',
        lastRaycastHit: s.lastRaycastHit ? { ...s.lastRaycastHit } : null,
        snappedPos: s.lastGhostPosition ? { ...s.lastGhostPosition } : null,
        ghostSpawned: !!(ghost?.isSpawned),
        lastPlaceAttempt: s.lastPlaceAttempt ?? null,
      };

      // If there's a targeted placed item for deletion, compute the refund and include it in debug HUD.
      try {
        const targetId = s.lastDeleteTargetId ?? null;
        buildDebug.targetedPlacedItemId = targetId;
        buildDebug.targetedRefund = null;
        if (targetId && player && player.id != null) {
          const plotId = getPlayerProfile(player)?.plotId ?? null;
          if (plotId != null) {
            const plotState = getCachedPlotState(plotId);
            const placed = plotState?.placedItems.find((p) => p.id === targetId) ?? null;
            if (placed) {
              const catalog = getCatalogItem(placed.catalogId);
              if (catalog) buildDebug.targetedRefund = Math.floor(catalog.cost * 0.5);
            }
          }
        }
      } catch (_) {}
      pushHUDState(player, {
        buildCatalog: getBuildCatalogForHUD(),
        buildSelection: getBuildSelectionForHUD(player.id),
        buildDebug,
      });
    } else {
      pushHUDState(player);
    }
  }

  function doModuleClose(
    player: Player,
    entry: { playerEntity: Entity; plotId: PlotId | null } | undefined
  ): void {
    const was = getActiveModule(player);
    const modeBefore = getPlayerMode(player);
    moduleClose(player);
    if (was === 'BUILD' && entry) {
      exitBuildMode(player, entry.playerEntity as PlayerEntity);
      BuildController.exitBuildMode(player, entry.playerEntity as PlayerEntity, 'moduleClose');
      buildTickCount.delete(player.id);
    }
    pushHUDStateBuild(player);
    if (DEV) console.log('[Keybind] doModuleClose: was', was, 'modeBefore', modeBefore, '→ activeModule', getActiveModule(player), 'mode', getPlayerMode(player));
  }

  function doModuleToggle(
    player: Player,
    entry: { playerEntity: Entity; plotId: PlotId | null } | undefined,
    module: Exclude<ModuleKind, 'NONE'>
  ): void {
    const current = getActiveModule(player);
    if (module === 'BUILD') {
      const next = moduleToggle(player, 'BUILD');
      if (next === 'BUILD') {
        const profile = getPlayerProfile(player);
        if (profile?.plotId == null) {
          moduleClose(player);
          pushHUDStateBuild(player);
          world.chatManager.sendPlayerMessage(player, 'You need a plot to build.', 'FF6666');
          if (DEV) console.log('[Keybind] BUILD rejected (no plot)');
          return;
        }
        if (entry) {
          enterBuildMode(player, entry.playerEntity as PlayerEntity);
        }
        pushHUDStateBuild(player);
        if (DEV) console.log('[Keybind] BUILD opened');
      } else {
        if (entry) {
          exitBuildMode(player, entry.playerEntity as PlayerEntity);
          buildTickCount.delete(player.id);
        }
        pushHUDStateBuild(player);
        if (DEV) console.log('[Keybind] BUILD closed');
      }
      return;
    }
    if (
      module === 'SHOP' ||
      module === 'RESTAURANT' ||
      module === 'ALBUM' ||
      module === 'REWARDS' ||
      module === 'DAILY_REWARDS' ||
      module === 'SEASON'
    ) {
      if (current === 'BUILD' && entry) {
        exitBuildMode(player, entry.playerEntity as PlayerEntity);
        BuildController.exitBuildMode(player, entry.playerEntity as PlayerEntity, 'moduleSwitch');
        buildTickCount.delete(player.id);
      }
      moduleToggle(player, module);
      pushHUDStateBuild(player);
      if (DEV) console.log('[Keybind] module toggled', module, '→ activeModule now', getActiveModule(player));
    }
  }

  world.loop.on(WorldLoopEvent.TICK_END, () => {
    const players = world.playerManager?.getConnectedPlayersByWorld?.(world) ?? PlayerManager.instance?.getConnectedPlayersByWorld?.(world) ?? [];
    for (const player of players) {
      const entry = playerMap.get(player.id);
      if (!entry) continue;
      // delegate build tick handling to controller (centralized, tick-driven preview)
      try {
        BuildController.tickForPlayer(world, { player, entity: entry.playerEntity, plotId: entry.plotId }, buildTickCount, pushHUDStateBuild, BUILD_PUSH_INTERVAL_TICKS);
      } catch (e) {
        if (DEV) console.log('[BuildController] tick error', e);
      }
    }
    const now = Date.now();
    for (const player of players) {
      const entry = playerMap.get(player.id);
      if (!entry || entry.plotId == null) continue;
      const plotId = entry.plotId;
      const state = getCachedPlotState(plotId);
      if (!state?.restaurantSettings.isOpen || state.ownerId !== player.id) continue;
      const last = lastSimTickByPlot.get(plotId) ?? 0;
      if (now - last < SIM_TICK_INTERVAL_MS) continue;
      lastSimTickByPlot.set(plotId, now);
      const profile = ensurePlayerProfile(player);
      runSimTick(plotId, state, now, state.ownerId, profile.unlocks);
      pushHUDStateBuild(player);
    }

    // NPC spawner and movement tick (higher frequency than sim tick for smooth movement)
    for (const player of players) {
      const entry = playerMap.get(player.id);
      if (!entry || entry.plotId == null) continue;
      const plotId = entry.plotId;
      const state = getCachedPlotState(plotId);
      if (!state?.restaurantSettings.isOpen || state.ownerId !== player.id) continue;
      const sim = getSimState(plotId);
      const plot = getPlot(plotId);
      
      // Run NPC spawner (lower frequency)
      const lastSpawner = lastNPCTickByPlot.get(plotId) ?? 0;
      if (now - lastSpawner >= 100) { // Spawn tick every 100ms
        lastNPCTickByPlot.set(plotId, now);
        runNPCSpawnerTick(world, state, sim, now, plot?.entrance, plot?.bounds.max);
      }

      // Update NPC movement (every frame, delta-time based)
      const npcToRemove: string[] = [];
      for (const [npcId, npc] of sim.npcs.entries()) {
        const entity = world.entities?.get(npc.entityId);
        if (!entity?.isSpawned) {
          npcToRemove.push(npcId);
          continue;
        }
        const deltaTimeMs = NPC_TICK_INTERVAL_MS; // Use fixed delta for consistency
        const { arrived } = updateNPCMovement(npc, entity, deltaTimeMs);
        if (arrived) {
          sim.lastArrivedNpcId = npcId;
        }
      }
      
      // Clean up NPCs that have aged beyond arrival delay
      const cleaned = cleanupNPCs(sim, now);
      for (const npcId of cleaned) {
        const npc = sim.npcs.get(npcId) ?? { debugName: 'unknown', entityId: 0 };
        const entity = world.entities?.get(npc.entityId);
        if (entity) despawnNPCEntity(entity, npcId, npc.debugName);
        npcToRemove.push(npcId);
      }
      
      // Remove dead entities
      for (const npcId of npcToRemove) {
        sim.npcs.delete(npcId);
      }
    }
  });

  world.on(PlayerEvent.JOINED_WORLD, async ({ player }) => {
    console.log('[Tycoon] join', player.id, player.username);

    const result = await assignPlotOnJoin(player);

    if (result.kind === 'reattach') {
      console.log('[Tycoon] reattach', player.id, result.plotId);
    } else if (result.kind === 'claim') {
      console.log('[Tycoon] claim', player.id, result.plotId);
    } else {
      console.log('[Tycoon] full', player.id);
    }

    const plot = result.plotId !== null ? getPlot(result.plotId) : null;
    const baseSpawn = plot ? plot.spawn : LOBBY_SPAWN;
    const nudge = plot ? SPAWN_NUDGE_UP : 0;
    const spawnPos = {
      x: baseSpawn.x,
      y: baseSpawn.y + SPAWN_HEIGHT_OFFSET + nudge,
      z: baseSpawn.z,
    };

    const playerEntity = new DefaultPlayerEntity({ player, name: 'Player' });
    playerEntity.spawn(world, spawnPos);
    player.camera.setAttachedToEntity(playerEntity);
    playerMap.set(player.id, { playerEntity, plotId: result.plotId });
    player.ui.load('ui/index.html');
    player.ui.on(PlayerUIEvent.DATA, async (payload: { playerUI: { player: Player }; data: unknown }) => {
      const player = payload.playerUI.player;
      const data = payload.data as { zone?: string; action?: string; module?: string; key?: string; itemType?: string; position?: { x?: number; y?: number; z?: number }; placedItemId?: string } | undefined;
      const entry = playerMap.get(player.id);

      if (data?.action === 'moduleClose') {
        doModuleClose(player, entry);
        console.log('[Tycoon] module closed', player.id);
        return;
      }
      if (data?.action === 'keybind' && typeof data?.key === 'string') {
        const key = data.key;
        const action = getModuleForKey(key);
        if (DEV) {
          const activeBefore = getActiveModule(player);
          const modeBefore = getPlayerMode(player);
          console.log('[Keybind] key', key, '→', action, '| activeModule before', activeBefore, '| mode before', modeBefore);
        }
        if (action === 'close') {
          doModuleClose(player, entry);
          if (DEV) console.log('[Keybind] after close: activeModule', getActiveModule(player), '| mode', getPlayerMode(player));
          return;
        }
        if (action) {
          doModuleToggle(player, entry, action);
          if (DEV) console.log('[Keybind] after toggle: activeModule', getActiveModule(player), '| mode', getPlayerMode(player));
          return;
        }
        return;
      }
      if (data?.action === 'toggleModule' && data?.module) {
        const module = data.module as Exclude<ModuleKind, 'NONE'>;
        doModuleToggle(player, entry, module);
        console.log('[Tycoon] toggleModule', player.id, module);
        return;
      }
      if (data?.action === 'buildSelectItem' && typeof data?.itemType === 'string') {
        if (getActiveModule(player) !== 'BUILD') return;
        BuildController.selectItem(player, data.itemType);
        if (DEV) console.log('[Build] setSelectedItem', data.itemType);
        pushHUDStateBuild(player);
        return;
      }
      if (data?.action === 'buildRotate') {
        if (getActiveModule(player) !== 'BUILD') return;
        BuildController.rotateSelection(player);
        pushHUDStateBuild(player);
        return;
      }
      if (data?.action === 'buildPlace') {
        if (getActiveModule(player) !== 'BUILD' || entry?.plotId == null) {
          console.log('[Main] buildPlace ignored from', player.id, 'activeModule=', getActiveModule(player), 'plotId=', entry?.plotId);
          return;
        }
        console.log('[Main] buildPlace received from', player.id);
        const result = await BuildController.attemptPlace(world, player, { player, entity: entry.playerEntity as Entity, plotId: entry.plotId });
        if (!result.ok) {
          world.chatManager.sendPlayerMessage(player, result.error ?? 'Place failed.', 'FF6666');
          if (DEV) console.log('[Build] place rejected', result.error);
        } else {
          world.chatManager.sendPlayerMessage(player, 'Placed.', '00FF00');
          if (DEV) console.log('[Build] place accepted');
        }
        pushHUDStateBuild(player);
        return;
      }
      if (data?.action === 'buildDelete') {
        if (getActiveModule(player) !== 'BUILD' || entry?.plotId == null) return;
        const plotId = entry.plotId;
        let placedItemId: string | undefined = typeof data?.placedItemId === 'string' ? data?.placedItemId : undefined;
        if (!placedItemId && data?.position && typeof data.position === 'object') {
          const pos = data.position as { x?: number; y?: number; z?: number };
          if (typeof pos.x === 'number' && typeof pos.z === 'number') {
            const at = findPlacedItemAt(plotId, { x: pos.x, y: pos.y ?? 0, z: pos.z });
            placedItemId = at?.id;
          }
        }
        const res = await BuildController.attemptDelete(world, player, { player, entity: entry.playerEntity as Entity, plotId: entry.plotId }, placedItemId);
        if (res == null) {
          pushHUDStateBuild(player);
          return;
        }
        if (res.ok) {
          world.chatManager.sendPlayerMessage(player, res.refund ? `Deleted. Refund $${res.refund}.` : 'Deleted.', '00FF00');
        } else {
          world.chatManager.sendPlayerMessage(player, res.error ?? 'Delete failed.', 'FF6666');
        }
        pushHUDStateBuild(player);
        return;
      }
      if (data?.action === 'restaurantToggleOpen') {
        if (!entry || entry.plotId == null) {
          world.chatManager.sendPlayerMessage(player, 'You need a plot to open a restaurant.', 'FF6666');
          pushHUDStateBuild(player);
          return;
        }
        const plotId = entry!.plotId;
        const plotState = getCachedPlotState(plotId);
        const profile = ensurePlayerProfile(player);
        if (!plotState || profile.plotId !== plotId) {
          pushHUDStateBuild(player);
          return;
        }
        const opening = !plotState.restaurantSettings.isOpen;
        if (opening && !hasMinimumSetup(plotState)) {
          world.chatManager.sendPlayerMessage(player, 'Place at least one stove and one table, then open.', 'FFAA00');
          pushHUDStateBuild(player);
          return;
        }
        setCachedPlotState(plotId, {
          ...plotState,
          ownerId: plotState.ownerId ?? player.id,
          restaurantSettings: { ...plotState.restaurantSettings, isOpen: opening },
        });
        updatePlayerProfile(player, { restaurantOpen: opening });
        if (!opening) {
          clearSimState(plotId);
          const sim = getSimState(plotId);
          clearAllNPCs(sim);
        }
        world.chatManager.sendPlayerMessage(player, opening ? 'Restaurant is open!' : 'Restaurant closed.', opening ? '00FF00' : 'AAAAAA');
        pushHUDStateBuild(player);
        return;
      }
      if (data?.action === 'interact') {
        if (!entry || entry.plotId == null) {
          pushHUDStateBuild(player);
          return;
        }
        const pos = entry!.playerEntity.position;
        const result = handleInteract(player, entry!.plotId, { x: pos.x, y: pos.y, z: pos.z });
        world.chatManager.sendPlayerMessage(player, result.message, result.ok ? '00FF00' : 'FFAA00');
        pushHUDStateBuild(player);
        return;
      }
      if (data?.action === 'chatCommand' && typeof data?.command === 'string') {
        const command = data.command as string;
        // Parse command: format is "/command arg1 arg2 ..."
        const parts = command.trim().split(/\s+/);
        const cmd = parts[0]?.toLowerCase();
        const args = parts.slice(1);
        console.log('[ChatCommand] from', player.id, 'cmd:', cmd, 'args:', args);
        
        if (cmd && cmd.startsWith('/')) {
          const handler = commandHandlers.get(cmd);
          if (handler) {
            try {
              const result = handler(player, args);
              if (result instanceof Promise) {
                await result;
              }
            } catch (e) {
              console.error('[ChatCommand] error executing command:', e);
              world.chatManager.sendPlayerMessage(player, 'Error executing command.', 'FF6666');
            }
          } else {
            world.chatManager.sendPlayerMessage(player, 'Unknown command: ' + cmd, 'FF6666');
          }
        } else {
          world.chatManager.sendPlayerMessage(player, 'Commands must start with /', 'FF6666');
        }
        return;
      }
      handleHUDData(payload);
    });
    pushHUDStateBuild(player);

    if (result.kind === 'full') {
      world.chatManager.sendPlayerMessage(
        player,
        'Server is full (no plots available).',
        'FFAA00'
      );
    } else {
      world.chatManager.sendPlayerMessage(
        player,
        `Welcome! Your plot is #${result.plotId}.`,
        '00FF00'
      );
    }
  });

  world.on(PlayerEvent.LEFT_WORLD, async ({ player }) => {
    clearCarriedOnLeave(player.id);
    await flushAllDirty();
    await flushAllDirtyState();
    BuildController.cleanupPlayer(player.id);
    buildTickCount.delete(player.id);
    clearPlayerMode(player.id);
    clearModule(player.id);
    const entry = playerMap.get(player.id);
    if (entry?.playerEntity.isSpawned) entry.playerEntity.despawn();
    playerMap.delete(player.id);
    world.entityManager.getPlayerEntitiesByPlayer(player).forEach((e) => e.despawn());
  });

  world.on(PlayerEvent.RECONNECTED_WORLD, async ({ player }) => {
    const profile = getPlayerProfile(player) ?? ensurePlayerProfile(player);
    if (profile.plotId !== null) {
      const plot = getPlot(profile.plotId);
      if (!plot) {
        updatePlayerProfile(player, { plotId: null });
      } else {
        const entities = world.entityManager.getPlayerEntitiesByPlayer(player);
        entities.forEach((e) => e.despawn());
        const playerEntity = new DefaultPlayerEntity({ player, name: 'Player' });
        const pos = {
          x: plot.spawn.x,
          y: plot.spawn.y + SPAWN_HEIGHT_OFFSET + SPAWN_NUDGE_UP,
          z: plot.spawn.z,
        };
        playerEntity.spawn(world, pos);
        player.camera.setAttachedToEntity(playerEntity);
        playerMap.set(player.id, { playerEntity, plotId: profile.plotId });
      }
    }
    player.ui.load('ui/index.html');
    pushHUDStateBuild(player);
  });

  // Helper to register command in both the chat manager and our registry
  const registerChatCommand = (name: string, handler: (player: Player, args: string[]) => void | Promise<void>) => {
    commandHandlers.set(name, handler as (player: Player, args: string[]) => void);
    world.chatManager.registerCommand(name, handler);
  };

  registerChatCommand('/build', (player) => {
    const profile = getPlayerProfile(player) ?? ensurePlayerProfile(player);
    if (profile?.plotId == null) {
      world.chatManager.sendPlayerMessage(player, 'You need a plot to build. Use /plot to check.', 'FF6666');
      return;
    }
    const entry = playerMap.get(player.id);
    if (getActiveModule(player) !== 'BUILD') {
      moduleOpen(player, 'BUILD');
      if (entry) enterBuildMode(player, entry.playerEntity as PlayerEntity);
      pushHUDStateBuild(player);
      world.chatManager.sendPlayerMessage(player, 'Build mode opened. You should see the Build panel and catalog.', '00FF00');
    } else {
      world.chatManager.sendPlayerMessage(player, 'Build mode is already open.', 'AAAAAA');
    }
  });

  registerChatCommand('/plot', (player) => {
    const profile = getPlayerProfile(player) ?? ensurePlayerProfile(player);
    const plotId = profile?.plotId ?? null;
    if (plotId === null) {
      world.chatManager.sendPlayerMessage(player, 'You have no plot. You are in the lobby.', 'AAAAAA');
      return;
    }
    const plot = getPlot(plotId);
    if (!plot) {
      world.chatManager.sendPlayerMessage(player, `Plot #${plotId} (definition missing).`, 'AAAAAA');
      return;
    }
    const b = plot.bounds;
    world.chatManager.sendPlayerMessage(
      player,
      `Plot #${plotId} | bounds min(${b.min.x},${b.min.y},${b.min.z}) max(${b.max.x},${b.max.y},${b.max.z}) | spawn(${plot.spawn.x},${plot.spawn.y},${plot.spawn.z})`,
      'AAAAAA'
    );
  });

  registerChatCommand('/plots', (player) => {
    const lines: string[] = [];
    for (const p of PLOTS) {
      const meta = getCachedPlotMeta(p.plotId) ?? defaultPlotMeta(p.plotId);
      const owner = meta.ownerId ?? '—';
      const truncated = owner.length > 12 ? owner.slice(0, 12) + '…' : owner;
      lines.push(`#${p.plotId} owner=${truncated}`);
    }
    const text = lines.join('\n');
    console.log('[Tycoon] plots:\n' + text);
    world.chatManager.sendPlayerMessage(player, text, 'AAAAAA');
  });

  registerChatCommand('/open', (player, args) => {
    const target = (args[0] || '').toLowerCase();
    const entry = playerMap.get(player.id);
    if (getActiveModule(player) === 'BUILD' && entry) {
      exitBuildMode(player, entry.playerEntity as PlayerEntity);
      BuildController.exitBuildMode(player, entry.playerEntity as PlayerEntity, '/open');
    }
    if (target === 'shop') {
      moduleOpen(player, 'SHOP');
      pushHUDStateBuild(player);
      world.chatManager.sendPlayerMessage(player, 'Opened Shop.', '00FF00');
    } else if (target === 'restaurant') {
      moduleOpen(player, 'RESTAURANT');
      pushHUDStateBuild(player);
      world.chatManager.sendPlayerMessage(player, 'Opened Restaurant panel.', '00FF00');
    } else {
      world.chatManager.sendPlayerMessage(player, 'Usage: /open shop | restaurant', 'AAAAAA');
    }
  });

  registerChatCommand('/play', (player) => {
    const entry = playerMap.get(player.id);
    const wasModule = getActiveModule(player);
    const wasBuild = getPlayerMode(player) === 'BUILD';
    moduleClose(player);
    if (wasBuild && entry) {
      exitBuildMode(player, entry.playerEntity as PlayerEntity);
      BuildController.exitBuildMode(player, entry.playerEntity as PlayerEntity, '/play');
    }
    pushHUDStateBuild(player);
    if (wasModule !== 'NONE' || wasBuild) {
      world.chatManager.sendPlayerMessage(player, 'Switched to Play mode.', '00FF00');
      console.log('[Tycoon] failsafe /play: closed module and play mode', player.id);
    }
  });

  registerChatCommand('/addcash', (player, args) => {
    const amount = Math.floor(Number(args[0]) || 0);
    if (amount <= 0) {
      world.chatManager.sendPlayerMessage(player, 'Usage: /addcash <amount>', 'FF6666');
      return;
    }
    const profile = ensurePlayerProfile(player);
    updatePlayerProfile(player, { cash: profile.cash + amount });
    pushHUDStateBuild(player);
    world.chatManager.sendPlayerMessage(player, `Added $${amount}. Cash: $${profile.cash + amount}`, '00FF00');
  });

  registerChatCommand('/money', (player, args) => {
    const code = args[0] || '';
    const amount = Math.floor(Number(args[1]) || 0);
    
    if (code !== MONEY_CHEAT_CODE) {
      world.chatManager.sendPlayerMessage(player, 'Invalid cheat code.', 'FF6666');
      return;
    }
    
    if (amount <= 0) {
      world.chatManager.sendPlayerMessage(player, 'Usage: /money <code> <amount>', 'FF6666');
      return;
    }
    
    const profile = ensurePlayerProfile(player);
    const newCash = profile.cash + amount;
    updatePlayerProfile(player, { cash: newCash });
    pushHUDStateBuild(player);
    world.chatManager.sendPlayerMessage(player, `💰 Added $${amount}. Cash: $${newCash}`, '00FF00');
    console.log(`[Money Command] Player ${player.id} added $${amount} (code: ${code})`);
  });

  registerChatCommand('/testplace', async (player) => {
    const entry = playerMap.get(player.id);
    if (!entry || entry.plotId == null) {
      world.chatManager.sendPlayerMessage(player, 'No plot / player entry available.', 'FF6666');
      return;
    }
    const s = getBuildState(player.id);
    if (!s.selectedItemType || !s.lastGhostPosition) {
      world.chatManager.sendPlayerMessage(player, 'Select an item and aim at a valid spot first.', 'FF6666');
      return;
    }
    world.chatManager.sendPlayerMessage(player, 'Attempting test place...', 'AAAAAA');
    console.log('[TestPlace] invoked by', player.id, 'item=', s.selectedItemType, 'pos=', s.lastGhostPosition);
    const result = await BuildController.attemptPlace(world, player, { player, entity: entry.playerEntity as Entity, plotId: entry.plotId });
    if (result.ok) {
      world.chatManager.sendPlayerMessage(player, 'Test place successful.', '00FF00');
    } else {
      world.chatManager.sendPlayerMessage(player, 'Test place failed: ' + (result.error ?? 'unknown'), 'FF6666');
    }
  });
}
