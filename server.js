require('dotenv').config();

const express = require('express');
const path = require('path');
const {
  buildResearch,
  freeTeaser,
  proPayload,
  isValidSolanaAddress,
} = require('./lib/research');
const { resolveEntitlementIds } = require('./lib/entitlements');

const app = express();
const PORT = process.env.PORT || 3000;

const REVENUECAT_API_KEY = process.env.REVENUECAT_API_KEY || '';
const ENTITLEMENT_IDS = resolveEntitlementIds(process.env.REVENUECAT_ENTITLEMENT_ID);
const LINKUP_API_KEY = process.env.LINKUP_API_KEY || '';

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'pay-35',
    revenueCatKeyConfigured: Boolean(REVENUECAT_API_KEY),
    linkupKeyConfigured: Boolean(LINKUP_API_KEY),
    entitlementIds: ENTITLEMENT_IDS,
    entitlementId: ENTITLEMENT_IDS[0],
    sandboxMode: true,
  });
});

app.get('/api/config', (_req, res) => {
  res.json({
    revenueCatApiKey: REVENUECAT_API_KEY || null,
    entitlementIds: ENTITLEMENT_IDS,
    entitlementId: ENTITLEMENT_IDS[0],
    sandboxMode: true,
    hasRevenueCatKey: Boolean(REVENUECAT_API_KEY),
    hasLinkupKey: Boolean(LINKUP_API_KEY),
  });
});

app.post('/api/research', async (req, res) => {
  const address = (req.body?.address || '').trim();
  const tier = req.body?.tier === 'pro' ? 'pro' : 'free';

  if (!isValidSolanaAddress(address)) {
    return res.status(400).json({
      error: 'Invalid Solana mint or pool address (base58, 32–44 chars).',
    });
  }

  try {
    const full = await buildResearch(address, { linkupApiKey: LINKUP_API_KEY || undefined });
    if (tier === 'pro') {
      return res.json(proPayload(full));
    }
    return res.json(freeTeaser(full));
  } catch (err) {
    return res.status(500).json({ error: 'Research lookup failed.', detail: err.message });
  }
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Morning Light Pay listening on http://localhost:${PORT}`);
  console.log(`RevenueCat key: ${REVENUECAT_API_KEY ? 'configured' : 'missing (demo UI only)'}`);
  console.log(`Entitlement IDs: ${ENTITLEMENT_IDS.join(', ')}`);
});
