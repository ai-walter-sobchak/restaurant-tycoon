/**
 * Phase 4: In-memory sim state per plot. Cleared when restaurant closes.
 */

import type { PlotId, PlotSimState } from '../types.js';

const simStateByPlot = new Map<PlotId, PlotSimState>();

export function getSimState(plotId: PlotId): PlotSimState {
  let s = simStateByPlot.get(plotId);
  if (!s) {
    s = {
      orders: [],
      customers: [],
      stoveOrder: {},
      orderCounter: 0,
      customerCounter: 0,
      lastSpawnAt: 0,
    };
    simStateByPlot.set(plotId, s);
  }
  return s;
}

export function clearSimState(plotId: PlotId): void {
  simStateByPlot.delete(plotId);
}

export function getOrCreateSimState(plotId: PlotId): PlotSimState {
  return getSimState(plotId);
}
