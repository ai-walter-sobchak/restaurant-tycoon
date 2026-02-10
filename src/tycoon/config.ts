/**
 * Phase 0 stub: plot count, grid, starting cash, save debounce.
 * Extend later for build/sim (prices, timers, limits).
 */

/** Single restaurant for now; expand to multiple plots later. */
export const PLOT_COUNT = 1;
export const GRID_CELL_SIZE = 1;
export const PLOT_GRID_SIZE = 10;
/** Floor Y for plots on restaurant-map (top of ground block at y=0). */
export const MAP_PLOT_FLOOR_Y = 1;
export const STARTING_CASH = 500;
export const PLOT_SAVE_DEBOUNCE_MS = 3000;
export const RATING_MAX = 5;
/** Cheat code for /money command. Change this to your own secret code. */
export const MONEY_CHEAT_CODE = 'cheats';

/**
 * Lobby spawn when no plot is available (world position).
 * Chosen for restaurant-map.json: open area at (0, 2, 0) so player spawns above ground (y=1).
 */
export const LOBBY_SPAWN = { x: 0, y: 2, z: 0 };

/** Height above plot ground so the player spawns on the surface, not inside it. */
export const SPAWN_HEIGHT_OFFSET = 1;
/** Extra nudge when spawning on a plot to avoid obstruction by floor/map. */
export const SPAWN_NUDGE_UP = 0.5;

// --- Sim (Phase 4) ---
/** Customer spawn interval (ms) when restaurant is open. */
export const SIM_CUSTOMER_SPAWN_INTERVAL_MS = 12_000;
/** Delay (ms) after spawn before customer "arrives" and order is created. */
export const SIM_ORDER_CREATE_DELAY_MS = 3_000;
/** Customer leaves if order not completed by this time (ms) after order created. */
export const SIM_PATIENCE_MS = 45_000;
/** Cook time (ms) per order at stove. */
export const SIM_COOK_TIME_MS = 8_000;
/** Interaction radius (distance) for stove/table. */
export const SIM_INTERACT_RADIUS = 2.5;
/** Rating change on successful order (capped at RATING_MAX). */
export const SIM_RATING_SUCCESS_DELTA = 0.02;
/** Rating change on walkout (floored at 0). */
export const SIM_RATING_WALKOUT_PENALTY = 0.05;
/** Dish id -> price (revenue) and cookTimeMs (optional override). */
export const MENU: Record<string, { price: number; cookTimeMs?: number }> = {
  dish_burger: { price: 15, cookTimeMs: 8_000 },
};

// --- NPCs (Phase 5A) ---
/** NPC spawn interval (ms) when restaurant is open. */
export const NPC_SPAWN_INTERVAL_MS = 6_000;
/** Max concurrent NPCs per plot. */
export const NPC_MAX_CONCURRENT = 5;
/** NPC movement speed (units/second). */
export const NPC_MOVEMENT_SPEED = 3.0;
/** Time (ms) NPC stays at target before cleanup. */
export const NPC_ARRIVE_CLEANUP_DELAY_MS = 8_000;

