import "./style.css";
import { BoardView } from "./render/BoardView";
import { GameSession } from "./game/GameSession";
import { levelAt } from "./game/levels";
import { Hud } from "./ui/Hud";
import { Entitlements } from "./store/Entitlements";
import { DevPurchaseService } from "./store/PurchaseService";
import { AdManager } from "./ads/AdManager";
import { HouseAdProvider } from "./ads/HouseAdProvider";
import { Progress } from "./save/Progress";
import { AD_CONFIG, PREMIUM_PERKS } from "./config";

const canvas = document.getElementById("game") as HTMLCanvasElement;
const hudRoot = document.getElementById("hud") as HTMLElement;

const entitlements = new Entitlements();
const purchases = new DevPurchaseService(entitlements);
const hud = new Hud(hudRoot, entitlements, purchases);
const ads = new AdManager(new HouseAdProvider({ onRemoveAds: () => hud.openShop() }), entitlements, AD_CONFIG);
const progress = new Progress();
const view = new BoardView(canvas);

let session: GameSession;

function startLevel(index: number): void {
  const level = levelAt(index);
  const bonus = entitlements.isPremium ? PREMIUM_PERKS.bonusMovesPerLevel : 0;
  session = new GameSession(level, view, {
    onChange: (s) => hud.update(s),
    onWin: async (s) => {
      progress.recordWin(index, s.score);
      await hud.modal(`Level ${s.level.id} complete`, `Score: ${s.score}. Moves left: ${s.movesLeft}.`, [
        { id: "continue", label: "Continue", primary: true },
      ]);
      // Forced ads only ever run here: after Continue on a completed level.
      await ads.onLevelCompletedContinue();
      startLevel(index + 1);
    },
    onLose: async (s) => {
      const choice = await hud.modal(
        "Out of moves",
        `You scored ${s.score} of ${s.level.targetScore}.`,
        [{ id: "retry", label: "Try again", primary: true }],
      );
      if (choice === "retry") startLevel(index);
    },
  }, bonus);
}

startLevel(progress.state.levelIndex);

// Expose for quick debugging in the browser console.
(window as any).chromeKush = { get session() { return session; }, entitlements, progress };
