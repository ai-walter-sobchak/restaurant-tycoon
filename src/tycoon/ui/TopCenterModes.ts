/**
 * Top center: primary mode buttons (Build, Shop, Restaurant Open/Closed).
 * Visual only; active state highlight supported. No logic yet.
 */

export type PrimaryMode = 'build' | 'shop' | 'restaurant';

export interface TopCenterModesState {
  activeMode: PrimaryMode | null;
  restaurantOpen: boolean;
  /** Phase 4: next goal hint. */
  nextGoal: string | null;
}

export function getDefaultTopCenterState(): TopCenterModesState {
  return {
    activeMode: null,
    restaurantOpen: false,
    nextGoal: null,
  };
}

/** Map ModuleKind to primary mode button highlight. */
export function activeModuleToMode(activeModule: 'NONE' | 'BUILD' | 'SHOP' | 'RESTAURANT'): TopCenterModesState['activeMode'] {
  if (activeModule === 'BUILD') return 'build';
  if (activeModule === 'SHOP') return 'shop';
  if (activeModule === 'RESTAURANT') return 'restaurant';
  return null;
}

/** Top-center state from active module and profile (restaurantOpen). */
export function getTopCenterState(
  activeModule: 'NONE' | 'BUILD' | 'SHOP' | 'RESTAURANT',
  options?: { restaurantOpen?: boolean; nextGoal?: string | null }
): TopCenterModesState {
  return {
    activeMode: activeModuleToMode(activeModule),
    restaurantOpen: options?.restaurantOpen ?? false,
    nextGoal: options?.nextGoal ?? null,
  };
}
