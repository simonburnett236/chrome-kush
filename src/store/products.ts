// Product catalog. SKUs must match the Amazon Developer Console IAP items.
// displayPrice is a fallback; Amazon's localized price replaces it at runtime.

export type ProductType = "entitlement" | "subscription" | "consumable";

export interface Product {
  sku: string;
  type: ProductType;
  title: string;
  description: string;
  displayPrice: string;
}

export const PRODUCTS = {
  NO_ADS: { sku: "com.simonburnett.chromekush.noads", type: "entitlement", title: "No-Ads Pass", description: "One-time purchase. Removes forced full-screen ads and banners forever.", displayPrice: "$2.99" },
  PREMIUM_MONTHLY: { sku: "com.simonburnett.chromekush.premium.monthly", type: "subscription", title: "Premium", description: "Monthly plan. No forced ads plus +3 moves on every level.", displayPrice: "$4.99 / month" },
  LIVES_REFILL: { sku: "com.simonburnett.chromekush.lives5", type: "consumable", title: "5 Lives", description: "Refill your lives to full right now.", displayPrice: "$0.99" },
  INFINITE_2H: { sku: "com.simonburnett.chromekush.infinite2h", type: "consumable", title: "Unlimited Lives (2 hours)", description: "Play as much as you want for 2 hours.", displayPrice: "$1.99" },
  COINS_S: { sku: "com.simonburnett.chromekush.coins500", type: "consumable", title: "500 Coins", description: "Coins for boosters and life refills.", displayPrice: "$0.99" },
  COINS_M: { sku: "com.simonburnett.chromekush.coins1500", type: "consumable", title: "1,500 Coins", description: "Best for regular players.", displayPrice: "$2.99" },
  COINS_L: { sku: "com.simonburnett.chromekush.coins5000", type: "consumable", title: "5,000 Coins", description: "Best value.", displayPrice: "$7.99" },
  BOOSTER_BUNDLE: { sku: "com.simonburnett.chromekush.boosterbundle", type: "consumable", title: "Booster Bundle", description: "2 of every booster.", displayPrice: "$3.99" },
} satisfies Record<string, Product>;

export const ALL_PRODUCTS: Product[] = Object.values(PRODUCTS);

export function productBySku(sku: string): Product | undefined {
  return ALL_PRODUCTS.find((p) => p.sku === sku);
}
