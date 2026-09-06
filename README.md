# pay-35 — Morning Light Pay

**Burning Token · Subscriptions · RevenueCat track**

Free Solana mint/pool glance → **Pro research** unlock via RevenueCat **Test Store** (entitlement `pro` or slug variants). All purchases labeled **TEST / SANDBOX**.

---

## 60-second judge demo

Open the app. The **Judge demo script** panel is at the top — tap each step in order:

| Step | Button | What judges see |
|------|--------|-----------------|
| **1 · BEFORE** | Step 1 · Scan Free | FREE tier: type + hint only; score/verdict/sources **locked** |
| **2 · UNLOCK** | Step 2 · Unlock Pro (TEST / SANDBOX) | RevenueCat modal → pick **Success** |
| **3 · AFTER** | Step 3 · Show Pro Results | **PAID · PRO UNLOCKED** banner, full score, flags, sources |
| **4 · FAIL** | Step 4 · Simulate Fail (TEST / SANDBOX) | One tap → purchase failed, back to locked free |
| **5 · EXPIRE** | Step 5 · Simulate Expire (TEST / SANDBOX) | One tap → entitlement revoked, Pro locked again |

Demo address pre-filled: `So11111111111111111111111111111111111111112`

`/health` → confirms keys configured (no secrets echoed).

---

## Quick start

```bash
npm install
cp .env.example .env   # add REVENUECAT_API_KEY
npm start              # http://localhost:3000
```

---

## Env vars

| Variable | Required | Description |
|----------|----------|-------------|
| `REVENUECAT_API_KEY` | Yes (live purchases) | Test Store **public** SDK key |
| `REVENUECAT_ENTITLEMENT_ID` | No | Comma-separated IDs; default tries `pro`, `pay-35 Pro`, `pay-35-pro`, `pay_35_pro` |
| `LINKUP_API_KEY` | No | Linkup `/search` for live sources |
| `PORT` | No | Render sets automatically |

No secrets in repo. `.env` is gitignored.

---

## RevenueCat setup

1. [Dashboard](https://app.revenuecat.com) → **Test Store** → copy public API key
2. **Web Billing** config (Stripe gateway)
3. **Product** (Test Store subscription) → **Entitlement** (`pro`) → **Offering** (current)
4. Set `REVENUECAT_API_KEY` on Render / locally

---

## Deploy on Render

| Setting | Value |
|---------|-------|
| Build | `npm install` |
| Start | `npm start` |
| Env | `REVENUECAT_API_KEY`, optional `REVENUECAT_ENTITLEMENT_ID`, `LINKUP_API_KEY` |

---

## API

**`GET /health`** — `{ ok, revenueCatKeyConfigured, entitlementIds, sandboxMode }`

**`POST /api/research`** — `{ address, tier: "free"|"pro" }`

---

## Stack

Node/Express · RevenueCat Web SDK · optional Linkup search · Render-ready (`npm start`, `PORT`)

MIT
