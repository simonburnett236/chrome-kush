import { Entitlements } from "./Entitlements";
import { PRODUCTS } from "./products";

export type PurchaseResult = { ok: true; sku: string } | { ok: false; reason: "cancelled" | "error"; message?: string };

/** Swap DevPurchaseService for an Amazon IAP implementation in Phase 6. */
export interface PurchaseService {
  purchase(sku: string): Promise<PurchaseResult>;
  restore(): Promise<string[]>;
}

/**
 * Placeholder store. Asks for confirmation and grants the item locally so the
 * whole ad-removal flow can be tested before Amazon IAP is connected.
 */
export class DevPurchaseService implements PurchaseService {
  constructor(private entitlements: Entitlements) {}

  async purchase(sku: string): Promise<PurchaseResult> {
    const product = Object.values(PRODUCTS).find((p) => p.sku === sku);
    if (!product) return { ok: false, reason: "error", message: "Unknown product" };
    const confirmed = window.confirm(
      `[TEST STORE] Simulate buying "${product.title}" for ${product.displayPrice}?\nNo real money is charged.`,
    );
    if (!confirmed) return { ok: false, reason: "cancelled" };
    this.apply(sku);
    return { ok: true, sku };
  }

  async restore(): Promise<string[]> {
    const owned: string[] = [];
    if (this.entitlements.hasNoAdsPass) owned.push(PRODUCTS.NO_ADS.sku);
    if (this.entitlements.isPremium) owned.push(PRODUCTS.PREMIUM_MONTHLY.sku);
    return owned;
  }

  private apply(sku: string): void {
    if (sku === PRODUCTS.NO_ADS.sku) this.entitlements.grantNoAds();
    if (sku === PRODUCTS.PREMIUM_MONTHLY.sku) this.entitlements.grantPremium(30);
  }
}
