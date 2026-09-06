import {
  Purchases,
  ErrorCode,
  PurchasesError,
} from 'https://esm.sh/@revenuecat/purchases-js@1.53.1';

const STORAGE_USER_KEY = 'mlpay_app_user_id';
const STORAGE_LAST_ADDRESS = 'mlpay_last_address';

const els = {
  form: document.getElementById('lookup-form'),
  address: document.getElementById('address'),
  message: document.getElementById('message'),
  resultsPanel: document.getElementById('results-panel'),
  resultsBody: document.getElementById('results-body'),
  tierLabel: document.getElementById('tier-label'),
  paywall: document.getElementById('paywall'),
  unlockBtn: document.getElementById('unlock-btn'),
  restoreBtn: document.getElementById('restore-btn'),
  offeringPrice: document.getElementById('offering-price'),
  entitlementBadge: document.getElementById('entitlement-badge'),
  entitlementLabel: document.getElementById('entitlement-label'),
  paywallEntitlement: document.getElementById('paywall-entitlement'),
  simulateFailBtn: document.getElementById('simulate-fail-btn'),
  simulateExpireBtn: document.getElementById('simulate-expire-btn'),
  refreshEntitlementBtn: document.getElementById('refresh-entitlement-btn'),
  appUserId: document.getElementById('app-user-id'),
  rcStatus: document.getElementById('rc-status'),
  lastPurchase: document.getElementById('last-purchase'),
  paywallModal: document.getElementById('paywall-modal'),
  paywallContainer: document.getElementById('paywall-container'),
  closePaywallBtn: document.getElementById('close-paywall-btn'),
};

const state = {
  config: null,
  purchases: null,
  hasPro: false,
  demoOverride: null,
  currentPackage: null,
  lastAddress: localStorage.getItem(STORAGE_LAST_ADDRESS) || '',
};

function showMessage(text, type = 'info') {
  els.message.hidden = false;
  els.message.textContent = text;
  els.message.className = `message ${type}`;
}

function hideMessage() {
  els.message.hidden = true;
}

function getOrCreateAppUserId() {
  let id = localStorage.getItem(STORAGE_USER_KEY);
  if (!id) {
    id = Purchases.generateRevenueCatAnonymousAppUserId();
    localStorage.setItem(STORAGE_USER_KEY, id);
  }
  return id;
}

function verdictClass(verdict) {
  if (verdict === 'HIGH RISK') return 'verdict-high';
  if (verdict === 'CAUTION') return 'verdict-caution';
  if (verdict === 'LOW RISK') return 'verdict-low';
  return 'verdict-neutral';
}

function renderFree(data) {
  els.resultsBody.innerHTML = `
    <div class="card">
      <h3>${data.addressType}</h3>
      <p><code>${data.address}</code></p>
      <p>${data.teaser}</p>
      <p>Risk band hint: <strong>${data.riskHint}</strong> (exact score locked)</p>
    </div>
    <div class="card">
      <h3>Locked behind Pro</h3>
      <p class="score score-locked">██ / 100</p>
      <p>Verdict, flags, narrative, and ${data.lockedFields.length} source fields require entitlement.</p>
    </div>
  `;
  els.tierLabel.textContent = 'FREE / LOCKED';
  els.tierLabel.className = 'badge badge-locked';
  els.paywall.hidden = false;
}

function renderPro(data) {
  const flags = data.flags.map((f) => `<li>${f}</li>`).join('');
  const sources = data.sources
    .map(
      (s) =>
        `<li><a href="${s.url}" target="_blank" rel="noreferrer">${s.title}</a><br /><span>${s.snippet}</span></li>`
    )
    .join('');

  els.resultsBody.innerHTML = `
    <div class="card">
      <h3>${data.addressType} · Pro unlock</h3>
      <p><code>${data.address}</code></p>
      <p class="score">${data.riskScore} / 100</p>
      <span class="verdict ${verdictClass(data.verdict)}">${data.verdict}</span>
      <p style="margin-top:0.75rem">${data.summary}</p>
    </div>
    <div class="card">
      <h3>Research detail</h3>
      <p>${data.detail.narrative}</p>
      <ul>${data.detail.checklist.map((c) => `<li>${c}</li>`).join('')}</ul>
    </div>
    <div class="card">
      <h3>Flags</h3>
      <ul>${flags}</ul>
    </div>
    <div class="card">
      <h3>Sources (${data.dataSource})</h3>
      <ul class="sources">${sources}</ul>
    </div>
  `;
  els.tierLabel.textContent = 'PRO UNLOCKED';
  els.tierLabel.className = 'badge badge-pro';
  els.paywall.hidden = true;
}

