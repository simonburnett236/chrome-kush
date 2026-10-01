import type { BoosterId } from "../config";

const KEY = "ck.daily.v1";
const DAY_MS = 24 * 60 * 60 * 1000;

export type Reward =
  | { type: "coins"; amount: number; label: string }
  | { type: "boosters"; items: Partial<Record<BoosterId, number>>; label: string }
  | { type: "infinite"; minutes: number; label: string };

export interface DailyState {
  lastLoginDay: string;
  streak: number;
  claimedDay: string;
  lastSpinAt: number;
}

const dayKey = (d = new Date()) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

/** Prizes on the Lucky Spin wheel. weight = relative chance. */
export const SPIN_PRIZES: Array<{ reward: Reward; weight: number; color: string }> = [
  { reward: { type: "coins", amount: 50, label: "50 coins" }, weight: 30, color: "#2a6b3c" },
  { reward: { type: "boosters", items: { hammer: 1 }, label: "Lighter" }, weight: 14, color: "#c9952f" },
  { reward: { type: "coins", amount: 150, label: "150 coins" }, weight: 18, color: "#174124" },
  { reward: { type: "boosters", items: { shuffle: 1 }, label: "Shuffle" }, weight: 14, color: "#9b5de5" },
  { reward: { type: "infinite", minutes: 30, label: "30 min lives" }, weight: 6, color: "#e2402a" },
  { reward: { type: "boosters", items: { extraMoves: 1 }, label: "+3 Moves" }, weight: 10, color: "#2a6b3c" },
  { reward: { type: "boosters", items: { blast: 1 }, label: "Blast" }, weight: 6, color: "#174124" },
  { reward: { type: "coins", amount: 500, label: "500 coins" }, weight: 2, color: "#c9952f" },
];

/** Daily login streak, score multiplier, calendar rewards and the free spin. */
export class Daily {
  state: DailyState;

  constructor() {
    this.state = { lastLoginDay: "", streak: 0, claimedDay: "", lastSpinAt: 0 };
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) this.state = { ...this.state, ...JSON.parse(raw) };
    } catch {
      /* ignore */
    }
  }

  /** Call on launch. Updates the streak for a new day. */
  registerLaunch(): void {
    const today = dayKey();
    if (this.state.lastLoginDay === today) return;
    const yesterday = dayKey(new Date(Date.now() - DAY_MS));
    this.state.streak = this.state.lastLoginDay === yesterday ? this.state.streak + 1 : 1;
    this.state.lastLoginDay = today;
    this.save();
  }

  get rewardPending(): boolean {
    return this.state.claimedDay !== dayKey() && this.state.streak > 0;
  }

  /** Score multiplier: +5% per consecutive day, capped at 2x. */
  get multiplier(): number {
    return Math.min(2, 1 + 0.05 * Math.max(0, this.state.streak - 1));
  }

  static rewardForDay(day: number): Reward {
    if (day % 30 === 0) return { type: "boosters", items: { blast: 3, hammer: 3, extraMoves: 2, shuffle: 2 }, label: "Mega booster chest" };
    if (day % 7 === 0) return { type: "boosters", items: { blast: 1, hammer: 1, extraMoves: 1 }, label: "Booster pack" };
    return { type: "coins", amount: 20 * Math.min(day % 7, 6), label: `${20 * Math.min(day % 7, 6)} coins` };
  }

  claim(): Reward {
    this.state.claimedDay = dayKey();
    this.save();
    return Daily.rewardForDay(this.state.streak);
  }

  get spinAvailable(): boolean {
    return Date.now() - this.state.lastSpinAt >= DAY_MS;
  }

  spin(): number {
    this.state.lastSpinAt = Date.now();
    this.save();
    const total = SPIN_PRIZES.reduce((a, p) => a + p.weight, 0);
    let roll = Math.random() * total;
    for (let i = 0; i < SPIN_PRIZES.length; i++) {
      roll -= SPIN_PRIZES[i].weight;
      if (roll <= 0) return i;
    }
    return 0;
  }

  replace(state: DailyState): void {
    this.state = state;
    this.save();
  }

  private save(): void {
    localStorage.setItem(KEY, JSON.stringify(this.state));
  }
}
