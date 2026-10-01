// Product catalog. SKUs must match what is configured in the Amazon Developer
// Console once Amazon In-App Purchasing is wired up. Prices are placeholders;
// Amazon sets the real localized price.

export type ProductType = "entitlement" | "subscription" | "consumable";

export interface Product {
  sku: string;
  type: ProductType;
  title: string;
  description: string;
  displayPrice: string;
}

export const PRODUCTS = {
  NO_ADS: {
    sku: "com.simonburnett.chromekush.noads",
    type: "entitlement",
    title: "No-Ads Pass",
    description: "One-time purchase. Removes forced full-screen ads forever.",
    displayPrice: "$2.99",
  },
  PREMIUM_MONTHLY: {
    sku: "com.simonburnett.chromekush.premium.monthly",
    type: "subscription",
    title: "Premium",
    description: "Monthly plan. No forced ads plus +3 moves on every level.",
    displayPrice: "$4.99 / month",
  },
} satisfies Record<string, Product>;
