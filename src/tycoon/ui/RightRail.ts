/**
 * Right vertical rail: timed/meta actions — Daily Rewards, Bonuses, Seasons.
 * Badge indicators static for now.
 */

export interface RightRailState {
  dailyRewardsBadge: boolean;
  bonusesBadge: boolean;
  seasonsBadge: boolean;
}

export function getRightRailState(): RightRailState {
  return {
    dailyRewardsBadge: false,
    bonusesBadge: false,
    seasonsBadge: false,
  };
}
