import type { GameSession } from "../game/GameSession";
import type { Wallet } from "../economy/Wallet";
import { BOOSTERS, ECONOMY, type BoosterId } from "../config";
import { fmtTime } from "./Dialogs";

export interface HudActions {
  onNav: (id: "inventory" | "shop" | "profile" | "map" | "settings") => void;
  onBooster: (id: BoosterId) => void;
  onMapButton: (id: "shop" | "spin" | "daily" | "settings" | "play" | "lives") => void;
}

/** DOM overlay for both screens: level HUD and map HUD. */
export class Hud {
  private level: HTMLElement;
  private map: HTMLElement;
  private els: Record<string, HTMLElement> = {};
  readonly mapBottom: HTMLElement;

  constructor(root: HTMLElement, private wallet: Wallet, private actions: HudActions) {
    root.innerHTML = `
      <div class="screen level-screen">
        <header class="hud-top">
          <div class="hud-row">
            <div class="pill"><span class="lbl">SCORE</span><span data-el="score">0</span></div>
            <div class="pill"><span class="lbl">MOVES</span><span data-el="moves">0</span></div>
            <div class="pill"><span class="lbl">LEVEL</span><span data-el="level">1</span></div>
          </div>
          <div class="faction" data-el="faction"></div>
          <div class="progress"><div class="bar" data-el="bar"></div><span class="target" data-el="target"></span></div>
          <div class="mult" data-el="mult"></div>
        </header>
        <section class="hud-bottom">
          <div class="powerups">
            <span class="lbl">Power-ups</span>
            <div class="slots" data-el="slots"></div>
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
      </div>
      <div class="screen map-screen">
        <header class="hud-top map-top">
          <div class="hud-row">
            <button class="pill" data-map="lives"><span class="lbl">LIVES</span><span data-el="lives"></span><small data-el="lifeTimer"></small></button>
            <div class="pill"><span class="lbl">COINS</span><span data-el="coins"></span></div>
            <div class="pill"><span class="lbl">STREAK</span><span data-el="streak"></span></div>
          </div>
          <h1 class="title">Chrome Kush</h1>
        </header>
        <section class="map-bottom" data-el="mapBottom">
          <button class="btn primary play" data-map="play">Play level <span data-el="nextLevel"></span></button>
          <nav class="nav">
            <button data-map="shop">Shop</button>
            <button data-map="spin">Lucky Spin<span class="dot" data-el="spinDot"></span></button>
            <button data-map="daily">Daily<span class="dot" data-el="dailyDot"></span></button>
            <button data-map="settings">Settings</button>
          </nav>
        </section>
      </div>
      <div class="toast" data-el="toast"></div>`;
    root.querySelectorAll<HTMLElement>("[data-el]").forEach((e) => (this.els[e.dataset.el!] = e));
    this.level = root.querySelector(".level-screen")!;
    this.map = root.querySelector(".map-screen")!;
    this.mapBottom = this.els.mapBottom;
    root.querySelectorAll<HTMLButtonElement>("[data-nav]").forEach((b) => b.addEventListener("click", () => actions.onNav(b.dataset.nav as any)));
    root.querySelectorAll<HTMLButtonElement>("[data-map]").forEach((b) => b.addEventListener("click", () => actions.onMapButton(b.dataset.map as any)));
    this.renderSlots();
    wallet.onChange(() => {
      this.renderSlots();
      this.updateMapStats();
    });
    window.setInterval(() => this.updateMapStats(), 1000);
  }

  showScreen(which: "level" | "map"): void {
    this.level.classList.toggle("active", which === "level");
    this.map.classList.toggle("active", which === "map");
  }

  private renderSlots(): void {
    const ids = (Object.keys(BOOSTERS) as BoosterId[]).filter((id) => BOOSTERS[id].when === "in");
    this.els.slots.innerHTML = ids
      .map((id) => `<button class="slot" data-boost="${id}" title="${BOOSTERS[id].desc}"><span>${BOOSTERS[id].icon}</span><small>${this.wallet.state.boosters[id] ?? 0}</small></button>`)
      .join("");
    this.els.slots.querySelectorAll<HTMLButtonElement>("[data-boost]").forEach((b) => b.addEventListener("click", () => this.actions.onBooster(b.dataset.boost as BoosterId)));
  }

  setArmed(id: BoosterId | null): void {
    this.els.slots.querySelectorAll<HTMLButtonElement>("[data-boost]").forEach((b) => b.classList.toggle("armed", b.dataset.boost === id));
  }

  update(s: GameSession): void {
    this.els.score.textContent = String(s.score);
    this.els.moves.textContent = String(s.movesLeft);
    this.els.level.textContent = String(s.level.id);
    this.els.faction.textContent = s.level.faction;
    this.els.tip.textContent = s.level.tip;
    this.els.target.textContent = `${s.score} / ${s.level.targetScore}`;
    this.els.bar.style.width = `${Math.round(s.progress * 100)}%`;
    this.els.mult.textContent = s.multiplier > 1 ? `Streak bonus x${s.multiplier.toFixed(2)}` : "";
    this.els.moves.parentElement!.classList.toggle("warn", s.movesLeft <= 3);
  }

  mapInfo = { streak: 0, nextLevel: 1, spin: false, daily: false };

  updateMapStats(): void {
    this.wallet.tick();
    const w = this.wallet;
    this.els.lives.textContent = w.hasInfiniteLives ? "Unlimited" : `${w.state.lives}/${ECONOMY.maxLives}`;
    this.els.lifeTimer.textContent = w.hasInfiniteLives ? fmtTime(w.state.infiniteUntil - Date.now()) : w.nextLifeIn ? `+1 in ${fmtTime(w.nextLifeIn)}` : "Full";
    this.els.coins.textContent = String(w.state.coins);
    this.els.streak.textContent = `${this.mapInfo.streak}d`;
    this.els.nextLevel.textContent = String(this.mapInfo.nextLevel);
    this.els.spinDot.classList.toggle("on", this.mapInfo.spin);
    this.els.dailyDot.classList.toggle("on", this.mapInfo.daily);
  }

  toast(msg: string): void {
    const t = this.els.toast;
    t.textContent = msg;
    t.classList.add("show");
    window.clearTimeout((t as any)._h);
    (t as any)._h = window.setTimeout(() => t.classList.remove("show"), 2400);
  }
}
