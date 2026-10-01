// Central tuning knobs. Change values here instead of hunting through code.

export const BOARD_SIZE = 8;
export const PIECE_SPACING = 1.0;

export const SCORE_PER_PIECE = 10;

export const AD_CONFIG = {
  /** Show a forced full-screen ad after every N completed levels (on Continue). */
  interstitialEveryNLevels: 2,
  /** Seconds the player must wait before the ad can be closed. */
  interstitialSeconds: 15,
};

export const PREMIUM_PERKS = {
  /** Extra moves granted at the start of every level for Premium subscribers. */
  bonusMovesPerLevel: 3,
};

/** Placeholder faction names shown in the HUD where the mockup said "STAGE". */
export const FACTIONS = ["Sativa Syndicate", "Indica Order", "Hybrid Collective"];

/** Piece kinds. Placeholder 3D shapes in Phase 1, real models in Phase 2. */
export const PIECE_KINDS = [
  { id: 0, name: "Bud", color: "#3fbf4a" },
  { id: 1, name: "Glass Pipe", color: "#4fd2e8" },
  { id: 2, name: "Bong", color: "#9b5de5" },
  { id: 3, name: "Lighter", color: "#f15b3b" },
  { id: 4, name: "Rolling Papers", color: "#f3ead2" },
  { id: 5, name: "Concentrate Jar", color: "#f2b632" },
] as const;
