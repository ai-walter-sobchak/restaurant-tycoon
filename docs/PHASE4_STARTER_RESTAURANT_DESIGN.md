# Phase 4: Starter Restaurant — Core Gameplay Design

Systems-first design for the first restaurant players ever open. Map layout is in flux; build mode exists or is in progress; visual polish deferred. Focus: loops, systems, constraints, progression.

---

## 1. Core Gameplay Loop (Concrete)

### Exact loop (plain language)

1. **Player opens restaurant**  
   - Action: Toggle “Open” (e.g. Restaurant panel or keybind).  
   - System: Set `restaurantSettings.isOpen` (plot) and/or `restaurantOpen` (profile) true. Spawn/activation of “service” is allowed; customer spawn logic may start.

2. **Customers arrive**  
   - System: Spawn or route placeholder NPCs toward plot entrance at a spawn rate (e.g. per minute or per N seconds). Rate can depend on rating, time-of-day stub, or fixed starter value.  
   - Player: No direct action; layout and capacity affect how many can be present.

3. **Orders are placed**  
   - System: When a customer reaches an **order zone** (or is “seated” in a **seating zone**), create an order (e.g. from a small starter menu: 1–3 dish types). Order has: dishId, customerId, createdAt, status (pending → in_progress → ready → completed / failed).  
   - Player: No order-placement action in Phase 4; system assigns orders from menu.

4. **Player interacts with stations**  
   - Player: Moves to **prep/cooking zone**, interacts with station (e.g. stove) to start/complete cooking for a chosen order. Optionally: take order from **order zone**, deliver to **pickup zone** or table.  
   - System: Advance order status when interaction conditions are met (e.g. station has correct dish type, timer or step completed). Track which order is being worked on per station if needed.

5. **Revenue earned**  
   - System: When order reaches “completed” (e.g. delivered to customer or pickup zone and collected), add dish price to player cash; optionally update rating (e.g. +0.01–0.05 for on-time, small penalty for late).  
   - Player: Sees cash/rating update in HUD.

6. **Decisions made**  
   - Player: Closes restaurant when desired; spends cash in Build (place tables, stoves, etc.) or Shop (unlocks); reopens. Chooses what to prioritize (more seats vs more cooking capacity, or saving for an upgrade).  
   - System: Persist plot state (placed items, isOpen), profile (cash, unlocks). No “day” rollover required for MVP; “session” or “open/close” can be the unit of play.

7. **Loop repeats**  
   - Player opens again; customers, orders, stations, revenue, decisions. Same loop.

### Player actions (summary)

| Action | When | System response |
|--------|------|------------------|
| Open / Close restaurant | Any time (when not in Build) | Set isOpen; enable/disable customer spawn and order creation. |
| Interact with order surface | When order exists and player in range | Assign order to player or station; show “take order” / “start cook”. |
| Interact with cooking station | When order in progress, player has ingredients/order | Start or complete cook; advance order to “ready”. |
| Deliver to table / pickup | When order “ready”, player in delivery zone | Complete order; add revenue; update rating. |
| Place / delete items (Build) | Build mode | Consume cash on place; persist placedItems; zones inferred from item types. |
| Buy unlock (Shop) | When cash sufficient | Deduct cash; add to profile.unlocks (e.g. new dish). |

### Success and failure conditions

- **Success (session):** At least one order completed; cash increased; player can close and keep gains.  
- **Soft failure:** Customers leave if wait too long (order not started or not delivered in time); no revenue for that customer; small rating drop.  
- **Hard failure:** None. No game over. Worst case: low cash, low rating, slow progress—player can always close, build, and reopen.

---

## 2. Zone System (Abstract, Not Geometric)

Zones are **functional**: defined by **what can happen there**, not by room shape. Zones are inferred from **placed item types** and/or **trigger volumes** the map or build system provides. Walls/layout can change; zone logic stays the same.

| Zone | Purpose | Gameplay enabled | Upgrades / what affects it | If missing or poor |
|------|---------|------------------|----------------------------|--------------------|
| **Entrance / spawn** | Where customers enter the plot. | Customer spawn; pathfinding target. | N/A (map/plot). | Customers have no valid target; no service. |
| **Order zone** | Where orders are taken or generated. | Order creation; “customer wants X”; optionally player “takes” order. | More order points → more concurrent orders. | No orders; no loop. |
| **Prep zone** | Where raw/prep happens (optional for starter). | If present: prep steps before cooking. | Prep stations; speed upgrades later. | Starter can be “cook only”; no prep. |
| **Cooking zone** | Where dishes are cooked. | Player interacts with stove (or equivalent); order moves pending → in_progress → ready. | Stove count; cook time; dish type. | Orders never become “ready”; no revenue. |
| **Pickup zone** | Where completed food is taken by server/customer. | Order marked “ready”; player or NPC “delivers” to complete. | Count of pickup points; link to tables. | Completed food has no destination; orders stuck “ready”. |
| **Seating zone** | Where customers “sit” and are served. | Order tied to seat; delivery target; capacity = seats. | Table/chair count; comfort (later). | No capacity; or no delivery target. |
| **Outdoor zone** (optional) | Any area outside default “room” but still on plot. | Same as seating if tables allowed there; or decoration only. | Unlock “outdoor seating”; weather later. | Not required for starter. |

