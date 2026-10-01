import { AD_CONFIG, ECONOMY, type BoosterId } from "../config";

const KEY = "ck.wallet.v1";
const REFILL_MS = ECONOMY.lifeRefillMinutes * 60 * 1000;

export interface WalletState {
  coins: number;
  lives: number;
  lastLifeAt: number;
  infiniteUntil: number;
  boosters: Record<BoosterId, number>;
  rewardedLivesDay: string;
  rewardedLivesCount: number;
}

const today = () => new Date().toISOString().slice(0, 10);

/** Coins, lives (5 max, 1 back every 30 min), infinite lives and booster stock. */
export class Wallet {
  state: WalletState;
  private listeners = new Set<() => void>();

  constructor() {
    this.state = {
      coins: 200,
      lives: ECONOMY.maxLives,
      lastLifeAt: Date.now(),
      infiniteUntil: 0,
      boosters: { hammer: 1, shuffle: 1, extraMoves: 1, blast: 1 },
      rewardedLivesDay: "",
      rewardedLivesCount: 0,
    };
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        this.state = { ...this.state, ...saved, boosters: { ...this.state.boosters, ...(saved.boosters ?? {}) } };
      }
    } catch {
      /* ignore */
    }
    this.tick();
  }

  onChange(fn: () => void): void {
    this.listeners.add(fn);
  }

  /** Apply life regeneration. Call often (cheap). */
  tick(): void {
    const s = this.state;
    if (s.lives >= ECONOMY.maxLives) return;
    const now = Date.now();
    let changed = false;
    while (s.lives < ECONOMY.maxLives && now - s.lastLifeAt >= REFILL_MS) {
      s.lives++;
      s.lastLifeAt += REFILL_MS;
      changed = true;
    }
    if (s.lives >= ECONOMY.maxLives) s.lastLifeAt = now;
    if (changed) this.save();
  }

  get hasInfiniteLives(): boolean {
    return this.state.infiniteUntil > Date.now();
  }

  get canPlay(): boolean {
    this.tick();
    return this.hasInfiniteLives || this.state.lives > 0;
  }

  /** ms until the next life, or 0 when full. */
  get nextLifeIn(): number {
    if (this.state.lives >= ECONOMY.maxLives) return 0;
    return Math.max(0, REFILL_MS - (Date.now() - this.state.lastLifeAt));
  }

  loseLife(): void {
    if (this.hasInfiniteLives) return;
    this.tick();
    if (this.state.lives >= ECONOMY.maxLives) this.state.lastLifeAt = Date.now();
    this.state.lives = Math.max(0, this.state.lives - 1);
    this.save();
  }

  addLives(n: number): void {
    this.state.lives = Math.min(ECONOMY.maxLives, this.state.lives + n);
    if (this.state.lives >= ECONOMY.maxLives) this.state.lastLifeAt = Date.now();
    this.save();
  }

  refillLives(): void {
    this.addLives(ECONOMY.maxLives);
  }

  addInfiniteLives(ms: number): void {
    this.state.infiniteUntil = Math.max(Date.now(), this.state.infiniteUntil) + ms;
    this.save();
  }

  addCoins(n: number): void {
    this.state.coins += n;
    this.save();
  }

  spendCoins(n: number): boolean {
    if (this.state.coins < n) return false;
    this.state.coins -= n;
    this.save();
    return true;
  }

  addBooster(id: BoosterId, n = 1): void {
    this.state.boosters[id] = (this.state.boosters[id] ?? 0) + n;
    this.save();
  }

  useBooster(id: BoosterId): boolean {
    if ((this.state.boosters[id] ?? 0) <= 0) return false;
    this.state.boosters[id]--;
    this.save();
    return true;
  }

  get rewardedLivesLeftToday(): number {
    if (this.state.rewardedLivesDay !== today()) return AD_CONFIG.maxRewardedLivesPerDay;
    return Math.max(0, AD_CONFIG.maxRewardedLivesPerDay - this.state.rewardedLivesCount);
  }

  recordRewardedLife(): void {
    if (this.state.rewardedLivesDay !== today()) {
      this.state.rewardedLivesDay = today();
      this.state.rewardedLivesCount = 0;
    }
    this.state.rewardedLivesCount++;
    this.addLives(1);
  }

  replace(state: WalletState): void {
    this.state = state;
    this.save();
  }

  private save(): void {
    localStorage.setItem(KEY, JSON.stringify(this.state));
    this.listeners.forEach((fn) => fn());
  }
}