async function fetchResearch(address, tier) {
  const res = await fetch('/api/research', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address, tier }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Research failed');
  return data;
}

async function refreshResults(address = state.lastAddress) {
  if (!address) return;
  els.resultsPanel.hidden = false;
  const tier = state.hasPro ? 'pro' : 'free';
  const data = await fetchResearch(address, tier);
  if (tier === 'pro') renderPro(data);
  else renderFree(data);
}

function updateEntitlementBadge() {
  if (state.demoOverride === 'expired') {
    els.entitlementBadge.textContent = 'ENTITLEMENT EXPIRED';
    els.entitlementBadge.className = 'badge badge-fail';
    return;
  }
  if (state.demoOverride === 'fail') {
    els.entitlementBadge.textContent = 'PURCHASE FAILED';
    els.entitlementBadge.className = 'badge badge-fail';
    return;
  }
  if (state.hasPro) {
    els.entitlementBadge.textContent = 'PRO ACTIVE';
    els.entitlementBadge.className = 'badge badge-pro';
    return;
  }
  els.entitlementBadge.textContent = 'FREE TIER';
  els.entitlementBadge.className = 'badge badge-locked';
}

function entitlementActive(customerInfo, entitlementId) {
  return Boolean(customerInfo?.entitlements?.active?.[entitlementId]);
}

async function syncEntitlementFromSdk() {
  if (!state.purchases || !state.config) return;

  if (state.demoOverride === 'expired') {
    state.hasPro = false;
    updateEntitlementBadge();
    return;
  }

  if (state.demoOverride === 'fail') {
    state.hasPro = false;
    updateEntitlementBadge();
    return;
  }

  const customerInfo = await state.purchases.getCustomerInfo();
  state.hasPro = entitlementActive(customerInfo, state.config.entitlementId);
  updateEntitlementBadge();
}

async function loadOfferingMeta() {
  if (!state.purchases) {
    els.offeringPrice.textContent = 'Add REVENUECAT_API_KEY to enable Test Store checkout.';
    els.unlockBtn.disabled = true;
    return;
  }

  try {
    const offerings = await state.purchases.getOfferings();
    const current = offerings.current;
    const pkg = current?.availablePackages?.[0] || current?.monthly || null;
    state.currentPackage = pkg;

    if (pkg?.webBillingProduct) {
      const product = pkg.webBillingProduct;
      els.offeringPrice.textContent = `Current offering: ${product.displayName || product.identifier} · ${product.price?.formattedPrice || 'Test price'} · TEST / SANDBOX`;
    } else {
      els.offeringPrice.textContent =
        'No offering packages found. Attach a Test Store product to your current offering in RevenueCat.';
    }
    els.unlockBtn.disabled = !pkg;
  } catch (err) {
    els.offeringPrice.textContent = `Offerings error: ${err.message}`;
    els.unlockBtn.disabled = true;
  }
}

function openPaywallModal() {
  els.paywallModal.hidden = false;
  els.paywallContainer.innerHTML = '';
}

function closePaywallModal() {
  els.paywallModal.hidden = true;
  els.paywallContainer.innerHTML = '';
}

