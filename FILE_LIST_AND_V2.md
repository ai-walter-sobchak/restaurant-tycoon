# Restaurant Tycoon – Phase 0 file list

## Created / present (Phase 0)

| Path | Purpose |
|------|--------|
| `index.ts` | Entry; `startServer(initTycoon)`. |
| `src/tycoon/config.ts` | Plot count (16), grid size, starting cash, save debounce, etc. |
| `src/tycoon/types.ts` | PlotId, PlotState, PlayerProfile, PlacedItem, Order, Customer; `schemaVersion` + `PLOT_STATE_SCHEMA_VERSION`, `PLAYER_PROFILE_SCHEMA_VERSION`. |
| `src/tycoon/plots.ts` | `PLOTS[]` (plotId, bounds, spawn, entrance), `getPlot`, bounds/grid helpers. |
| `src/tycoon/persistence/playerProfile.ts` | `getPlayerProfile`, `ensurePlayerProfile`, `updatePlayerProfile` (merge-safe). |
| `src/tycoon/persistence/plotStore.ts` | `getPlotState`, `setPlotState` (key `plot:<id>` via PersistenceManager). |
| `src/tycoon/persistence/cache.ts` | In-memory plot cache, dirty set, debounced flush, `flushAllDirty()`. |
| `src/tycoon/persistence/migrate.ts` | `migratePlotState()`, `migratePlayerProfile()` (schemaVersion, safe defaults). |
| `src/tycoon/main.ts` | `initTycoon(world)`: load map, preload plot cache, join (assign plot, spawn, load UI), leave (flush, despawn), reconnect (load UI). |
| `assets/ui/index.html` | Default boilerplate UI only (no tycoon HUD/build/orders). |
| `assets/map.json` | World map. |

## Removed for Phase 0 (add in later phases)

- `src/tycoon/build/*` (catalog, grid, commands, apply)
- `src/tycoon/sim/*` (customers, orders, rating)
- `src/tycoon/ui/*` (hud, buildToolbar, ordersPanel)
- `src/tycoon/serverLog.ts`

## Modified (Phase 0 scope)

- **`src/tycoon/main.ts`** – Reduced to plot assignment + persistence only; no build, NPCs, or UI logic.
- **`src/tycoon/persistence/migrate.ts`** – Uses `PLOT_STATE_SCHEMA_VERSION` in migration.
- **`assets/ui/index.html`** – Reverted to default boilerplate (no tycoon panels).
