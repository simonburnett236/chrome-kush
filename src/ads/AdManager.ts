import type { InterstitialProvider, RewardedProvider } from "./AdProvider";
import type { Entitlements } from "../store/Entitlements";

const KEY = "ck.ads.levelsSinceAd";

export interface AdSettings {
  interstitialEveryNLevels: number;
  interstitialSeconds: number;
}

/**
 * Decides when ads run.
 * Forced: only after Continue on a completed level, every N levels, never for No-Ads/Premium.
 * Rewarded: always optional, available to everyone (including ad-free players).
 */
export class AdManager {
  private levelsSinceAd: number;

  constructor(
    private interstitial: InterstitialProvider,
    private rewarded: RewardedProvider,
    private entitlements: Entitlements,
    private settings: AdSettings,
  ) {
    this.levelsSinceAd = Number(localStorage.getItem(KEY) ?? 0) || 0;
  }

  setProviders(p: { interstitial?: InterstitialProvider; rewarded?: RewardedProvider }): void {
    if (p.interstitial) this.interstitial = p.interstitial;
    if (p.rewarded) this.rewarded = p.rewarded;
  }

  async onLevelCompletedContinue(): Promise<void> {
    if (this.entitlements.adsRemoved) return;
    this.levelsSinceAd++;
    if (this.levelsSinceAd >= this.settings.interstitialEveryNLevels && this.interstitial.isReady()) {
      this.levelsSinceAd = 0;
      localStorage.setItem(KEY, "0");
      await this.interstitial.showInterstitial(this.settings.interstitialSeconds);
      return;
    }
    localStorage.setItem(KEY, String(this.levelsSinceAd));
  }

  /** Returns true when the player watched the whole rewarded ad. */
  async showRewarded(): Promise<boolean> {
    if (!this.rewarded.isReady()) return false;
    return this.rewarded.showRewarded();
  }
}
