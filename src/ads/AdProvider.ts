// Network-agnostic ad interface. House ads today; a third-party network that
// accepts the theme can be dropped in later without touching game code.

export interface InterstitialProvider {
  readonly name: string;
  isReady(): boolean;
  /** Resolves when the ad is closed. minSeconds = forced wait before close. */
  showInterstitial(minSeconds: number): Promise<void>;
}

export interface RewardedProvider {
  readonly name: string;
  isReady(): boolean;
  /** Resolves true if the player watched long enough to earn the reward. */
  showRewarded(): Promise<boolean>;
}
