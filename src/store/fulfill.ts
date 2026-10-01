import { PRODUCTS } from "./products";
import type { Entitlements } from "./Entitlements";
import type { Wallet } from "../economy/Wallet";

/** Give the player what a SKU buys. Shared by the test store and Amazon IAP. */
export function fulfill(sku: string, entitlements: Entitlements, wallet: Wallet, premiumUntil?: number): void {
  switch (sku) {
    case PRODUCTS.NO_ADS.sku:
      entitlements.grantNoAds();
      break;
    case PRODUCTS.PREMIUM_MONTHLY.sku:
      if (premiumUntil) entitlements.setPremiumUntil(premiumUntil);
      else entitlements.grantPremium(30);
      break;
    case PRODUCTS.LIVES_REFILL.sku:
      wallet.refillLives();
      break;
    case PRODUCTS.INFINITE_2H.sku:
      wallet.addInfiniteLives(2 * 60 * 60 * 1000);
      break;
    case PRODUCTS.COINS_S.sku:
      wallet.addCoins(500);
      break;
    case PRODUCTS.COINS_M.sku:
      wallet.addCoins(1500);
      break;
    case PRODUCTS.COINS_L.sku:
      wallet.addCoins(5000);
      break;
    case PRODUCTS.BOOSTER_BUNDLE.sku:
      (["hammer", "shuffle", "extraMoves", "blast"] as const).forEach((id) => wallet.addBooster(id, 2));
      break;
  }
}
