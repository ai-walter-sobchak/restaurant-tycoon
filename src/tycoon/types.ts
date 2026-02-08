/**
 * Phase 1: persisted shapes with schemaVersion + updatedAt.
 * Migrate functions in persistence/migrate.ts.
 */

export type PlotId = number;

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** AABB for bounds checks. */
export interface AABB {
  min: Vec3;
  max: Vec3;
}

export interface GridCell {
  x: number;
  z: number;
}

/** Rotation in degrees (0, 90, 180, 270) for placed items. */
export type PlacementRotation = 0 | 90 | 180 | 270;

export interface PlacedItem {
  id: string;
  catalogId: string;
  position: Vec3;
  /** Y-axis rotation in degrees: 0 | 90 | 180 | 270 */
  rotationY: PlacementRotation;
  createdAt: number;
  entityId?: number;
}

/** Plot definition: bounds (min/max), spawn, entrance. */
export interface PlotDefinition {
  plotId: PlotId;
  bounds: { min: Vec3; max: Vec3 };
  spawn: Vec3;
  entrance: Vec3;
}

/** Plot ownership meta stored at key "plot:<plotId>". */
export interface PlotMeta {
  schemaVersion: number;
  updatedAt: number;
  ownerId: string | null;
  ownerName?: string | null;
  claimedAt?: number | null;
  lastActiveAt?: number | null;
}

/** Full plot state: placed items, restaurant, rating. Persisted per plot. */
export interface PlotState {
  schemaVersion: number;
  updatedAt: number;
  ownerId: string | null;
  placedItems: PlacedItem[];
  restaurantSettings: { isOpen: boolean };
  rating: number;
}

/** Current player mode: PLAY (normal) or BUILD (movement locked, cursor for build UI). */
export type PlayerMode = 'PLAY' | 'BUILD';

/** Which module panel is open (single at a time). */
export type ModuleKind =
  | 'NONE'
  | 'BUILD'
  | 'SHOP'
  | 'RESTAURANT'
  | 'ALBUM'
  | 'REWARDS'
  | 'DAILY_REWARDS'
  | 'SEASON';

export interface PlayerProfile {
  schemaVersion: number;
  updatedAt: number;
  cash: number;
  unlocks: string[];
  staff: string[];
  cosmetics: Record<string, unknown>;
  plotId: PlotId | null;
  /** Last mode (optional); default PLAY on join. */
  lastMode?: PlayerMode;
  /** Restaurant open for business (stub; server-authoritative). */
  restaurantOpen?: boolean;
}

/** Order status lifecycle for Phase 4 sim. */
export type OrderStatus = 'pending' | 'in_progress' | 'ready' | 'completed' | 'failed';

export interface Order {
  orderId: string;
  dishId: string;
  customerId: string;
  status: OrderStatus;
  createdAt: number;
  startedAt?: number;
  readyAt?: number;
  completedAt?: number;
  /** PlacedItem.id of the table (seat) this order is for. */
  seatId: string;
}

export interface SimCustomer {
  customerId: string;
  spawnedAt: number;
  orderId: string | null;
  /** PlacedItem.id of the table they are seated at (or targeting). */
  seatId: string | null;
  /** Time (ms) when customer leaves if order not completed. */
  patienceDeadline: number;
  /** true if already walked out. */
  left: boolean;
}

/** In-memory sim state per plot (not persisted). Cleared when restaurant closes. */
export interface PlotSimState {
  orders: Order[];
  customers: SimCustomer[];
  /** PlacedItem.id (stove) -> orderId currently cooking. */
  stoveOrder: Record<string, string>;
  /** Next order id prefix counter. */
  orderCounter: number;
  /** Next customer id prefix counter. */
  customerCounter: number;
  /** Last customer spawn time (ms). */
  lastSpawnAt: number;
}

export const PLOT_META_SCHEMA_VERSION = 1;
export const PLAYER_PROFILE_SCHEMA_VERSION = 1;
export const PLOT_STATE_SCHEMA_VERSION = 1;
