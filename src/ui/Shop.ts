import { PRODUCTS, type Product } from "../store/products";
import type { PurchaseService } from "../store/PurchaseService";
import type { Entitlements } from "../store/Entitlements";
import type { Wallet } from "../economy/Wallet";
import { BOOSTERS, ECONOMY, type BoosterId } from "../config";

/** Shop: real-money items (Amazon IAP) and coin purchases for boosters/lives. */
export function openShop(deps: { purchases: PurchaseService; entitlements: Entitlements; wallet: Wallet; toast: (m: string) => void }): Promise<void> {
  const { purchases, entitlements, wallet, toast } = deps;
  return new Promise((resolve) => {
    const wrap = document.createElement("div");
    wrap.className = "modal-wrap";
    let tab: "remove" | "lives" | "coins" | "boosters" = "remove";
    const price = (p: Product) => purchases.priceFor(p.sku) ?? p.displayPrice;
    const item = (p: Product, owned = false) => `
      <div class="shop-item"><div><strong>${p.title}</strong><p>${p.description}</p></div>
      <button class="btn primary" data-buy="${p.sku}" ${owned ? "disabled" : ""}>${owned ? "Owned" : price(p)}</button></div>`;
    const render = () => {
      const e = entitlements;
      let body = "";
      if (tab === "remove") {
        body = item(PRODUCTS.NO_ADS, e.hasNoAdsPass) + (e.isPremium
          ? `<div class="shop-item"><div><strong>Premium</strong><p>Active until ${new Date(e.premiumExpiresAt).toLocaleDateString()}</p></div></div>`
          : item(PRODUCTS.PREMIUM_MONTHLY));
      } else if (tab === "lives") {
        body = item(PRODUCTS.LIVES_REFILL) + item(PRODUCTS.INFINITE_2H) +
          `<div class="shop-item"><div><strong>Refill with coins</strong><p>Lives back to ${ECONOMY.maxLives}.</p></div>
           <button class="btn" data-coins-lives="1">${ECONOMY.livesRefillCoinPrice} coins</button></div>`;
      } else if (tab === "coins") {
        body = item(PRODUCTS.COINS_S) + item(PRODUCTS.COINS_M) + item(PRODUCTS.COINS_L);
      } else {
        body = item(PRODUCTS.BOOSTER_BUNDLE) + (Object.keys(BOOSTERS) as BoosterId[])
          .map((id) => `<div class="shop-item"><div><strong>${BOOSTERS[id].name}</strong> <small>(have ${wallet.state.boosters[id] ?? 0})</small><p>${BOOSTERS[id].desc}</p></div>
            <button class="btn" data-coins-boost="${id}">${BOOSTERS[id].coinPrice} coins</button></div>`).join("");
      }
      wrap.innerHTML = `
        <div class="modal shop">
          <h2>Shop</h2>
          <p class="coins-line">Coins: <strong>${wallet.state.coins}</strong></p>
          <div class="tabs">
            ${(["remove", "lives", "coins", "boosters"] as const).map((t) => `<button class="tab ${t === tab ? "on" : ""}" data-tab="${t}">${{ remove: "No Ads", lives: "Lives", coins: "Coins", boosters: "Boosters" }[t]}</button>`).join("")}
          </div>
          <div class="shop-list">${body}</div>
          ${purchases.mode === "web" ? `<p class="fine">Real-money items are available in the Amazon Appstore app.</p>` : ""}
          ${purchases.mode === "test" ? `<p class="fine">Test store: no real money is charged.</p>` : ""}
          <div class="modal-buttons">
            <button class="btn" data-act="restore">Restore purchases</button>
            <button class="btn" data-act="close">Close</button>
          </div>
        </div>`;
      wrap.querySelectorAll<HTMLButtonElement>("[data-tab]").forEach((b) => b.addEventListener("click", () => ((tab = b.dataset.tab as any), render())));
      wrap.querySelectorAll<HTMLButtonElement>("[data-buy]").forEach((b) =>
        b.addEventListener("click", async () => {
          b.disabled = true;
          const res = await purchases.purchase(b.dataset.buy!);
          if (res.ok) toast("Purchase complete.");
          else if (res.reason !== "cancelled") toast(res.message ?? "Purchase didn't go through.");
          render();
        }),
      );
      wrap.querySelector("[data-coins-lives]")?.addEventListener("click", () => {
        if (wallet.state.lives >= ECONOMY.maxLives) return toast("Lives are already full.");
        if (wallet.spendCoins(ECONOMY.livesRefillCoinPrice)) (wallet.refillLives(), toast("Lives refilled."));
        else toast("Not enough coins.");
        render();
      });
      wrap.querySelectorAll<HTMLButtonElement>("[data-coins-boost]").forEach((b) =>
        b.addEventListener("click", () => {
          const id = b.dataset.coinsBoost as BoosterId;
          if (wallet.spendCoins(BOOSTERS[id].coinPrice)) (wallet.addBooster(id), toast(`${BOOSTERS[id].name} added.`));
          else toast("Not enough coins.");
          render();
        }),
      );
      wrap.querySelector('[data-act="restore"]')!.addEventListener("click", async () => {
        const owned = await purchases.restore();
        toast(owned.length ? "Purchases restored." : "No purchases to restore.");
        render();
      });
      wrap.querySelector('[data-act="close"]')!.addEventListener("click", () => (wrap.remove(), resolve()));
    };
    render();
    document.body.appendChild(wrap);
  });
}
