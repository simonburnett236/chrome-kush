import type { InterstitialProvider } from "./AdProvider";

export interface HouseCreative {
  headline: string;
  body: string;
  cta: string;
  action: "remove_ads" | "url" | "sponsor";
  url?: string;
}

// Our own ad inventory. Sponsor slots can be sold directly and added here.
export const HOUSE_CREATIVES: HouseCreative[] = [
  {
    headline: "Tired of waiting?",
    body: "Get the No-Ads Pass and skip every forced ad. One payment, forever.",
    cta: "Remove Ads",
    action: "remove_ads",
  },
  {
    headline: "BillBoss",
    body: "Track bills, gig miles and real pay in one simple app.",
    cta: "Check it out",
    action: "url",
    url: "https://billboss.simonburnett236.workers.dev",
  },
  {
    headline: "Your brand here",
    body: "Sponsor slots are open. Reach Chrome Kush players between levels.",
    cta: "Learn more",
    action: "sponsor",
  },
];

export class HouseAdProvider implements InterstitialProvider {
  readonly name = "house";
  private index = 0;

  constructor(private hooks: { onRemoveAds: () => void }) {}

  isReady(): boolean {
    return HOUSE_CREATIVES.length > 0;
  }

  showInterstitial(minSeconds: number): Promise<void> {
    const creative = HOUSE_CREATIVES[this.index++ % HOUSE_CREATIVES.length];
    return new Promise((resolve) => {
      const el = document.createElement("div");
      el.className = "ad-overlay";
      el.innerHTML = `
        <div class="ad-badge">Ad</div>
        <div class="ad-timer"></div>
        <div class="ad-card">
          <h2></h2>
          <p></p>
          <button class="btn primary ad-cta"></button>
        </div>
        <button class="btn ad-close" disabled>Close</button>`;
      el.querySelector("h2")!.textContent = creative.headline;
      el.querySelector("p")!.textContent = creative.body;
      const cta = el.querySelector<HTMLButtonElement>(".ad-cta")!;
      cta.textContent = creative.cta;
      const timer = el.querySelector<HTMLDivElement>(".ad-timer")!;
      const close = el.querySelector<HTMLButtonElement>(".ad-close")!;
      document.body.appendChild(el);

      let remaining = minSeconds;
      const tick = () => {
        timer.textContent = remaining > 0 ? `Close in ${remaining}s` : "";
        if (remaining <= 0) {
          close.disabled = false;
          window.clearInterval(handle);
        }
        remaining--;
      };
      const handle = window.setInterval(tick, 1000);
      tick();

      const finish = () => {
        window.clearInterval(handle);
        el.remove();
        resolve();
      };
      close.addEventListener("click", finish);
      cta.addEventListener("click", () => {
        if (creative.action === "remove_ads") {
          finish();
          this.hooks.onRemoveAds();
        } else if (creative.action === "url" && creative.url) {
          window.open(creative.url, "_blank");
        }
      });
    });
  }
}