### Zone adjacency (design constraint, not geometry)

- **Order zone** must be reachable from **entrance** (walkable path).  
- **Cooking zone** must be reachable from **order zone** (so player or later AI can “take order to kitchen”).  
- **Pickup zone** and **seating zone** must be reachable from **cooking zone** (delivery path).  
- No requirement that zones be separate rooms; they can overlap or be the same volume. “Reachable” = pathfinding or distance check, not wall layout.

### Implementation note

- Zones can be implemented as: (a) **item-type tags** (e.g. `table` → seating + pickup; `stove` → cooking), (b) **invisible trigger volumes** in the map, or (c) **grid flags** derived from placed items. Phase 4 can use (a) + (b) only; no need to lock map geometry.

---

## 3. Player Agency & Personality

Identity and differentiation **without cosmetics**: through **menu**, **layout**, **pace**, and **density**.

### How two players get different diners

- **Menu focus:** One unlocks and enables mostly coffee/drinks (fast, low margin); another goes full food (slower, higher margin). Menu choices = `unlocks` + which items are “enabled” on the board.  
- **Layout prioritization:** One optimizes for speed (order → cook → pickup in a line); another for atmosphere (spread seating, longer walk). Same zones, different positions.  
- **Speed vs quality:** Rushing orders can add small rating risk; taking time can mean fewer orders per “session” but safer rating. Player chooses pace.  
- **Seating density vs comfort:** More tables = more potential orders and more congestion (longer wait). Fewer tables = fewer orders, lower stress.  
- **Coffee-focused vs food-focused:** Different dish types (drinks vs meals); different station usage and timings. Expressed via which stations and unlocks they place and enable.

### Choices that matter early (first 5–10 minutes)

- **Open as soon as possible vs build first:** Open with minimal setup to feel the loop vs place one table + one stove first.  
- **First purchase:** First cash spent on extra table, extra chair, or saving for stove/second stove.  
- **First unlock:** Which dish type to unlock next (if Shop offers a choice).  
- **When to close:** After first few orders (quick win) vs run longer (more cash, more risk of walkouts).

No cosmetics required; **agency = menu + layout + pacing + density + dish focus**.

---

## 4. Progression Model (Early Game Only)

### First 30 minutes

- **Start:** One plot, starter cash (e.g. 500), one dish unlocked (e.g. `dish_burger`). Plot has or can have: at least one order point, one stove, one table, one or two chairs (or placeable in Build).  
- **Unlock conditions:**  
  - “Open restaurant”: Player has plot and has placed at least one of each: order-capable, cooking, seating (e.g. 1 table, 1 stove).  
  - “First order”: Open and at least one customer can reach order zone.  
  - “First revenue”: One order completed.  
- **Soft caps:**  
  - Customer spawn rate low at 0 rating; increases as rating climbs (e.g. cap at 5).  
  - Cash limited by order throughput (stations + seats).  
  - No “level” or XP; progression = cash + unlocks + rating.  
- **Next goal signals:**  
  - UI: “Place a stove to start cooking.” / “Open the restaurant to serve customers.”  
  - After first order: “Earn $X more to buy a second table.”  
  - After first successful session: “Unlock a new dish in the Shop.”

### First successful “day” (session)

- **Definition:** One continuous “open” period where at least one order is completed and restaurant is then closed (or session ends).  
- **Reward:** Cash and rating persist; player can spend cash in Build/Shop.  
- **Signal:** “Day complete. You earned $X. Open again or build and expand.”

### First expansion decision

- **Trigger:** Cash crosses threshold (e.g. 100–200) after first session.  
- **Options:** Second table (more seating), second stove (more throughput), or new dish unlock.  
- **No late-game:** No staff, no multiple plots, no complex equipment in this model. Progression ends at “stable loop + 2–3 dishes + 2–4 tables + 1–2 stoves”.

---

## 5. Failure States (Non-Punitive)

