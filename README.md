# Chrome Kush

Match-3 mobile game. Babylon.js + TypeScript + Vite, wrapped for Android (Amazon Appstore) with Capacitor.

## Run it

```bash
npm install
npm run dev      # open the printed URL on your phone or desktop
npm run build    # typecheck + production build into dist/
```

## What's built

- **Gameplay:** 8x8 match-3 with swaps, chains, holes, caged pieces, move limits, win/lose, auto-shuffle
- **Look:** code-built 3D pieces (bud, glass pipe, bong, lighter, papers, concentrate jar) with idle spin and smoke puffs; animated background (light leaks, rising smoke rings)
- **3D level map:** winding trail of 60 level stones, drag to scroll, tap to play
- **Economy:** 5 lives (1 back every 30 min, lose 1 on a loss), unlimited-lives timers, coins, boosters (pre-game +3 Moves and Starter Blast; in-game Lighter and Shuffle)
- **Retention:** daily login calendar with a growing score multiplier (up to 2x), booster packs on day 7 and a mega chest on day 30; free Lucky Spin every 24 h
- **Ads:** forced 15 s ad every 2 completed levels (after Continue only); rewarded ads for +1 life (3/day), +5 moves, double spin prize; menu-only banners. House ads; network-agnostic interface.
- **Purchases:** No-Ads Pass, Premium monthly, lives, unlimited lives, coin packs, booster bundle through Amazon IAP (`window.AmazonIapV2`, same as BillBoss), with a test store at `?teststore=1`
- **Backend:** Cloudflare Worker (`worker/index.ts`) for Amazon receipt verification and cloud saves
- **Compliance:** 18+ age gate, privacy policy at `/privacy.html`

## Ship it

See [docs/amazon-submission.md](docs/amazon-submission.md).
