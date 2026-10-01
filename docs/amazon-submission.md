# Shipping Chrome Kush to the Amazon Appstore

Chrome Kush ships the same way BillBoss does: as an **Amazon Web App** hosted on Cloudflare. Amazon wraps the URL in an APK and injects `window.AmazonIapV2` for in-app purchases (`src/store/AmazonIap.ts`).

## 1. Deploy (one time, about 10 minutes)

```bash
npm install
npx wrangler login
npx wrangler kv namespace create SAVES      # paste the id into wrangler.toml
npx wrangler secret put AMAZON_SHARED_SECRET # Amazon Developer Console > Settings > Shared Key
npm run build
npx wrangler deploy
```

The game is then live at `https://chrome-kush.<your-subdomain>.workers.dev`.

## 2. Create the IAP items (Developer Console > your app > In-App Items)

| SKU | Type | Suggested price |
| --- | --- | --- |
| com.simonburnett.chromekush.noads | Entitlement | $2.99 |
| com.simonburnett.chromekush.premium.monthly | Subscription (parent SKU + monthly term) | $4.99/mo |
| com.simonburnett.chromekush.lives5 | Consumable | $0.99 |
| com.simonburnett.chromekush.infinite2h | Consumable | $1.99 |
| com.simonburnett.chromekush.coins500 | Consumable | $0.99 |
| com.simonburnett.chromekush.coins1500 | Consumable | $2.99 |
| com.simonburnett.chromekush.coins5000 | Consumable | $7.99 |
| com.simonburnett.chromekush.boosterbundle | Consumable | $3.99 |

If Amazon requires a different subscription term SKU, update `src/store/products.ts`.

## 3. Test before submitting

- Browser test store: open the site with `?teststore=1` (no real money).
- Amazon App Tester: set `AMAZON_IAP_ENV = "sandbox"` in `wrangler.toml`, redeploy, test on a Fire tablet, then set it back to `"production"` and redeploy before you submit.

## 4. Submit (Developer Console > Add new app > Web App)

- App URL: your workers.dev URL. Name: Chrome Kush. Developer: BURNETT'S Eggs LTD.
- Category: Games > Puzzle.
- Content rating questionnaire: answer yes to drug/alcohol references (cartoon). Expect a Mature/17+ rating. Do not describe it as selling or promoting real cannabis.
- Privacy policy URL: `https://<your-url>/privacy.html` (fill in the support email first).
- Screenshots: map screen, a level, the shop, the Lucky Spin.

## Known limits

- Ads are house ads (our own creatives plus sponsor slots). Unity Ads, AppLovin and Meta reject cannabis themes. Plug a network in through `src/ads/AdProvider.ts` if one approves the app.
- The 3D pieces are built in code, not hand-modeled art. To use real models, swap `src/render/Pieces.ts` for loaded .glb files.
