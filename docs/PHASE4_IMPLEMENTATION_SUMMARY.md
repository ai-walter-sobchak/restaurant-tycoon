# Phase 4 Implementation Summary

All seven steps from `PHASE4_NEXT_STEPS.md` are implemented. You can test the full gameplay loop.

## What Was Added

### 1. Open/close for business
- **Restaurant panel**: "Open for business" / "Close for business" button toggles `restaurantSettings.isOpen` (plot) and `restaurantOpen` (profile).
- Opening is blocked until you have at least **one stove and one table** placed.
- Closing clears in-memory sim state (customers/orders) for that plot.

### 2. Sim state + Order/Customer types
- **`src/tycoon/types.ts`**: `Order`, `OrderStatus`, `SimCustomer`, `PlotSimState`.
- **`src/tycoon/config.ts`**: `MENU` (dish_burger → price, cookTimeMs), sim timing constants (spawn interval, patience, cook time, interact radius, rating deltas).
- **`src/tycoon/sim/state.ts`**: In-memory `PlotSimState` per plot; `getSimState(plotId)`, `clearSimState(plotId)`.

### 3. Zones from placed items
- **`src/tycoon/sim/zones.ts`**: `getCookingZones` (stoves), `getSeatingZones` (tables), `getOrderZone` (first table or entrance), `hasMinimumSetup(plotState)`, `distanceXZ` for interact range.

### 4. Customer spawn
- **`src/tycoon/sim/loop.ts`**: `runSimTick(plotId, plotState, now, ownerId, unlocks)`:
  - Spawns a customer every `SIM_CUSTOMER_SPAWN_INTERVAL_MS` (12s).
  - After `SIM_ORDER_CREATE_DELAY_MS` (3s), creates an order (random dish from `unlocks` in `MENU`) and assigns to a seat.
  - Advances cook timers (in_progress → ready after cook time).
  - Walkouts: if customer patience expires, order fails and rating drops.
- Sim tick runs every 500ms per open plot (only when owner is in world).

### 5. Order lifecycle + station interaction
- **`src/tycoon/sim/interact.ts`**: `handleInteract(player, plotId, playerPosition)`:
  - **At stove**: If no order on stove → start cooking a pending order, or pick up a ready order. If order on stove is ready → pick up (player “carries” it).
  - **At table** (when carrying): Deliver to the order’s seat → complete order.
- **Keybind E**: Sends `action: 'interact'` from client; server uses `playerEntity.position` for range check (`SIM_INTERACT_RADIUS` = 2.5).
- Flow: **Pending** → (interact at stove) → **in_progress** → (tick) → **ready** → (interact at stove to pick up) → (interact at correct table) → **completed**.

### 6. Revenue + rating
- **On complete**: Add dish price to player cash; plot rating += `SIM_RATING_SUCCESS_DELTA` (capped at 5).
- **On walkout**: Rating -= `SIM_RATING_WALKOUT_PENALTY` (floored at 0); no revenue.
- Rating is stored in `PlotState.rating` and shown in HUD (top-right).

### 7. HUD/UI
- **Top-right**: Cash and **rating** (from plot state).
- **Top-center**: “Open”/“Closed” and **next goal** (“Place a stove and table, then open.” when applicable).
- **Restaurant panel**: Open/Close button, orders list (dish + status), hint “Press E near stove or table to interact.”

## How to Test

1. Join, claim a plot, place **one stove** and **one table** (Build mode, B).
2. Open Restaurant panel (click Restaurant or use keybind).
3. Click **“Open for business”**. You should see “Restaurant is open!” and status “Open”.
4. Wait ~15s: a customer spawns and an order appears (pending). Orders list updates in the Restaurant panel.
5. Go **near the stove**, press **E**. Message: “Cooking dish_burger...”.
6. Wait ~8s (cook time). Order becomes “ready”.
7. Press **E** at the stove again: “Picked up order. Take it to the table.”
8. Go to the **table**, press **E**: “Delivered! +$15”. Cash and rating increase.
9. Close restaurant when you want; place more items in Build, reopen, repeat.

## Config (tuning)

In `src/tycoon/config.ts`:
- `SIM_CUSTOMER_SPAWN_INTERVAL_MS` (12_000)
- `SIM_ORDER_CREATE_DELAY_MS` (3_000)
- `SIM_PATIENCE_MS` (45_000)
- `SIM_COOK_TIME_MS` (8_000)
- `SIM_INTERACT_RADIUS` (2.5)
- `MENU`: add more dishes (id → `{ price, cookTimeMs? }`) and ensure they’re in `profile.unlocks` (e.g. via Shop later).

## Files Touched / New

| Path | Change |
|------|--------|
| `src/tycoon/types.ts` | Order, SimCustomer, PlotSimState, OrderStatus |
| `src/tycoon/config.ts` | MENU, sim constants |
| `src/tycoon/sim/state.ts` | **New** – in-memory sim state |
| `src/tycoon/sim/zones.ts` | **New** – zones from placed items |
| `src/tycoon/sim/loop.ts` | **New** – spawn, orders, cook, walkouts |
| `src/tycoon/sim/interact.ts` | **New** – take order, cook, deliver, revenue/rating |
| `src/tycoon/main.ts` | Open/close handler, sim tick, interact handler, setCachedPlotState, clearCarriedOnLeave |
| `src/tycoon/ui/useHUDState.ts` | orders, nextGoal, rating from plot, getSimState import |
| `src/tycoon/ui/TopCenterModes.ts` | nextGoal in state |
| `assets/ui/index.html` | Restaurant panel (Open/Close, orders), E keybind, next goal display, rating format |

## Note on Existing TS Errors

`npx tsc --noEmit` still reports errors in `ghost.ts`, `raycast.ts`, `migrate.ts`, and `main.ts` (map import, playerManager). These were present before Phase 4. The new sim and UI code type-check; the runtime may already be working if the engine/build ignores or overrides those.
