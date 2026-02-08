# Phase 4: Next Steps & Loop Readiness

## Are you ready to test the gameplay loop?

**No.** The loop is **designed** but not **implemented**. You can test build mode and persistence; you cannot yet test the full loop (open → customers → orders → stations → revenue).

---

## What exists today

| Piece | Status |
|-------|--------|
| Plot + spawn + persistence | ✅ |
| Build mode (place/delete, catalog, cash) | ✅ |
| PlotState.placedItems, restaurantSettings.isOpen, rating | ✅ (data only) |
| PlayerProfile.cash, unlocks, plotId, restaurantOpen | ✅ (data only) |
| Restaurant panel / `/open restaurant` | ✅ Opens UI only; does **not** toggle “open for business” |
| **Open/close for business** | ❌ No toggle that sets `isOpen` and starts service |
| **Customers** | ❌ No spawn, no NPCs |
| **Orders** | ❌ No Order type, no creation, no lifecycle |
| **Zones** | ❌ No inference from placed items (order/cook/seat) |
| **Station interaction** | ❌ No “interact with stove” / take order / deliver |
| **Revenue on completion** | ❌ No cash/rating update when order completes |
| **Walkouts / patience** | ❌ No customer leave on timeout |

---

## What to build next (minimum path to test the loop)

Implement in this order so you can test as soon as possible.

### 1. Open/close for business (gate for the rest)

- Add a **toggle** that sets both:
  - `PlotState.restaurantSettings.isOpen` (per plot)
  - `PlayerProfile.restaurantOpen` (for HUD)
- Wire it from the Restaurant panel (e.g. “Open” / “Close” button) and/or a keybind.
- When `isOpen` is false: nothing else runs (no spawn, no orders).

**Test:** Toggle open/close; state persists; HUD reflects it.

---

### 2. Sim state + Order types

- In `types.ts`: add `Order` (orderId, dishId, customerId, status, createdAt, etc.) and order status enum.
- Add **sim state** for the active plot: in-memory or persisted at `plotSimState:<plotId>`:
  - `orders: Order[]`
  - `customers: Customer[]` (minimal: id, spawnedAt, orderId, targetZone, patienceDeadline)
  - Optional: `stationAssignments: Record<stationId, orderId>`
- Create a small **menu** (e.g. dishId → price, cookTime) from `profile.unlocks` or config.

**Test:** No gameplay yet; just types and a place to store orders/customers.

---

### 3. Zones from placed items

- Derive zones from **placed item types**:
  - `stove` → cooking zone (position from PlacedItem).
  - `table` → seating zone + pickup zone (same position or offset).
  - Define one **order zone**: either first table, or a fixed spot near entrance, or a dedicated “order counter” item in catalog later.
- Helpers: `getCookingZones(plotState)`, `getSeatingZones(plotState)`, `getOrderZone(plotState)` returning positions or AABBs.

**Test:** Place stove + table; zone helpers return correct positions. No gameplay yet.

---

### 4. Customer spawn (placeholder)

- When `isOpen` and plot has at least one order zone and one seating zone:
  - Every N seconds, push a **placeholder customer** into sim state (id, spawnedAt, orderId: null, target: order zone, patienceDeadline = now + 60s or config).
- No NPC entity required for first test: just create the customer record and, when “at order zone” (e.g. after 2s delay), create an **order** (pending) and attach to customer.

**Test:** Open restaurant; after a few seconds, orders appear in sim state (e.g. log or debug UI).

---

### 5. Order lifecycle + station interaction

- **Take order:** When player is near order zone (or a “pending” order exists), allow “interact” to assign that order to the player or to a chosen stove.
- **Start cook:** When player is at stove and has an assigned order, “interact” sets order status → in_progress; start a simple timer (e.g. 5s).
- **Finish cook:** When timer ends, set order → ready.
- **Deliver:** When player is at the customer’s table (seating zone) with a “ready” order for that customer, “interact” → order completed.

**Test:** One full order: pending → in_progress → ready → completed. (Interact can be key press or UI button for now.)

---

### 6. Revenue + rating

- On order **completed**: add dish price to `player.cash` (update profile); apply small rating delta (e.g. +0.02).
- On **walkout** (patience expired before completed): no cash; small rating penalty (e.g. -0.05). Remove customer and cancel order.

**Test:** Complete order → cash and rating increase. Let one time out → rating drops, no cash.

---

### 7. Polish for “first session” feel

- HUD: show current orders (pending / in progress / ready), cash, rating.
- Restaurant panel: show Open/Close toggle; optional “Orders” list.
- Clear “next goal” message when no stove/table (e.g. “Place a stove and table, then open.”).

---

## When you’re ready to test the full loop

You’re ready when:

1. **Open/close** actually starts/stops the sim (customer spawn + order creation).
2. **At least one placeholder customer** spawns and generates **one order**.
3. You can **interact** to take order → cook at stove → deliver to seat.
4. **One completed order** adds **cash** and updates **rating**.

Then you can play: open → see order → cook → deliver → see cash/rating → close and spend cash in Build/Shop → reopen. That’s the loop.

---

## After the first testable loop

- Add more dishes (unlocks) and menu from unlocks.
- Tune spawn rate, cook time, patience.
- Add simple NPC entities that move to order/seat (optional for Phase 4).
- Prepare for Phase 5: same data (orders, customers, zones) so AI can plug in.
