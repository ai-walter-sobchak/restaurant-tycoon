# Phase 0 – File list (minimal compiling stubs)

| File | Description |
|------|-------------|
| **index.ts** | Entry point; calls `startServer(initTycoon)` (HYTOPIA `startServer`). |
| **src/tycoon/config.ts** | Stub config: `PLOT_COUNT`, `GRID_CELL_SIZE`, `PLOT_GRID_SIZE`, `STARTING_CASH`, `PLOT_SAVE_DEBOUNCE_MS`, `RATING_MAX`. |
| **src/tycoon/types.ts** | Stub types: `PlotId`, `PlotState`, `PlayerProfile`, `PlotDefinition`, `PlacedItem`, etc.; all persisted shapes include `schemaVersion` and `updatedAt`; `PLOT_STATE_SCHEMA_VERSION`, `PLAYER_PROFILE_SCHEMA_VERSION`. |
| **src/tycoon/plots.ts** | Stub plots: `PLOTS[]` (plotId, bounds, spawnPoint, entrancePoint), `getPlot(plotId)`; helpers `isInPlotBounds`, `gridCellToWorld`, `worldToGridCell`, `isGridCellInBounds`. |
| **src/tycoon/persistence/playerProfile.ts** | Stub: `getPlayerProfile(player)`, `ensurePlayerProfile(player)`, `updatePlayerProfile(player, patch)`; uses `player.getPersistedData()` / `player.setPersistedData()`; runs `migratePlayerProfile` on load. |
| **src/tycoon/persistence/plotStore.ts** | Stub: `getPlotState(plotId)`, `setPlotState(plotId, state)`; key `plot:<id>` via `PersistenceManager.instance.getGlobalData` / `setGlobalData`; runs `migratePlotState` on load. |
| **src/tycoon/persistence/cache.ts** | Stub: in-memory plot cache; `getCachedPlotState`, `setCachedPlotState`, `markPlotDirty`, `registerPlotInCache`, `flushAllDirty`; debounced flush to plotStore. |
| **src/tycoon/persistence/migrate.ts** | `migratePlotState(old)` and `migratePlayerProfile(old)`; ensure `schemaVersion` and `updatedAt`; default missing fields so existing saves do not break. |
| **src/tycoon/main.ts** | Minimal HYTOPIA wiring: `initTycoon(world)` loads map (`world.loadMap`), preloads plot cache, `PlayerEvent.JOINED_WORLD` (assign plot, spawn `DefaultPlayerEntity`, `player.ui.load`), `PlayerEvent.LEFT_WORLD` (flush dirty, despawn), `PlayerEvent.RECONNECTED_WORLD` (reload UI). No build, NPCs, or tycoon UI. |

All HYTOPIA APIs used are from the SDK (e.g. `startServer`, `DefaultPlayerEntity`, `PlayerEvent`, `world.loadMap`, `world.on`, `player.getPersistedData`, `player.setPersistedData`, `PersistenceManager.instance.getGlobalData/setGlobalData`, `player.ui.load`, `world.entityManager.getPlayerEntitiesByPlayer`, `world.chatManager.sendPlayerMessage`).
