# Chrome Kush

Match-3 mobile game. Babylon.js + TypeScript + Vite, wrapped for Android (Amazon Appstore) with Capacitor.

## Run it

```bash
npm install
npm run dev      # open the printed URL on your phone or desktop
npm run build    # typecheck + production build into dist/
```

## Phase 1 (this commit)

- 8x8 match-3 board: swap by tap-tap or drag, matches of 3+, gravity, refill, chain reactions, auto-shuffle when no moves remain
- Inactive squares (holes) and locked squares (caged pieces that can't be moved; match them to break the cage). Input ignores both.
- Move limit, target score, win and lose screens, 6 starter levels that loop with harder targets
- Placeholder 3D pieces (bud, glass pipe, bong, lighter, rolling papers, concentrate jar) with slow idle spin and a smoke puff on clear
- HUD from the mockup: score, moves, level, faction name (replaces "STAGE"), progress bar, power-up bar, Budtender's Tip, bottom nav
- Forced full-screen ad every 2 completed levels, 15 s wait, shown only after tapping Continue. Never during play.
- House ads for now (No-Ads Pass promo, BillBoss, sponsor slot). Ad code is network-agnostic (`src/ads/AdProvider.ts`).
- Shop with No-Ads Pass (one-time) and Premium (monthly: no forced ads + 3 extra moves per level). Uses a test store that asks for confirmation and charges nothing, until Amazon IAP is connected.

## Tuning

All knobs are in `src/config.ts`: ad frequency and length, premium perks, faction names, piece kinds. Levels are data in `src/game/levels.ts`.

## Layout

```
src/
  config.ts              tuning values
  main.ts                wiring: levels, ads, shop, progress
  game/Board.ts          pure match-3 rules (no rendering)
  game/GameSession.ts    one level attempt: moves, score, cascade loop
  game/levels.ts         level data
  render/BoardView.ts    Babylon scene, meshes, tweens, smoke, input
  ui/Hud.ts              DOM HUD, modals, shop
  ads/                   AdProvider interface, AdManager rules, HouseAdProvider
  store/                 products, entitlements, purchase service (test store)
  save/Progress.ts       local save
```

## Roadmap

2. Real 3D models, animated background, polish
3. Level data files + 3D level map
4. Lives, coins, boosters (pre-game and in-game Hammer/Lighter)
5. Daily login calendar + Lucky Spin
6. Amazon IAP, rewarded ads, menu banners, Cloudflare Worker backend
7. Capacitor Android build + Amazon Appstore submission
