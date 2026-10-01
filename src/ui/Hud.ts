import type { GameSession } from "../game/GameSession";
import type { Entitlements } from "../store/Entitlements";
import type { PurchaseService } from "../store/PurchaseService";
import { PRODUCTS } from "../store/products";

/** DOM overlay: top HUD, power-up bar, tip, bottom nav, modals and shop. */
export class Hud {

  private els: Record<string, HTMLElement> = {};

  constructor(
    root: HTMLElement,
    private entitlements: Entitlements,
    private purchases: PurchaseService,
  ) {

    root.innerHTML = `
      <header class="hud-top">
        <div class="hud-row">
          <div class="pill"><span class="lbl">SCORE</span><span data-el="score">0</span></div>
          <div class="pill"><span class="lbl">MOVES</span><span data-el="moves">0</span></div>
          <div class="pill"><span class="lbl">LEVEL</span><span data-el="level">1</span></div>
        </div>
        <div class="faction" data-el="faction"></div>
        <div class="progress"><div class="bar" data-el="bar"></div><span class="target" data-el="target"></span></div>
      </header>
      <section class="hud-bottom">
        <div class="powerups">
          <span class="lbl">Power-ups</span>
          <div class="slots"><div class="slot locked">?</div><div class="slot locked">?</div><div class="slot locked">?</div></div>
        </div>
        <div class="tip"><span class="lbl">Budtender's Tip</span><span data-el="tip"></span></div>
        <nav class="nav">
          <button data-nav="inventory">Inventory</button>
          <button data-nav="shop">Shop</button>
          <button data-nav="profile">Profile</button>
          <button data-nav="map">Map</button>
          <button data-nav="settings">Settings</button>
        </nav>
      </section>
      <div class="toast" data-el="toast"></div>`;
    root.querySelectorAll<HTMLElement>("[data-el]").forEach((el) => (this.els[el.dataset.el!] = el));
    root.querySelectorAll<HTMLButtonElement>("[data-nav]").forEach((btn) =>
      btn.addEventListener("click", () => {
        if (btn.dataset.nav === "shop") this.openShop();
        else this.toast(`${btn.textContent} is coming in a later update.`);
      }),
    );
  }

  update(s: GameSession): void {
    this.els.score.textContent = String(s.score);
    this.els.moves.textContent = String(s.movesLeft);
    this.els.level.textContent = String(s.level.id);
    this.els.faction.textContent = s.level.faction;
    this.els.tip.textContent = s.level.tip;
    this.els.target.textContent = `${s.score} / ${s.level.targetScore}`;
    this.els.bar.style.width = `${Math.round(s.progress * 100)}%`;
    this.els.moves.parentElement!.classList.toggle("warn", s.movesLeft <= 3);
  }

  toast(msg: string): void {
    const t = this.els.toast;
    t.textContent = msg;
    t.classList.add("show");
    window.clearTimeout((t as any)._h);
    (t as any)._h = window.setTimeout(() => t.classList.remove("show"), 2200);
  }

  /** Simple modal. Resolves with the id of the button pressed. */
  modal(title: string, body: string, buttons: Array<{ id: string; label: string; primary?: boolean }>): Promise<string> {
    return new Promise((resolve) => {
      const wrap = document.createElement("div");
      wrap.className = "modal-wrap";
      const card = document.createElement("div");
      card.className = "modal";
      const h = document.createElement("h2");
      h.textContent = title;
      const p = document.createElement("p");
      p.textContent = body;
      const row = document.createElement("div");
      row.className = "modal-buttons";
      for (const b of buttons) {
        const btn = document.createElement("button");
        btn.className = `btn${b.primary ? " primary" : ""}`;
        btn.textContent = b.label;
        btn.addEventListener("click", () => {
          wrap.remove();
          resolve(b.id);
        });
        row.appendChild(btn);
      }
      card.append(h, p, row);
      wrap.appendChild(card);
      document.body.appendChild(wrap);
    });
  }

  openShop(): void {
    const wrap = document.createElement("div");
    wrap.className = "modal-wrap";
    const render = () => {
      const e = this.entitlements;
      const premiumText = e.isPremium
        ? `Active until ${new Date(e.premiumExpiresAt).toLocaleDateString()}`
        : PRODUCTS.PREMIUM_MONTHLY.displayPrice;
      wrap.innerHTML = `
        <div class="modal shop">
          <h2>Shop</h2>
          <div class="shop-item">
            <div><strong>${PRODUCTS.NO_ADS.title}</strong><p>${PRODUCTS.NO_ADS.description}</p></div>
            <button class="btn primary" data-buy="${PRODUCTS.NO_ADS.sku}" ${e.hasNoAdsPass ? "disabled" : ""}>
              ${e.hasNoAdsPass ? "Owned" : PRODUCTS.NO_ADS.displayPrice}</button>
          </div>
          <div class="shop-item">
            <div><strong>${PRODUCTS.PREMIUM_MONTHLY.title}</strong><p>${PRODUCTS.PREMIUM_MONTHLY.description}</p></div>
            <button class="btn primary" data-buy="${PRODUCTS.PREMIUM_MONTHLY.sku}" ${e.isPremium ? "disabled" : ""}>${premiumText}</button>
          </div>
          <p class="fine">Power-up bundles, coins and lives arrive in a later update.</p>
          <div class="modal-buttons">
            <button class="btn" data-act="restore">Restore purchases</button>
            <button class="btn" data-act="close">Close</button>
          </div>
        </div>`;
      wrap.querySelectorAll<HTMLButtonElement>("[data-buy]").forEach((btn) =>
        btn.addEventListener("click", async () => {
          const res = await this.purchases.purchase(btn.dataset.buy!);
          if (res.ok) this.toast("Purchase complete. Ads are off.");
          render();
        }),
      );
      wrap.querySelector('[data-act="restore"]')!.addEventListener("click", async () => {
        const owned = await this.purchases.restore();
        this.toast(owned.length ? "Purchases restored." : "No purchases found.");
        render();
      });
      wrap.querySelector('[data-act="close"]')!.addEventListener("click", () => wrap.remove());
    };
    render();
    document.body.appendChild(wrap);
  }
}
