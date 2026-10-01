import { HOUSE_CREATIVES } from "./HouseAdProvider";

/** Static house banner. Only mounted on menu screens (map), never in a level. */
export class Banner {
  private el: HTMLDivElement;
  private i = 0;
  private timer = 0;

  constructor(private onRemoveAds: () => void) {
    this.el = document.createElement("div");
    this.el.className = "banner";
    this.el.addEventListener("click", () => {
      const c = HOUSE_CREATIVES[(this.i + HOUSE_CREATIVES.length - 1) % HOUSE_CREATIVES.length];
      if (c.action === "remove_ads") this.onRemoveAds();
      else if (c.action === "url" && c.url) window.open(c.url, "_blank");
    });
  }

  show(parent: HTMLElement): void {
    parent.appendChild(this.el);
    this.rotate();
    window.clearInterval(this.timer);
    this.timer = window.setInterval(() => this.rotate(), 20000);
  }

  hide(): void {
    window.clearInterval(this.timer);
    this.el.remove();
  }

  private rotate(): void {
    const c = HOUSE_CREATIVES[this.i++ % HOUSE_CREATIVES.length];
    this.el.innerHTML = `<span class="ad-badge-sm">Ad</span><strong></strong> <span></span>`;
    this.el.querySelector("strong")!.textContent = c.headline;
    this.el.querySelector("span:last-child")!.textContent = c.cta;
  }
}