async function purchasePro() {
  if (!state.purchases) {
    showMessage('Configure REVENUECAT_API_KEY to run Test Store purchases.', 'error');
    return;
  }

  state.demoOverride = null;
  openPaywallModal();
  showMessage('TEST / SANDBOX checkout opened — choose Success, Fail, or Cancel in the RevenueCat modal.', 'info');

  try {
    let purchaseResult;
    if (state.currentPackage) {
      purchaseResult = await state.purchases.purchase({
        rcPackage: state.currentPackage,
        htmlTarget: els.paywallContainer,
      });
    } else {
      purchaseResult = await state.purchases.presentPaywall({
        htmlTarget: els.paywallContainer,
      });
    }

    closePaywallModal();
    state.hasPro = entitlementActive(purchaseResult.customerInfo, state.config.entitlementId);
    els.lastPurchase.textContent = `TEST success @ ${new Date().toLocaleTimeString()}`;
    updateEntitlementBadge();

    if (state.hasPro) {
      showMessage('TEST purchase succeeded — Pro entitlement active.', 'success');
      await refreshResults();
    } else {
      showMessage('Purchase completed but entitlement not active yet. Try Restore or Refresh.', 'info');
    }
  } catch (err) {
    closePaywallModal();
    if (err instanceof PurchasesError && err.errorCode === ErrorCode.UserCancelledError) {
      showMessage('Purchase cancelled (Test Store cancel path).', 'info');
      return;
    }
    els.lastPurchase.textContent = `TEST failed @ ${new Date().toLocaleTimeString()}`;
    state.demoOverride = 'fail';
    state.hasPro = false;
    updateEntitlementBadge();
    showMessage(`TEST purchase failed: ${err.message || 'Unknown error'}`, 'error');
    if (state.lastAddress) await refreshResults();
  }
}

async function restorePurchases() {
  if (!state.purchases) return;
  state.demoOverride = null;
  await state.purchases.restorePurchases();
  await syncEntitlementFromSdk();
  showMessage(state.hasPro ? 'Restore complete — Pro active.' : 'Restore complete — still on free tier.', 'info');
  if (state.lastAddress) await refreshResults();
}

async function initRevenueCat(config) {
  state.config = config;
  const entitlementId = config.entitlementId || 'pro';
  els.entitlementLabel.textContent = entitlementId;
  els.paywallEntitlement.textContent = entitlementId;

  const appUserId = getOrCreateAppUserId();
  els.appUserId.textContent = appUserId;

  if (!config.hasRevenueCatKey) {
    els.rcStatus.textContent = 'Missing API key (UI demo only)';
    els.unlockBtn.disabled = true;
    updateEntitlementBadge();
    return;
  }

  state.purchases = Purchases.configure({
    apiKey: config.revenueCatApiKey,
    appUserId,
  });

  els.rcStatus.textContent = 'Test Store configured';
  await syncEntitlementFromSdk();
  await loadOfferingMeta();
}

els.form.addEventListener('submit', async (event) => {
  event.preventDefault();
  hideMessage();
  const address = els.address.value.trim();
  state.lastAddress = address;
  localStorage.setItem(STORAGE_LAST_ADDRESS, address);

  try {
    await refreshResults(address);
    if (!state.hasPro) {
      showMessage('Free teaser loaded. Unlock Pro for full research.', 'info');
    } else {
      showMessage('Pro research loaded.', 'success');
    }
  } catch (err) {
    showMessage(err.message, 'error');
  }
});

els.unlockBtn.addEventListener('click', () => purchasePro());
els.restoreBtn.addEventListener('click', () => restorePurchases());
els.closePaywallBtn.addEventListener('click', () => closePaywallModal());

els.simulateFailBtn.addEventListener('click', async () => {
  state.demoOverride = 'fail';
  state.hasPro = false;
  els.lastPurchase.textContent = `Simulated fail @ ${new Date().toLocaleTimeString()}`;
  updateEntitlementBadge();
  showMessage('Simulated failed purchase — still on free tier. Run a real Test Store fail from checkout too.', 'error');
  if (state.lastAddress) await refreshResults();
});

els.simulateExpireBtn.addEventListener('click', async () => {
  state.demoOverride = 'expired';
  state.hasPro = false;
  els.lastPurchase.textContent = `Simulated expire @ ${new Date().toLocaleTimeString()}`;
  updateEntitlementBadge();
  showMessage('Simulated expired / revoked entitlement — Pro content locked again.', 'error');
  if (state.lastAddress) await refreshResults();
});

els.refreshEntitlementBtn.addEventListener('click', async () => {
  state.demoOverride = null;
  await syncEntitlementFromSdk();
  showMessage(state.hasPro ? 'Entitlement refresh: Pro active.' : 'Entitlement refresh: free tier.', 'info');
  if (state.lastAddress) await refreshResults();
});

(async function bootstrap() {
  try {
    const res = await fetch('/api/config');
    const config = await res.json();
    await initRevenueCat(config);

    if (state.lastAddress) {
      els.address.value = state.lastAddress;
    }
  } catch (err) {
    showMessage(`Boot error: ${err.message}`, 'error');
  }
})();
