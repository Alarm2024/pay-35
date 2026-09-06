# pay-35 — Morning Light Pay

**Burning Token · Subscriptions · RevenueCat track**

Solana traders get a **free limited mint/pool glance**, then unlock **Pro research** (full verdict, risk score, flags, sources-style detail) via RevenueCat Test Store / Web Billing.

Public demo UI labels all purchases **TEST / SANDBOX**.

---

## 60-second judge path

Open the deployed app (or `npm start` locally). The homepage shows **five numbered buttons** — tap each in order:

| Step | Button | What judges see |
|------|--------|-----------------|
| **1** | **Before** | Sample Solana address scanned on **free tier** — teaser only, score/verdict/flags/sources locked |
| **2** | **Unlock Pro (TEST)** | RevenueCat **TEST / SANDBOX** checkout modal → choose **Success** |
| **3** | **After** | **Pro unlocked** — full risk score, verdict, flags, narrative, cited sources |
| **4** | **Fail (TEST / SANDBOX)** | Simulated failed purchase — back to locked free tier |
| **5** | **Expire (TEST / SANDBOX)** | Simulated expired entitlement — Pro content locked again |

**Health check:** `/health` returns booleans only for secrets (never raw keys).

**Entitlement:** `REVENUECAT_ENTITLEMENT_ID` defaults to `pro`. Aliases like `pay-35-pro` also work client-side if configured in RevenueCat.

---

## Features

| Tier | What you get |
|------|----------------|
| **Free** | Address type, risk band hint, teaser copy — score/verdict/flags/sources visibly **locked** |
| **Pro** (`pro` entitlement) | Full risk score, verdict, flags, narrative, cited sources |

- RevenueCat Web SDK (`@revenuecat/purchases-js`) with **Test Store** checkout modal (success / fail / cancel)
- Homepage **numbered judge demo** with one-tap step buttons
- Judge controls: simulate failed purchase, simulate expired entitlement, restore + refresh
- Optional Linkup `/search` (fast) when `LINKUP_API_KEY` is set; otherwise deterministic mock research
- `/health` JSON (never exposes secrets — boolean flags only)
- Render-ready: `npm start`

---

## RevenueCat setup (Test Store)

Do this once in [RevenueCat Dashboard](https://app.revenuecat.com):

### 1. Create / open project

Create a project (or use an existing one). A **Test Store** is often auto-created for new projects.

### 2. Test Store + Web Billing

1. **Apps & providers → Test Store** — create if missing. Copy the **Test Store public API key** (used as `REVENUECAT_API_KEY`).
2. **Apps & providers → Web → RevenueCat Billing** — connect Stripe (required for Web Billing gateway), create a web config.

### 3. Product catalog

1. **Product catalog → Products** — create a **Test Store** subscription product (e.g. `mlpay_pro_monthly`, 1 month).
2. **Product catalog → Entitlements** — create entitlement identifier **`pro`** (aliases like `pay-35-pro` also work — set `REVENUECAT_ENTITLEMENT_ID` to match) and attach the Test Store product.
3. **Product catalog → Offerings** — edit **Current** offering (or create one), add a package pointing at your Test Store product.

### 4. Paywall (optional)

Configure a paywall template in RevenueCat if you want `presentPaywall()` styling; package purchase also works without it.

### 5. Env var

```bash
REVENUECAT_API_KEY=rcb_test_store_public_key_here
REVENUECAT_ENTITLEMENT_ID=pro
```

> **Never ship production with a Test Store key.** Use platform-specific keys for real stores.

---

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `REVENUECAT_API_KEY` | Yes (for live Test Store demo) | Public Web / Test Store SDK key |
| `REVENUECAT_ENTITLEMENT_ID` | No (default `pro`) | Entitlement that unlocks full research. Common aliases: `pro`, `pay-35-pro`, `pay35_pro`, `morning_light_pro` |
| `LINKUP_API_KEY` | No | Linkup `/search` for live web sources |
| `PORT` | No (default `3000`) | HTTP port (`Render` sets this) |

Copy the example file:

```bash
cp .env.example .env
# edit .env with your keys
```

**No secrets belong in git.** `.env` is gitignored.

---

## Local run

```bash
npm install
cp .env.example .env
# add REVENUECAT_API_KEY (and optional LINKUP_API_KEY)
npm start
```

Open http://localhost:3000

Health check: http://localhost:3000/health

Without `REVENUECAT_API_KEY`, the UI and mock research still run; purchase buttons stay disabled.

---

## Deploy on Render

1. New **Web Service** → connect this repo
2. **Build command:** `npm install`
3. **Start command:** `npm start`
4. Add env vars in Render dashboard:
   - `REVENUECAT_API_KEY`
   - `REVENUECAT_ENTITLEMENT_ID=pro`
   - `LINKUP_API_KEY` (optional)

Render sets `PORT` automatically.

---

## Judge demo script (detailed)

Use a known Solana address (mint or pool), e.g. wrapped SOL:

`So11111111111111111111111111111111111111112`

### 1. BEFORE purchase (free / locked)

1. Tap homepage step **① Before** (or paste address → **Scan (Free)**).
2. Confirm **TEST / SANDBOX** badge and **FREE TIER**.
3. See teaser only: type, hint, locked score/verdict/flags/sources grid, paywall CTA.

### 2. AFTER successful test purchase

1. Tap step **② Unlock Pro (TEST)** (or **Unlock Pro (TEST)** in paywall).
2. In the RevenueCat modal, choose **Success** (sandbox).
3. Tap step **③ After** if results didn't refresh — badge → **PRO ACTIVE**; full score, verdict, flags, sources render.

### 3. FAILED purchase path

**Option A (real Test Store):** Step ② → choose **Fail** in the modal.

**Option B (UI rehearsal):** Tap step **④ Fail (TEST / SANDBOX)** — returns to locked free view.

### 4. EXPIRED / revoked entitlement

**Option A (real):** Wait for Test Store subscription to expire (accelerated renewals; see [RevenueCat Test Store docs](https://www.revenuecat.com/docs/test-and-launch/sandbox/test-store)).

**Option B (UI rehearsal):** Tap step **⑤ Expire (TEST / SANDBOX)** — Pro content locks again.

Use **Refresh entitlement** or **Restore purchases** to sync real RevenueCat state after a live test purchase.

---

## API

### `GET /health`

```json
{
  "ok": true,
  "service": "pay-35",
  "revenueCatKeyConfigured": true,
  "linkupKeyConfigured": false,
  "entitlementId": "pro",
  "sandboxMode": true
}
```

Secrets are never returned — only boolean `*Configured` flags.

### `POST /api/research`

```json
{ "address": "<solana-address>", "tier": "free" }
```

`tier`: `"free"` (teaser) or `"pro"` (full payload). The browser only requests `"pro"` when RevenueCat reports active entitlement client-side.

---

## Stack

- **Node 18+ / Express** — static UI + research API
- **RevenueCat Web SDK** — Test Store purchases & entitlement checks
- **Linkup SDK** (optional) — `/search` only, not paid Research

---

## License

MIT
