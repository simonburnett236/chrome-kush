import "./style.css";
import { Engine, type Scene } from "@babylonjs/core";
import { BoardView } from "./render/BoardView";
import { MapView } from "./render/MapView";
import { GameSession } from "./game/GameSession";
import { levelAt } from "./game/levels";
import { Hud } from "./ui/Hud";
import { modal, ageGate, preLevel, dailyCalendar, spinWheel, el, fmtTime } from "./ui/Dialogs";
import { openShop } from "./ui/Shop";
import { Entitlements } from "./store/Entitlements";
import { DevPurchaseService, WebOnlyPurchaseService, type PurchaseService } from "./store/PurchaseService";
import { AmazonPurchaseService, detectAmazonBridge } from "./store/AmazonIap";
import { AdManager } from "./ads/AdManager";
import { HouseAdProvider } from "./ads/HouseAdProvider";
import { HouseRewardedProvider } from "./ads/HouseRewardedProvider";
import { Banner } from "./ads/Banner";
import { Progress } from "./save/Progress";
import { CloudSave } from "./save/CloudSave";
import { Wallet } from "./economy/Wallet";
import { Daily, SPIN_PRIZES } from "./economy/Daily";
import { grantReward } from "./economy/grant";
import { AD_CONFIG, BOOSTERS, ECONOMY, PREMIUM_PERKS, type BoosterId } from "./config";

const canvas = document.getElementById("game") as HTMLCanvasElement;
const hudRoot = document.getElementById("hud") as HTMLElement;
const engine = new Engine(canvas, true, { stencil: true }, true);

const entitlements = new Entitlements();
const wallet = new Wallet();
const daily = new Daily();
const progress = new Progress();
const testStore = import.meta.env.DEV || new URLSearchParams(location.search).has("teststore");
let purchases: PurchaseService = testStore ? new DevPurchaseService(entitlements, wallet) : new WebOnlyPurchaseService();

const shop = () => openShop({ purchases, entitlements, wallet, toast: (m) => hud.toast(m) }).then(refreshMap);
const ads = new AdManager(new HouseAdProvider({ onRemoveAds: () => void shop() }), new HouseRewardedProvider(AD_CONFIG.rewardedSeconds), entitlements, AD_CONFIG);
const banner = new Banner(() => void shop());

const boardView = new BoardView(engine);
const mapView = new MapView(engine);
let activeScene: Scene = mapView.scene;
engine.runRenderLoop(() => activeScene.render());
window.addEventListener("resize", () => {
  engine.resize();
  boardView.resize();
});

let session: GameSession | null = null;
let currentIndex = 0;
let armed: BoosterId | null = null;

const hud = new Hud(hudRoot, wallet, {
  onNav: (id) => {
    if (id === "shop") void shop();
    else if (id === "map") void quitToMap();
    else if (id === "inventory") void showInventory();
    else if (id === "profile") void showProfile();
    else void showSettings();
  },
  onBooster: (id) => void useInGameBooster(id),
  onMapButton: (id) => {
    if (id === "play") void tryStart(progress.state.levelIndex);
    else if (id === "shop" || id === "lives") void shop();
    else if (id === "spin") void doSpin();
    else if (id === "daily") void doDaily();
    else void showSettings();
  },
});

// ---------- screens ----------

function refreshMap(): void {
  mapView.refresh(progress.state.levelIndex);
  hud.mapInfo = { streak: daily.state.streak, nextLevel: progress.state.levelIndex + 1, spin: daily.spinAvailable, daily: daily.rewardPending };
  hud.updateMapStats();
  if (activeScene === mapView.scene && !entitlements.adsRemoved) banner.show(hud.mapBottom);
  else banner.hide();
}

function showMap(): void {
  session = null;
  armed = null;
  boardView.tapOverride = null;
  activeScene = mapView.scene;
  hud.showScreen("map");
  refreshMap();
}

function showLevelScreen(): void {
  banner.hide(); // banners never show during a level
  activeScene = boardView.scene;
  hud.showScreen("level");
  boardView.resize();
}

mapView.onSelectLevel = (i) => void tryStart(i);
entitlements.onChange(refreshMap);

// ---------- level flow ----------

async function tryStart(index: number): Promise<void> {
  if (!wallet.canPlay) {
    const ok = await outOfLives();
    if (!ok) return;
  }
  const level = levelAt(index);
  const picks = await preLevel(level, wallet.state.boosters);
  if (!picks) return;
  const usedPicks = picks.filter((id) => wallet.useBooster(id));
  startLevel(index, usedPicks);
}