| Failure | Cause | Result | Reversible? |
|--------|--------|--------|-------------|
| Customer leaves | Wait time exceeded (order not started or not delivered in time). | No revenue for that order; small rating decrease. | Yes; improve layout/speed or lower spawn rate by closing. |
| Bad review / rating drop | Late orders, too many walkouts. | Rating goes down; spawn rate may decrease. | Yes; serve well next session to raise rating. |
| Slow income | Few stations, few seats, or low rating. | Cash grows slowly. | Yes; add tables/stoves or improve service. |
| Temporary closure | Player closes, or “no valid path” for customers. | No new customers; no new orders. | Yes; fix path or reopen. |
| Can’t afford next item | Cash below catalog or unlock cost. | Cannot place or unlock. | Yes; open again and earn. |

- **No hard game over.** No loss of plot, no permanent penalty. Worst case: player reopens and tries again with same or adjusted layout.

---

## 6. Map Requirements (Design Constraints)

Non-negotiable for gameplay to function. **No materials or aesthetics.**

- **Walkable path:** At least one path from **plot entrance** to every functional zone (order, cooking, seating/pickup). Path width minimum (e.g. 1 cell or 1 unit) so NPCs/player can pass.  
- **Door requirements:** If the map uses doors, entrance must be traversable when restaurant is “open” (logic or trigger); no door logic required for Phase 4 if map has open entrance.  
- **Zone adjacency / reachability:** As in §2: entrance → order → cooking → pickup/seating. All must be reachable without requiring unreachable geometry.  
- **Outdoor access:** Not required for starter. If present, treat as optional seating zone.  
- **Spawn and entrance:** Plot must have defined `entrance` and `spawn` (already in `PlotDefinition`); customer spawn uses entrance; player spawn can use spawn.  
- **Minimum space:** Enough cells to place at least: 1 order point, 1 stove, 1 table, 2 chairs (or equivalent), and walkable paths between them. Exact cell count derived from catalog footprints.

---

## 7. System Hooks for Phase 5

Phase 5 will add or refine **AI** (e.g. NPC behavior, staff, or procedural content). Phase 4 must expose data and contracts so Phase 5 can plug in without redesign.

### What systems will later plug into AI

- **Customer behavior:** Spawn, pathfinding to order/seat, wait tolerance, leave/order completion. Phase 4: placeholder NPCs or simple state machine; Phase 5: AI-driven.  
- **Order flow:** Which order is assigned to which station; queue per station. Phase 4: player-driven assignment (e.g. “take order” at station); Phase 5: AI can assign and prioritize.  
- **Delivery:** Who delivers “ready” order to which seat. Phase 4: player; Phase 5: staff or NPC.  
- **Rating and spawn rate:** Formula (e.g. rating → spawn rate curve). Phase 4: fixed or simple formula; Phase 5: AI or tuning can use same inputs.

### Data to track now (persist or in-memory)

- **Per order:** `orderId`, `dishId`, `customerId`, `status`, `createdAt`, `startedAt` (when cooking started), `completedAt`, `seatId` or pickup zone id.  
- **Per customer:** `customerId`, `spawnedAt`, `currentZone` or target (order / seat), `orderId` if any, `leftAt` (if walked out), `patienceRemaining` or deadline.  
- **Per station:** `stationId`, `itemType` (e.g. stove), `currentOrderId` (if any), `state` (idle / cooking).  
- **Per plot/session:** `isOpen`, `rating`, `lastOrderCompletedAt`, optional `sessionStartedAt` for “day” length.  
- **Per player:** `cash`, `unlocks`, `plotId` (already in profile).  

Store in **PlotState** or a dedicated **sim state** key (e.g. `plotSimState:<plotId>`) so Phase 5 can read/write the same structures.

### Assumptions Phase 5 will rely on

- **Zones are functional, not geometric:** AI uses “order zone”, “cooking zone”, “seating zone” as labels or IDs, not raw coordinates. Coordinates can change with layout.  
- **Order lifecycle is explicit:** status enum (e.g. pending → in_progress → ready → completed / failed). Phase 5 can add steps (e.g. prep) without breaking the enum.  
- **One source of truth for “open”:** `restaurantSettings.isOpen` (plot) or `restaurantOpen` (profile); Phase 5 uses the same flag.  
- **Catalog item types define capability:** e.g. `stove` = cooking zone; `table` = seating + pickup. Phase 5 can add new item types and new zone types without changing zone abstraction.  
- **No NPC AI in Phase 4:** Placeholder movement/behavior is acceptable; Phase 5 replaces with AI-driven NPCs using the same spawn, zones, and order data.

---

## Success Criteria (Phase 4 Exit)

- Playable with **placeholder NPCs** (spawn, simple path to order/seat, leave on timeout).  
- **Satisfying loop:** Open → customers → orders → interact at stations → revenue → close/build/shop → reopen.  
- **Clear next steps:** Document or UI signals for “what to build next” and “what Phase 5 needs” (this doc + data contracts).  
- **Clean handoff to Phase 5:** Zones, order lifecycle, and tracked data are defined so another agent can add AI without redoing core loop or persistence.
