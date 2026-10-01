import type { Wallet } from "./Wallet";
import type { Reward } from "./Daily";
import type { BoosterId } from "../config";

export function grantReward(wallet: Wallet, reward: Reward, times = 1): void {
  if (reward.type === "coins") wallet.addCoins(reward.amount * times);
  else if (reward.type === "infinite") wallet.addInfiniteLives(reward.minutes * 60 * 1000 * times);
  else for (const [id, n] of Object.entries(reward.items)) wallet.addBooster(id as BoosterId, (n ?? 0) * times);
}