function startLevel(index: number, picks: BoosterId[] = []): void {
  currentIndex = index;
  const level = levelAt(index);
  const bonus = (entitlements.isPremium ? PREMIUM_PERKS.bonusMovesPerLevel : 0) + (picks.includes("extraMoves") ? 3 : 0);
  showLevelScreen();
  session = new GameSession(level, boardView, {
    onChange: (s) => hud.update(s),
    onWin: async (s) => {
      const coins = ECONOMY.winCoins + s.movesLeft * ECONOMY.coinsPerMoveLeft;
      wallet.addCoins(coins);
      progress.recordWin(index, s.score);
      cloud?.push();
      await modal(`Level ${s.level.id} complete`, `Score: ${s.score}. You earned ${coins} coins.`, [{ id: "continue", label: "Continue", primary: true }]);
      // Forced ads only ever run here: after Continue on a completed level.
      await ads.onLevelCompletedContinue();
      showMap();
    },
    onOutOfMoves: async (s) => {
      const choice = await modal("Out of moves", `You're at ${s.score} of ${s.level.targetScore}. Watch an ad for +${AD_CONFIG.rewardedExtraMoves} moves and keep going?`, [
        { id: "quit", label: "Give up" },
        { id: "ad", label: `Watch ad: +${AD_CONFIG.rewardedExtraMoves} moves`, primary: true },
      ]);
      if (choice !== "ad") return false;
      const earned = await ads.showRewarded();
      if (earned) s.addMoves(AD_CONFIG.rewardedExtraMoves);
      return earned;
    },
    onLose: async (s) => {
      wallet.loseLife();
      cloud?.push();
      const choice = await modal("Level failed", `You scored ${s.score} of ${s.level.targetScore}. You lost 1 life.`, [
        { id: "map", label: "Map" },
        { id: "retry", label: "Try again", primary: true },
      ]);
      if (choice === "retry") void tryStart(index);
      else showMap();
    },
  }, { bonusMoves: bonus, multiplier: daily.multiplier, blast: picks.includes("blast") });
}

async function quitToMap(): Promise<void> {
  if (session && session.movesUsed > 0 && session.state === "playing") {
    const c = await modal("Leave level?", "Leaving now counts as a loss and costs 1 life.", [
      { id: "stay", label: "Keep playing", primary: true },
      { id: "leave", label: "Leave" },
    ]);
    if (c !== "leave") return;
    wallet.loseLife();
  }
  showMap();
}

async function useInGameBooster(id: BoosterId): Promise<void> {
  const s = session;
  if (!s || s.state !== "playing") return;
  if ((wallet.state.boosters[id] ?? 0) <= 0) {
    const c = await modal(BOOSTERS[id].name, `You're out. Buy one for ${BOOSTERS[id].coinPrice} coins?`, [
      { id: "no", label: "No" },
      { id: "buy", label: `Buy (${BOOSTERS[id].coinPrice})`, primary: true },
    ]);
    if (c !== "buy") return;
    if (!wallet.spendCoins(BOOSTERS[id].coinPrice)) return hud.toast("Not enough coins.");
    wallet.addBooster(id);
  }
  if (id === "shuffle") {
    if (wallet.useBooster("shuffle")) await s.useShuffle();
    return;
  }
  if (id === "hammer") {
    if (armed === "hammer") {
      armed = null;
      boardView.tapOverride = null;
      hud.setArmed(null);
      return;
    }
    armed = "hammer";
    hud.setArmed("hammer");
    hud.toast("Tap a piece or cage to burn it.");
    boardView.tapOverride = async (p) => {
      boardView.tapOverride = null;
      armed = null;
      hud.setArmed(null);
      const cell = s.board.cell(p.r, p.c);
      if (!cell?.active || !cell.piece) return;
      if (wallet.useBooster("hammer")) {
        const ok = await s.useLighter(p);
        if (!ok) wallet.addBooster("hammer");
      }
    };
  }
}

// ---------- lives / daily / spin ----------

