import type { RewardedProvider } from "./AdProvider";
import { HOUSE_CREATIVES } from "./HouseAdProvider";

/** House rewarded ad: the player watches for N seconds to earn the reward. */
export class HouseRewardedProvider implements RewardedProvider {
  readonly name = "house-rewarded";
  private index = 1;
  constructor(private seconds: number) {}

  isReady(): boolean {
    return true;
  }

  showRewarded(): Promise<boolean> {
    const creative = HOUSE_CREATIVES[this.index++ % HOUSE_CREATIVES.length];
    return new Promise((resolve) => {
      const el = document.createElement("div");
      el.className = "ad-overlay";
      el.innerHTML = `
        <div class="ad-badge">Ad - reward</div>
        <div class="ad-timer"></div>
        <div class="ad-card"><h2></h2><p></p></div>
        <button class="btn ad-close">Skip (no reward)</button>`;
      el.querySelector("h2")!.textContent = creative.headline;
      el.querySelector("p")!.textContent = creative.body;
      const timer = el.querySelector<HTMLDivElement>(".ad-timer")!;
      const close = el.querySelector<HTMLButtonElement>(".ad-close")!;
      document.body.appendChild(el);
      let remaining = this.seconds;
      let earned = false;
      const tick = () => {
        if (remaining <= 0) {
          earned = true;
          timer.textContent = "Reward earned";
          close.textContent = "Collect reward";
          close.classList.add("primary");
          window.clearInterval(h);
          return;
        }
        timer.textContent = `Reward in ${remaining}s`;
        remaining--;
      };
      const h = window.setInterval(tick, 1000);
      tick();
      close.addEventListener("click", () => {
        window.clearInterval(h);
        el.remove();
        resolve(earned);
      });
    });
  }
}
