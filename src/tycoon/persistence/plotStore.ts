/**
 * Game key-value store: "plot:<plotId>" = PlotMeta, "plotState:<plotId>" = PlotState.
 */

import { PersistenceManager } from 'hytopia';
import type { PlotId, PlotMeta, PlotState } from '../types.js';
import { PLOT_STATE_SCHEMA_VERSION } from '../types.js';
import { migratePlotMeta, migratePlotState } from './migrate.js';

const META_PREFIX = 'plot:';
const STATE_PREFIX = 'plotState:';

function metaKey(plotId: PlotId): string {
  return META_PREFIX + String(plotId);
}
function stateKey(plotId: PlotId): string {
  return STATE_PREFIX + String(plotId);
}

export async function getPlotMeta(
  plotId: PlotId,
  maxRetries?: number
): Promise<PlotMeta | undefined> {
  const raw = await PersistenceManager.instance.getGlobalData(
    metaKey(plotId),
    maxRetries
  );
  if (!raw || typeof raw !== 'object') return undefined;
  return migratePlotMeta(raw as Record<string, unknown>) as PlotMeta;
}

export async function setPlotMeta(plotId: PlotId, meta: PlotMeta): Promise<void> {
  await PersistenceManager.instance.setGlobalData(metaKey(plotId), {
    ...meta,
    updatedAt: Date.now(),
  });
}

export async function getPlotState(
  plotId: PlotId,
  maxRetries?: number
): Promise<PlotState | undefined> {
  const raw = await PersistenceManager.instance.getGlobalData(
    stateKey(plotId),
    maxRetries
  );
  if (!raw || typeof raw !== 'object') return undefined;
  return migratePlotState(raw as Record<string, unknown>) as PlotState;
}

export async function setPlotState(plotId: PlotId, state: PlotState): Promise<void> {
  await PersistenceManager.instance.setGlobalData(stateKey(plotId), {
    ...state,
    updatedAt: Date.now(),
  });
}

/** Default plot state when none exists yet. Persist this so the engine doesn't warn on missing key. */
export function getDefaultPlotState(plotId: PlotId): PlotState {
  return {
    schemaVersion: PLOT_STATE_SCHEMA_VERSION,
    updatedAt: Date.now(),
    ownerId: null,
    placedItems: [],
    restaurantSettings: { isOpen: false },
    rating: 0,
  };
}