async function outOfLives(): Promise<boolean> {
  const adsLeft = wallet.rewardedLivesLeftToday;
  const c = await modal("Out of lives", `Next life in ${fmtTime(wallet.nextLifeIn)}.`, [
    { id: "ad", label: adsLeft ? `Watch ad: +1 life (${adsLeft} left today)` : "No ad lives left today", disabled: !adsLeft },
    { id: "coins", label: `Refill: ${ECONOMY.livesRefillCoinPrice} coins`, disabled: wallet.state.coins < ECONOMY.livesRefillCoinPrice },
    { id: "shop", label: "Shop", primary: true },
    { id: "close", label: "Wait" },
  ]);
  if (c === "ad") {
    if (await ads.showRewarded()) {
      wallet.recordRewardedLife();
      hud.toast("+1 life");
    }
  } else if (c === "coins") {
    if (wallet.spendCoins(ECONOMY.livesRefillCoinPrice)) wallet.refillLives();
  } else if (c === "shop") await shop();
  return wallet.canPlay;
}

async function doDaily(): Promise<void> {
  const reward = await dailyCalendar(daily);
  if (reward) {
    grantReward(wallet, reward);
    hud.toast(`Collected: ${reward.label}`);
    cloud?.push();
  }
  refreshMap();
}

async function doSpin(): Promise<void> {
  const idx = await spinWheel(daily);
  if (idx === null) return refreshMap();
  const prize = SPIN_PRIZES[idx].reward;
  const c = await modal("You won", prize.label, [
    { id: "take", label: "Collect" },
    { id: "double", label: "Watch ad to double", primary: true },
  ]);
  let times = 1;
  if (c === "double" && (await ads.showRewarded())) times = 2;
  grantReward(wallet, prize, times);
  hud.toast(`Collected: ${prize.label}${times === 2 ? " x2" : ""}`);
  cloud?.push();
  refreshMap();
}

// ---------- menus ----------

async function showInventory(): Promise<void> {
  const rows = (Object.keys(BOOSTERS) as BoosterId[])
    .map((id) => `<div class="shop-item"><div><strong>${BOOSTERS[id].name}</strong><p>${BOOSTERS[id].desc}</p></div><span class="count">x${wallet.state.boosters[id] ?? 0}</span></div>`)
    .join("");
  await modal("Inventory", el(`<p>Coins: <strong>${wallet.state.coins}</strong></p>${rows}`), [{ id: "ok", label: "Close" }], { dismissable: true });
}

async function showProfile(): Promise<void> {
  const best = Object.values(progress.state.bestScores);
  await modal("Profile", el(`
    <p>Levels cleared: <strong>${progress.state.levelIndex}</strong></p>
    <p>Total points: <strong>${progress.state.totalPoints}</strong></p>
    <p>Best level score: <strong>${best.length ? Math.max(...best) : 0}</strong></p>
    <p>Login streak: <strong>${daily.state.streak} days</strong> (x${daily.multiplier.toFixed(2)})</p>
    <p>Ads: <strong>${entitlements.adsRemoved ? "Removed" : "On"}</strong>${entitlements.isPremium ? " - Premium" : ""}</p>`), [{ id: "ok", label: "Close" }], { dismissable: true });
}

async function showSettings(): Promise<void> {
  const c = await modal("Settings", el(`<p class="fine">Store: ${purchases.mode === "amazon" ? "Amazon Appstore" : purchases.mode === "test" ? "Test store" : "Web (no purchases)"}</p>
    <p class="fine"><a href="./privacy.html" target="_blank">Privacy policy</a></p>`), [
    { id: "restore", label: "Restore purchases" },
    { id: "close", label: "Close", primary: true },
  ], { dismissable: true });
  if (c === "restore") {
    const owned = await purchases.restore();
    hud.toast(owned.length ? "Purchases restored." : "No purchases to restore.");
  }
}

// ---------- boot ----------

let cloud: CloudSave | null = null;

async function boot(): Promise<void> {
  hud.showScreen("map");
  refreshMap();
  if (!(await ageGate())) {
    document.body.innerHTML = `<div class="blocked">Chrome Kush is for adults only.</div>`;
    return;
  }
  const bridge = await detectAmazonBridge();
  if (bridge) {
    const amazon = new AmazonPurchaseService(bridge, entitlements, wallet);
    amazon.onUserId = (id) => {
      cloud = new CloudSave(id, { progress, wallet, daily, entitlements });
      void cloud.pull().then(refreshMap);
    };
    purchases = amazon;
  }
  daily.registerLaunch();
  if (daily.rewardPending) await doDaily();
  if (daily.spinAvailable) await doSpin();
  refreshMap();
}

void boot();

(window as any).chromeKush = { get session() { return session; }, wallet, daily, progress, entitlements, startLevel, get currentIndex() { return currentIndex; } };
