/**
 * Phase 4: Sim tick — customer spawn, order creation, cook timers, walkouts.
 */

import type { PlotId, Order, SimCustomer } from '../types.js';
import type { PlotState } from '../types.js';
import { getCachedPlotState } from '../persistence/plotStateCache.js';
import { setCachedPlotState } from '../persistence/plotStateCache.js';
import { getSimState } from './state.js';
import { getSeatingZones } from './zones.js';
import {
  SIM_CUSTOMER_SPAWN_INTERVAL_MS,
  SIM_ORDER_CREATE_DELAY_MS,
  SIM_PATIENCE_MS,
  SIM_COOK_TIME_MS,
  SIM_RATING_SUCCESS_DELTA,
  SIM_RATING_WALKOUT_PENALTY,
  MENU,
  RATING_MAX,
} from '../config.js';

/** Run one sim tick for a plot. Call only when plot is open and has valid state. */
export function runSimTick(
  plotId: PlotId,
  plotState: PlotState,
  now: number,
  ownerId: string | null,
  unlocks: string[]
): void {
  const sim = getSimState(plotId);
  const seats = getSeatingZones(plotState);
  if (seats.length === 0) return;

  const dishIds = unlocks.filter((id) => MENU[id]);
  if (dishIds.length === 0) return;

  // Spawn new customer if interval elapsed
  if (now - sim.lastSpawnAt >= SIM_CUSTOMER_SPAWN_INTERVAL_MS) {
    sim.customerCounter += 1;
    const customerId = `cust-${sim.customerCounter}-${now}`;
    const seat = seats[sim.customers.length % seats.length];
    sim.customers.push({
      customerId,
      spawnedAt: now,
      orderId: null,
      seatId: seat.placedItemId,
      patienceDeadline: now + SIM_ORDER_CREATE_DELAY_MS + SIM_PATIENCE_MS,
      left: false,
    });
    sim.lastSpawnAt = now;
  }

  // Create orders for customers that have been “at order” for SIM_ORDER_CREATE_DELAY_MS
  for (const c of sim.customers) {
    if (c.left || c.orderId) continue;
    if (now - c.spawnedAt < SIM_ORDER_CREATE_DELAY_MS) continue;
    sim.orderCounter += 1;
    const orderId = `order-${sim.orderCounter}-${now}`;
    const dishId = dishIds[Math.floor(Math.random() * dishIds.length)];
    c.orderId = orderId;
    const seatId = c.seatId ?? seats[0].placedItemId;
    sim.orders.push({
      orderId,
      dishId,
      customerId: c.customerId,
      status: 'pending',
      createdAt: now,
      seatId,
    });
  }

  // Advance cook timers: in_progress -> ready when cook time elapsed
  for (const [stoveId, orderId] of Object.entries(sim.stoveOrder)) {
    const order = sim.orders.find((o) => o.orderId === orderId);
    if (!order || order.status !== 'in_progress' || !order.startedAt) continue;
    const menuEntry = MENU[order.dishId];
    const cookTime = menuEntry?.cookTimeMs ?? SIM_COOK_TIME_MS;
    if (now - order.startedAt >= cookTime) {
      order.status = 'ready';
      order.readyAt = now;
      delete sim.stoveOrder[stoveId];
    }
  }

  // Walkouts: customer patience expired -> fail order, remove customer, rating penalty
  let ratingDelta = 0;
  for (const c of sim.customers) {
    if (c.left || !c.orderId) continue;
    if (now <= c.patienceDeadline) continue;
    c.left = true;
    const order = sim.orders.find((o) => o.orderId === c.orderId);
    if (order && order.status !== 'completed' && order.status !== 'failed') {
      order.status = 'failed';
      if (order.startedAt) {
        for (const [stoveId, oid] of Object.entries(sim.stoveOrder)) {
          if (oid === order.orderId) {
            delete sim.stoveOrder[stoveId];
            break;
          }
        }
      }
      ratingDelta -= SIM_RATING_WALKOUT_PENALTY;
    }
  }
  if (ratingDelta !== 0) {
    const current = getCachedPlotState(plotId) ?? plotState;
    const newRating = Math.max(0, (current.rating ?? 0) + ratingDelta);
    setCachedPlotState(plotId, { ...current, rating: newRating });
  }
}
