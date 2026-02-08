/**
 * Phase 4: Player interact at stove (start cook / pick up ready) or table (deliver).
 */

import type { Player } from 'hytopia';
import type { PlotId, Vec3 } from '../types.js';
import { getCachedPlotState } from '../persistence/plotStateCache.js';
import { setCachedPlotState } from '../persistence/plotStateCache.js';
import { getPlayerProfile, updatePlayerProfile } from '../persistence/playerProfile.js';
import { getSimState } from './state.js';
import { getCookingZones, getSeatingZones, distanceXZ } from './zones.js';
import { MENU, SIM_INTERACT_RADIUS, SIM_RATING_SUCCESS_DELTA, RATING_MAX } from '../config.js';

export interface InteractResult {
  ok: boolean;
  message: string;
}

/** In-memory: playerId -> orderId they are carrying (ready order from stove to table). */
const playerCarryingOrder = new Map<string, string>();

export function getCarriedOrderId(playerId: string): string | null {
  return playerCarryingOrder.get(playerId) ?? null;
}

/**
 * Handle interact at position. Prefer stove if in range (start cook or pick up ready), else table (deliver).
 */
export function handleInteract(
  player: Player,
  plotId: PlotId,
  playerPosition: Vec3
): InteractResult {
  const playerId = player.id;
  const plotState = getCachedPlotState(plotId);
  if (!plotState) return { ok: false, message: 'No plot state.' };
  const sim = getSimState(plotId);
  const cooking = getCookingZones(plotState);
  const seating = getSeatingZones(plotState);

  const carried = playerCarryingOrder.get(playerId);

  // If carrying an order, try to deliver at a table
  if (carried) {
    const order = sim.orders.find((o) => o.orderId === carried);
    if (!order || order.status !== 'ready') {
      playerCarryingOrder.delete(playerId);
      return { ok: false, message: 'Order no longer ready.' };
    }
    for (const seat of seating) {
      if (distanceXZ(playerPosition, seat.position) <= SIM_INTERACT_RADIUS && seat.placedItemId === order.seatId) {
        return completeOrder(player, plotId, order.orderId, plotState);
      }
    }
    return { ok: false, message: 'Go to the customer\'s table to deliver.' };
  }

  // Try stove: start cooking a pending order, or pick up a ready order
  for (const zone of cooking) {
    if (distanceXZ(playerPosition, zone.position) > SIM_INTERACT_RADIUS) continue;
    if (!sim.stoveOrder[zone.placedItemId]) {
      const pending = sim.orders.find((o) => o.status === 'pending');
      if (pending) {
        pending.status = 'in_progress';
        pending.startedAt = Date.now();
        sim.stoveOrder[zone.placedItemId] = pending.orderId;
        return { ok: true, message: `Cooking ${pending.dishId}...` };
      }
      const ready = sim.orders.find((o) => o.status === 'ready');
      if (ready) {
        playerCarryingOrder.set(playerId, ready.orderId);
        return { ok: true, message: `Picked up order for table.` };
      }
      return { ok: false, message: 'No orders to cook.' };
    }
    const orderId = sim.stoveOrder[zone.placedItemId];
    const order = sim.orders.find((o) => o.orderId === orderId);
    if (order?.status === 'ready') {
      playerCarryingOrder.set(playerId, order.orderId);
      delete sim.stoveOrder[zone.placedItemId];
      return { ok: true, message: 'Picked up order. Take it to the table.' };
    }
    return { ok: false, message: 'Still cooking...' };
  }

  // Try table: deliver (only if carrying)
  for (const seat of seating) {
    if (distanceXZ(playerPosition, seat.position) > SIM_INTERACT_RADIUS) continue;
    return { ok: false, message: 'No order to deliver. Take one from the stove.' };
  }

  return { ok: false, message: 'Move near a stove or table.' };
}

function completeOrder(
  player: Player,
  plotId: PlotId,
  orderId: string,
  plotState: import('../types.js').PlotState
): InteractResult {
  const playerId = player.id;
  const sim = getSimState(plotId);
  const order = sim.orders.find((o) => o.orderId === orderId);
  if (!order || order.status !== 'ready') {
    playerCarryingOrder.delete(playerId);
    return { ok: false, message: 'Order not ready.' };
  }
  const menuEntry = MENU[order.dishId];
  const price = menuEntry?.price ?? 0;
  order.status = 'completed';
  order.completedAt = Date.now();
  playerCarryingOrder.delete(playerId);

  const profile = getPlayerProfile(player);
  if (profile) {
    updatePlayerProfile(player, { cash: profile.cash + price });
  }
  const newRating = Math.min(RATING_MAX, (plotState.rating ?? 0) + SIM_RATING_SUCCESS_DELTA);
  setCachedPlotState(plotId, { ...plotState, rating: newRating });
  return { ok: true, message: `Delivered! +$${price}` };
}

export function clearCarriedOnLeave(playerId: string): void {
  playerCarryingOrder.delete(playerId);
}
