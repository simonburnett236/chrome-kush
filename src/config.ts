// Central tuning knobs. Change values here instead of hunting through code.

export const BOARD_SIZE = 8;
export const PIECE_SPACING = 1.0;
export const SCORE_PER_PIECE = 10;

export const AD_CONFIG = {
  /** Show a forced full-screen ad after every N completed levels (on Continue). */
  interstitialEveryNLevels: 2,
  /** Seconds the player must wait before a forced ad can be closed. */
  interstitialSeconds: 15,
  /** Seconds a rewarded ad must be watched to earn the reward. */
  rewardedSeconds: 30,
  /** Max "watch an ad for +1 life" per day. */
  maxRewardedLivesPerDay: 3,
  /** Moves granted by "watch an ad for more moves". */
  rewardedExtraMoves: 5,
};

export const ECONOMY = {
  maxLives: 5,
  lifeRefillMinutes: 30,
  winCoins: 20,
  coinsPerMoveLeft: 2,
  /** Coin price to refill lives to max from the out-of-lives screen. */
  livesRefillCoinPrice: 300,
};

export const PREMIUM_PERKS = {
  /** Extra moves granted at the start of every level for Premium subscribers. */
  bonusMovesPerLevel: 3,
};

/** Minimum age shown on the first-launch age gate. */
export const MIN_AGE = 18;

/** Placeholder faction names shown in the HUD where the mockup said "STAGE". */
export const FACTIONS = ["Sativa Syndicate", "Indica Order", "Hybrid Collective"];

export const PIECE_KINDS = [
  { id: 0, name: "Bud", color: "#3fbf4a" },
  { id: 1, name: "Glass Pipe", color: "#4fd2e8" },
  { id: 2, name: "Bong", color: "#9b5de5" },
  { id: 3, name: "Lighter", color: "#f15b3b" },
  { id: 4, name: "Rolling Papers", color: "#f3ead2" },
  { id: 5, name: "Concentrate Jar", color: "#f2b632" },
] as const;

export type BoosterId = "hammer" | "shuffle" | "extraMoves" | "blast";

export const BOOSTERS: Record<BoosterId, { name: string; desc: string; when: "pre" | "in"; coinPrice: number; icon: string }> = {
  hammer: { name: "Lighter", desc: "Burn away any one piece or cage. Uses no move.", when: "in", coinPrice: 100, icon: "L" },
  shuffle: { name: "Shuffle", desc: "Reshuffle the board. Uses no move.", when: "in", coinPrice: 60, icon: "S" },
  extraMoves: { name: "+3 Moves", desc: "Start the level with 3 extra moves.", when: "pre", coinPrice: 80, icon: "+3" },
  blast: { name: "Starter Blast", desc: "Start the level by clearing a row and a column.", when: "pre", coinPrice: 120, icon: "B" },
};
