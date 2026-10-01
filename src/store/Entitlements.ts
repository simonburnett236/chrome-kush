// What the player owns. Stored locally for Phase 1; Phase 6 verifies receipts
// through the Cloudflare Worker before trusting these flags.

const KEY = "ck.entitlements.v1";

interface EntitlementState {
  noAds: boolean;
  premiumExpiresAt: number; // epoch ms, 0 = none
}

export class Entitlements {
  private state: EntitlementState;
  private listeners = new Set<() => void>();

  constructor() {
    this.state = { noAds: false, premiumExpiresAt: 0 };
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) this.state = { ...this.state, ...JSON.parse(raw) };
    } catch {
      /* ignore corrupt storage */
    }
  }

  get hasNoAdsPass(): boolean {
    return this.state.noAds;
  }

  get isPremium(): boolean {
    return this.state.premiumExpiresAt > Date.now();
  }

  get premiumExpiresAt(): number {
    return this.state.premiumExpiresAt;
  }

  /** Forced ads are off with either the No-Ads Pass or an active Premium plan. */
  get adsRemoved(): boolean {
    return this.hasNoAdsPass || this.isPremium;
  }

  grantNoAds(): void {
    this.state.noAds = true;
    this.save();
  }

  grantPremium(days = 30): void {
    const start = Math.max(Date.now(), this.state.premiumExpiresAt);
    this.state.premiumExpiresAt = start + days * 24 * 60 * 60 * 1000;
    this.save();
  }

  onChange(fn: () => void): void {
    this.listeners.add(fn);
  }

  private save(): void {
    localStorage.setItem(KEY, JSON.stringify(this.state));
    this.listeners.forEach((fn) => fn());
  }
}
