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
import { clearSimState } from './sim/state.js';
import { runSimTick } from './sim/loop.js';
import { handleInteract, clearCarriedOnLeave } from './sim/interact.js';
import { hasMinimumSetup } from './sim/zones.js';

const DEV = typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production';

/** In-memory: playerId -> { playerEntity, plotId } for later phases. */
const playerMap = new Map<string, { playerEntity: Entity; plotId: PlotId | null }>();

/** Tick counter per player for throttled BUILD HUD push (so client gets ghost/snapped state). */
const buildTickCount = new Map<string, number>();
const BUILD_PUSH_INTERVAL_TICKS = 5;

/** Sim tick throttle: last run time (ms) per plot. */
const lastSimTickByPlot = new Map<PlotId, number>();
const SIM_TICK_INTERVAL_MS = 500;

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
      if (DEV) {
        const s = getBuildState(player.id);
        const ghost = getGhostEntity(player.id);
        buildDebug = {
          selectedItemType: s.selectedItemType,
          buildModeActive: getPlayerMode(player) === 'BUILD',
          lastRaycastHit: s.lastRaycastHit ? { ...s.lastRaycastHit } : null,
          snappedPos: s.lastGhostPosition ? { ...s.lastGhostPosition } : null,
          ghostSpawned: !!(ghost?.isSpawned),
          lastPlaceAttempt: s.lastPlaceAttempt ?? null,
        };
      }
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
      removeGhost(player.id);
      clearBuildState(player.id);
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
          removeGhost(player.id);
          clearBuildState(player.id);
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
        removeGhost(player.id);
        clearBuildState(player.id);
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
      if (!entry || getActiveModule(player) !== 'BUILD') continue;
      const plot = entry.plotId != null ? getPlot(entry.plotId) : null;
      const groundY = plot?.bounds.min.y ?? Math.max(0, entry.playerEntity.position.y - 1);
      const ray = getPointerRayFromPlayer(player, entry.playerEntity);
      const hit = raycastBuildSurface(world, ray, { groundY });
      const state = getBuildState(player.id);
      let lastGhostPosition: Vec3 | null = null;
      let lastDeleteTargetId: string | null = null;
      if (hit) {
        const snapped = plot ? snapToGridPlotRelative(plot, hit) : { x: Math.floor(hit.x) + 0.5, y: hit.y, z: Math.floor(hit.z) + 0.5 };
        const clamped = plot ? clampToPlot(plot, snapped) : snapped;
        if (entry.plotId != null) {
          lastDeleteTargetId = findPlacedItemAt(entry.plotId, clamped)?.id ?? null;
        }
        const itemType = state.selectedItemType;
        if (itemType) {
          const catalog = getCatalogItem(itemType);
          if (catalog) {
            lastGhostPosition = clamped;
            const valid = plot
              ? (() => {
                  const plotState = getCachedPlotState(entry.plotId!);
                  const existing = plotState?.placedItems ?? [];
                  return isPointInPlot(plot, clamped) && !overlapsExisting(clamped, catalog.footprint, state.placementRotation, existing);
                })()
              : false;
            updateGhost(
              player.id,
              world,
              itemType,
              clamped,
              state.placementRotation,
              valid
            );
          }
        }
      } else if (state.selectedItemType) {
        removeGhost(player.id);
      }
      setBuildState(player.id, {
        lastGhostPosition,
        lastDeleteTargetId,
        lastRaycastHit: hit ? { ...hit } : null,
      });
      const t = (buildTickCount.get(player.id) ?? 0) + 1;
      buildTickCount.set(player.id, t);
      if (t % BUILD_PUSH_INTERVAL_TICKS === 0) pushHUDStateBuild(player);
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
        setBuildState(player.id, { selectedItemType: data.itemType });
        if (DEV) console.log('[Build] setSelectedItem', data.itemType);
        pushHUDStateBuild(player);
        return;
      }
      if (data?.action === 'buildRotate') {
        if (getActiveModule(player) !== 'BUILD') return;
        const s = getBuildState(player.id);
        setBuildState(player.id, { placementRotation: nextRotation(s.placementRotation) });
        pushHUDStateBuild(player);
        return;
      }
      if (data?.action === 'buildPlace') {
        if (getActiveModule(player) !== 'BUILD' || !entry?.plotId) return;
        const s = getBuildState(player.id);
        if (!s.selectedItemType || !s.lastGhostPosition) {
          world.chatManager.sendPlayerMessage(player, 'Select an item and aim at a valid spot.', 'FF6666');
          return;
        }
        const result = await handlePlace(
          world,
          player,
          entry.plotId,
          s.selectedItemType,
          s.lastGhostPosition,
          s.placementRotation
        );
        const resultStr = result.ok ? 'ok' : (result.error ?? 'rejected');
        setBuildState(player.id, { lastPlaceAttempt: { at: Date.now(), result: resultStr } });
        if (result.ok) {
          world.chatManager.sendPlayerMessage(player, 'Placed.', '00FF00');
          if (DEV) console.log('[Build] place accepted');
        } else {
          world.chatManager.sendPlayerMessage(player, result.error ?? 'Place failed.', 'FF6666');
          if (DEV) console.log('[Build] place rejected', result.error);
        }
        pushHUDStateBuild(player);
        return;
      }
      if (data?.action === 'buildDelete') {
        if (getActiveModule(player) !== 'BUILD' || !entry?.plotId) return;
        const plotId = entry.plotId;
        let placedItemId: string | undefined =
          typeof data?.placedItemId === 'string' ? data.placedItemId : undefined;
        if (!placedItemId && data?.position && typeof data.position === 'object') {
          const pos = data.position as { x?: number; y?: number; z?: number };
          if (typeof pos.x === 'number' && typeof pos.z === 'number') {
            const at = findPlacedItemAt(plotId, { x: pos.x, y: pos.y ?? 0, z: pos.z });
            placedItemId = at?.id;
          }
        }
        if (!placedItemId) placedItemId = getBuildState(player.id).lastDeleteTargetId ?? undefined;
        if (!placedItemId) {
          world.chatManager.sendPlayerMessage(player, 'Aim at a placed item to delete.', 'FF6666');
          pushHUDStateBuild(player);
          return;
        }
        const result = await handleDelete(world, player, plotId, placedItemId);
        if (result.ok) {
          world.chatManager.sendPlayerMessage(
            player,
            result.refund ? `Deleted. Refund $${result.refund}.` : 'Deleted.',
            '00FF00'
          );
        } else {
          world.chatManager.sendPlayerMessage(player, result.error ?? 'Delete failed.', 'FF6666');
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
        if (!opening) clearSimState(plotId);
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
    removeGhost(player.id);
    clearBuildState(player.id);
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

  world.chatManager.registerCommand('/build', (player) => {
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

  world.chatManager.registerCommand('/plot', (player) => {
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

  world.chatManager.registerCommand('/plots', (player) => {
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

  world.chatManager.registerCommand('/open', (player, args) => {
    const target = (args[0] || '').toLowerCase();
    const entry = playerMap.get(player.id);
    if (getActiveModule(player) === 'BUILD' && entry) {
      exitBuildMode(player, entry.playerEntity as PlayerEntity);
      removeGhost(player.id);
      clearBuildState(player.id);
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

  world.chatManager.registerCommand('/play', (player) => {
    const entry = playerMap.get(player.id);
    const wasModule = getActiveModule(player);
    const wasBuild = getPlayerMode(player) === 'BUILD';
    moduleClose(player);
    if (wasBuild && entry) {
      exitBuildMode(player, entry.playerEntity as PlayerEntity);
      removeGhost(player.id);
      clearBuildState(player.id);
    }
    pushHUDStateBuild(player);
    if (wasModule !== 'NONE' || wasBuild) {
      world.chatManager.sendPlayerMessage(player, 'Switched to Play mode.', '00FF00');
      console.log('[Tycoon] failsafe /play: closed module and play mode', player.id);
    }
  });

  world.chatManager.registerCommand('/addcash', (player, args) => {
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
}
