/**
 * Top right: player stats — cash (from profile), rating placeholder, optional premium.
 */

import type { PlayerProfile } from '../types.js';

export interface TopRightStatsState {
  cash: number;
  rating: number;
  premiumCurrency: number | null;
}

const PLACEHOLDER_RATING = 3;
const PLACEHOLDER_PREMIUM: number | null = null;

export function getTopRightState(profile: PlayerProfile | undefined): TopRightStatsState {
  if (!profile) {
    return {
      cash: 0,
      rating: PLACEHOLDER_RATING,
      premiumCurrency: PLACEHOLDER_PREMIUM,
    };
  }
  return {
    cash: profile.cash,
    rating: PLACEHOLDER_RATING,
    premiumCurrency: PLACEHOLDER_PREMIUM,
  };
}
