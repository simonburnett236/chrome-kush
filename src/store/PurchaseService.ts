import { Entitlements } from "./Entitlements";
import { productBySku } from "./products";
import { fulfill } from "./fulfill";
import type { Wallet } from "../economy/Wallet";

export type PurchaseResult = { ok: true; sku: string } | { ok: false; reason: "cancelled" | "error" | "pending"; message?: string };

export interface PurchaseService {
  readonly mode: "amazon" | "test" | "web";
  /** Localized price for a SKU when the store provides one. */
  priceFor(sku: string): string | undefined;
  purchase(sku: string): Promise<PurchaseResult>;
  restore(): Promise<string[]>;
}

/** Test store: confirms and grants locally. Enabled in dev or with ?teststore=1. */
export class DevPurchaseService implements PurchaseService {
  readonly mode = "test" as const;
  constructor(private entitlements: Entitlements, private wallet: Wallet) {}

  priceFor(): string | undefined {
    return undefined;
  }

  async purchase(sku: string): Promise<PurchaseResult> {
    const product = productBySku(sku);
    if (!product) return { ok: false, reason: "error", message: "Unknown product" };
    const confirmed = window.confirm(`[TEST STORE] Simulate buying "${product.title}" for ${product.displayPrice}?\nNo real money is charged.`);
    if (!confirmed) return { ok: false, reason: "cancelled" };
    fulfill(sku, this.entitlements, this.wallet);
    return { ok: true, sku };
  }

  async restore(): Promise<string[]> {
    return [];
  }
}

/** Plain web build: purchases happen only in the Amazon Appstore app. */
export class WebOnlyPurchaseService implements PurchaseService {
  readonly mode = "web" as const;
  priceFor(): string | undefined {
    return undefined;
  }
  async purchase(): Promise<PurchaseResult> {
    return { ok: false, reason: "error", message: "Purchases are available in the Amazon Appstore version of Chrome Kush." };
  }
  async restore(): Promise<string[]> {
    return [];
  }
}
