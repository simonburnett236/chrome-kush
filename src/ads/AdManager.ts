import type { InterstitialProvider } from "./AdProvider";
import type { Entitlements } from "../store/Entitlements";

const KEY = "ck.ads.levelsSinceAd";

export interface AdSettings {
  interstitialEveryNLevels: number;
  interstitialSeconds: number;
}

/**
 * Decides when forced ads run. Rules:
 * - only after the player taps Continue on a completed level
 * - every N completed levels
 * - never for No-Ads Pass or Premium players
 */
export class AdManager {
  private levelsSinceAd: number;

  constructor(
    private provider: InterstitialProvider,
    private entitlements: Entitlements,
    private settings: AdSettings,
  ) {
    this.levelsSinceAd = Number(localStorage.getItem(KEY) ?? 0) || 0;
  }

  setProvider(provider: InterstitialProvider): void {
    this.provider = provider;
  }

  /** Call when the player taps Continue after winning. Resolves after any ad. */
  async onLevelCompletedContinue(): Promise<void> {
    if (this.entitlements.adsRemoved) return;
    this.levelsSinceAd++;
    if (this.levelsSinceAd >= this.settings.interstitialEveryNLevels && this.provider.isReady()) {
      this.levelsSinceAd = 0;
      this.persist();
      await this.provider.showInterstitial(this.settings.interstitialSeconds);
      return;
    }
    this.persist();
  }

  private persist(): void {
    localStorage.setItem(KEY, String(this.levelsSinceAd));
  }
}
