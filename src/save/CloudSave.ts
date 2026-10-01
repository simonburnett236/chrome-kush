import type { Progress } from "./Progress";
import type { Wallet, WalletState } from "../economy/Wallet";
import type { Daily, DailyState } from "../economy/Daily";
import type { Entitlements } from "../store/Entitlements";

interface Snapshot {
  updatedAt: number;
  progress: Progress["state"];
  wallet: WalletState;
  daily: DailyState;
}

/** Saves progress to the Cloudflare Worker keyed by Amazon user id, so it survives reinstalls. */
export class CloudSave {
  private timer = 0;
  constructor(private userId: string, private s: { progress: Progress; wallet: Wallet; daily: Daily; entitlements: Entitlements }, private apiBase = "") {}

  private url(): string {
    return `${this.apiBase}/api/save/${encodeURIComponent(this.userId)}`;
  }

  async pull(): Promise<void> {
    try {
      const res = await fetch(this.url());
      if (!res.ok) return;
      const remote = (await res.json()) as Snapshot | null;
      const localAt = Number(localStorage.getItem("ck.cloud.updatedAt") ?? 0);
      if (remote && remote.updatedAt > localAt && remote.progress.levelIndex >= this.s.progress.state.levelIndex) {
        this.s.progress.state = remote.progress;
        localStorage.setItem("ck.progress.v1", JSON.stringify(remote.progress));
        this.s.wallet.replace(remote.wallet);
        this.s.daily.replace(remote.daily);
        localStorage.setItem("ck.cloud.updatedAt", String(remote.updatedAt));
      } else this.push();
    } catch {
      /* offline: keep local */
    }
  }

  /** Debounced upload. */
  push(): void {
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => {
      const snap: Snapshot = { updatedAt: Date.now(), progress: this.s.progress.state, wallet: this.s.wallet.state, daily: this.s.daily.state };
      localStorage.setItem("ck.cloud.updatedAt", String(snap.updatedAt));
      fetch(this.url(), { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(snap) }).catch(() => undefined);
    }, 1500);
  }
}
