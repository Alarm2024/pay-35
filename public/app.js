import {
  Purchases,
  ErrorCode,
  PurchasesError,
} from 'https://esm.sh/@revenuecat/purchases-js@1.53.1';

const DEMO_ADDRESS = 'So11111111111111111111111111111111111111112';
const STORAGE_USER_KEY = 'mlpay_app_user_id';
const STORAGE_LAST_ADDRESS = 'mlpay_last_address';

const FREE_FEATURES = [
  { label: 'Address type detected', free: true },
  { label: 'Risk band hint (no exact score)', free: true },
  { label: 'Exact risk score / 100', free: false },
  { label: 'Verdict (HIGH RISK, CAUTION…)', free: false },
  { label: 'Risk flags & checklist', free: false },
  { label: 'Full research narrative', free: false },
  { label: 'Cited sources (3+ links)', free: false },
  { label: 'Liquidity & holder stats', free: false },
];

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
  entitlementIds: document.getElementById('entitlement-ids'),
  activeEntitlement: document.getElementById('active-entitlement'),
  paywallEntitlement: document.getElementById('paywall-entitlement'),
  demoStep1: document.getElementById('demo-step-1'),
  demoStep2: document.getElementById('demo-step-2'),
  demoStep3: document.getElementById('demo-step-3'),
  demoStep4: document.getElementById('demo-step-4'),
  demoStep5: document.getElementById('demo-step-5'),
  demoSteps: document.querySelectorAll('.demo-step'),
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
  matchedEntitlementId: null,
  demoOverride: null,
  currentPackage: null,
  lastAddress: localStorage.getItem(STORAGE_LAST_ADDRESS) || '',
  activeDemoStep: 0,
};

function showMessage(text, type = 'info') {
  els.message.hidden = false;
  els.message.textContent = text;
  els.message.className = `message ${type}`;
}

function hideMessage() {
  els.message.hidden = true;
}

function setActiveDemoStep(step) {
  state.activeDemoStep = step;
  els.demoSteps.forEach((node) => {
    const n = Number(node.dataset.step);
    node.classList.toggle('is-active', n === step);
    node.classList.toggle('is-done', n < step);
  });
}

function scrollToResults() {
  els.resultsPanel.hidden = false;
  els.resultsPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

function featureCompareHtml() {
  const rows = FREE_FEATURES.map(
    (f) => `
      <tr>
        <td>${f.label}</td>
        <td class="${f.free ? 'yes' : 'no'}">${f.free ? '✓' : '—'}</td>
        <td class="yes">✓</td>
      </tr>`
  ).join('');
  return `
    <table class="compare-table">
      <thead>
        <tr><th>Feature</th><th>Free</th><th>Pro (paid)</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function renderFree(data) {
  els.resultsBody.innerHTML = `
    <div class="tier-banner tier-banner-free">
      <span class="badge badge-locked">FREE TIER</span>
      <p>2 of 8 research fields · exact score, verdict, flags &amp; sources locked</p>
    </div>
    <div class="card card-free">
      <h3>${data.addressType}</h3>
      <p><code>${data.address}</code></p>
      <p>${data.teaser}</p>
      <p>Risk band hint only: <strong>${data.riskHint}</strong></p>
    </div>
    <div class="card card-locked">
      <h3>🔒 Locked — Pro only</h3>
      <p class="score score-locked">██ / 100</p>
      <p class="locked-copy">Verdict, flags, narrative, liquidity stats, and ${data.lockedFields.length} source fields require a paid entitlement.</p>
      <ul class="locked-list">
        <li>Exact risk score</li>
        <li>Verdict badge</li>
        <li>Red-flag checklist</li>
        <li>Cited sources</li>
      </ul>
    </div>
    ${featureCompareHtml()}
  `;
  els.tierLabel.textContent = 'FREE · LOCKED';
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

  const entNote = state.matchedEntitlementId
    ? `Entitlement <code>${state.matchedEntitlementId}</code> active`
    : 'Pro demo view';

  els.resultsBody.innerHTML = `
    <div class="tier-banner tier-banner-pro">
      <span class="badge badge-paid">PAID · PRO UNLOCKED</span>
      <span class="badge badge-sandbox">TEST / SANDBOX</span>
      <p>${entNote} · all 8 research fields unlocked</p>
    </div>
    <div class="card card-pro">
      <h3>${data.addressType}</h3>
      <p><code>${data.address}</code></p>
      <p class="score">${data.riskScore}<span class="score-denom"> / 100</span></p>
      <span class="verdict ${verdictClass(data.verdict)}">${data.verdict}</span>
      <p class="pro-summary">${data.summary}</p>
      <dl class="stat-grid">
        <div><dt>Liquidity</dt><dd>$${data.liquidityUsd.toLocaleString()}</dd></div>
        <div><dt>Holders</dt><dd>${data.holderCount.toLocaleString()}</dd></div>
        <div><dt>On-chain age</dt><dd>${data.ageDays} days</dd></div>
      </dl>
    </div>
    <div class="card card-pro">
      <h3>Full research narrative</h3>
      <p>${data.detail.narrative}</p>
      <ul>${data.detail.checklist.map((c) => `<li>${c}</li>`).join('')}</ul>
    </div>
    <div class="card card-pro">
      <h3>Risk flags (${data.flags.length})</h3>
      <ul>${flags}</ul>
    </div>
    <div class="card card-pro">
      <h3>Sources · ${data.dataSource} (${data.sources.length} links)</h3>
      <ul class="sources">${sources}</ul>
    </div>
    ${featureCompareHtml()}
  `;
  els.tierLabel.textContent = 'PRO · PAID';
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

function findActiveEntitlement(customerInfo) {
  const ids = state.config?.entitlementIds || ['pro'];
  const active = customerInfo?.entitlements?.active || {};
  for (const id of ids) {
    if (Object.prototype.hasOwnProperty.call(active, id)) return id;
  }
  return null;
}

function updateEntitlementBadge() {
  if (state.demoOverride === 'expired') {
    els.entitlementBadge.textContent = 'ENTITLEMENT EXPIRED';
    els.entitlementBadge.className = 'badge badge-fail';
    els.activeEntitlement.textContent = 'none (simulated expire)';
    return;
  }
  if (state.demoOverride === 'fail') {
    els.entitlementBadge.textContent = 'PURCHASE FAILED';
    els.entitlementBadge.className = 'badge badge-fail';
    els.activeEntitlement.textContent = 'none (simulated fail)';
    return;
  }
  if (state.hasPro) {
    els.entitlementBadge.textContent = 'PRO ACTIVE';
    els.entitlementBadge.className = 'badge badge-pro';
    els.activeEntitlement.textContent = state.matchedEntitlementId || 'active';
    return;
  }
  els.entitlementBadge.textContent = 'FREE TIER';
  els.entitlementBadge.className = 'badge badge-locked';
  els.activeEntitlement.textContent = 'none';
}

async function syncEntitlementFromSdk() {
  if (!state.purchases || !state.config) return;

  if (state.demoOverride === 'expired' || state.demoOverride === 'fail') {
    state.hasPro = false;
    state.matchedEntitlementId = null;
    updateEntitlementBadge();
    return;
  }

  const customerInfo = await state.purchases.getCustomerInfo();
  state.matchedEntitlementId = findActiveEntitlement(customerInfo);
  state.hasPro = Boolean(state.matchedEntitlementId);
  updateEntitlementBadge();
}

async function loadOfferingMeta() {
  if (!state.purchases) {
    els.offeringPrice.textContent = 'Add REVENUECAT_API_KEY to enable Test Store checkout.';
    els.unlockBtn.disabled = true;
    els.demoStep2.disabled = true;
    return;
  }

  try {
    const offerings = await state.purchases.getOfferings();
    const current = offerings.current;
    const pkg = current?.availablePackages?.[0] || current?.monthly || null;
    state.currentPackage = pkg;

    if (pkg?.webBillingProduct) {
      const product = pkg.webBillingProduct;
      els.offeringPrice.textContent = `${product.displayName || product.identifier} · ${product.price?.formattedPrice || 'Test price'} · TEST / SANDBOX`;
    } else {
      els.offeringPrice.textContent =
        'No offering packages found — attach a Test Store product to your current offering.';
    }
    const disabled = !pkg;
    els.unlockBtn.disabled = disabled;
    els.demoStep2.disabled = disabled;
  } catch (err) {
    els.offeringPrice.textContent = `Offerings error: ${err.message}`;
    els.unlockBtn.disabled = true;
    els.demoStep2.disabled = true;
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

async function runFreeScan(address = state.lastAddress || DEMO_ADDRESS) {
  els.address.value = address;
  state.lastAddress = address;
  localStorage.setItem(STORAGE_LAST_ADDRESS, address);
  state.demoOverride = null;
  await syncEntitlementFromSdk();
  await refreshResults(address);
  scrollToResults();
  showMessage('Step 1 complete — FREE tier: teaser only, score & sources locked.', 'info');
  setActiveDemoStep(1);
}

async function purchasePro() {
  if (!state.purchases) {
    showMessage('Configure REVENUECAT_API_KEY to run Test Store purchases.', 'error');
    return;
  }

  if (!state.lastAddress) {
    await runFreeScan();
  }

  state.demoOverride = null;
  setActiveDemoStep(2);
  openPaywallModal();
  showMessage('Step 2 — TEST / SANDBOX checkout. Pick Success, Fail, or Cancel in the RevenueCat modal.', 'info');

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
    state.matchedEntitlementId = findActiveEntitlement(purchaseResult.customerInfo);
    state.hasPro = Boolean(state.matchedEntitlementId);
    els.lastPurchase.textContent = `TEST purchase success @ ${new Date().toLocaleTimeString()}`;
    updateEntitlementBadge();

    if (state.hasPro) {
      showMessage('Step 2 complete — TEST purchase succeeded. Pro entitlement active.', 'success');
      setActiveDemoStep(3);
      await refreshResults();
      scrollToResults();
    } else {
      showMessage('Purchase finished but no matching entitlement yet. Check entitlement IDs or Restore.', 'info');
    }
  } catch (err) {
    closePaywallModal();
    if (err instanceof PurchasesError && err.errorCode === ErrorCode.UserCancelledError) {
      showMessage('Purchase cancelled in Test Store modal.', 'info');
      return;
    }
    els.lastPurchase.textContent = `TEST purchase failed @ ${new Date().toLocaleTimeString()}`;
    state.demoOverride = 'fail';
    state.hasPro = false;
    state.matchedEntitlementId = null;
    updateEntitlementBadge();
    setActiveDemoStep(4);
    showMessage(`TEST purchase failed: ${err.message || 'Unknown error'}`, 'error');
    await refreshResults();
    scrollToResults();
  }
}

async function showProResults() {
  if (!state.lastAddress) {
    await runFreeScan();
  }

  if (!state.hasPro) {
    showMessage('Step 3 needs Pro entitlement — run Step 2 first (or Steps 4/5 reset access).', 'error');
    return;
  }

  state.demoOverride = null;
  await syncEntitlementFromSdk();
  await refreshResults();
  scrollToResults();
  showMessage('Step 3 complete — PRO tier: full score, flags, narrative & sources visible.', 'success');
  setActiveDemoStep(3);
}

async function simulateFail() {
  if (!state.lastAddress) await runFreeScan();

  state.demoOverride = 'fail';
  state.hasPro = false;
  state.matchedEntitlementId = null;
  els.lastPurchase.textContent = `Simulated FAIL (TEST / SANDBOX) @ ${new Date().toLocaleTimeString()}`;
  updateEntitlementBadge();
  await refreshResults();
  scrollToResults();
  showMessage('Step 4 complete — simulated failed purchase. Still on FREE tier, Pro content locked.', 'error');
  setActiveDemoStep(4);
}

async function simulateExpire() {
  if (!state.lastAddress) await runFreeScan();

  state.demoOverride = 'expired';
  state.hasPro = false;
  state.matchedEntitlementId = null;
  els.lastPurchase.textContent = `Simulated EXPIRE (TEST / SANDBOX) @ ${new Date().toLocaleTimeString()}`;
  updateEntitlementBadge();
  await refreshResults();
  scrollToResults();
  showMessage('Step 5 complete — simulated expired/revoked entitlement. Pro locked again.', 'error');
  setActiveDemoStep(5);
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
  const ids = config.entitlementIds || ['pro'];
  els.entitlementLabel.textContent = ids.join(' → ');
  els.paywallEntitlement.textContent = ids[0];
  els.entitlementIds.textContent = ids.join(', ');

  const appUserId = getOrCreateAppUserId();
  els.appUserId.textContent = appUserId;

  if (!config.hasRevenueCatKey) {
    els.rcStatus.textContent = 'RevenueCat: missing API key (UI demo only)';
    els.unlockBtn.disabled = true;
    els.demoStep2.disabled = true;
    updateEntitlementBadge();
    return;
  }

  state.purchases = Purchases.configure({
    apiKey: config.revenueCatApiKey,
    appUserId,
  });

  els.rcStatus.textContent = 'RevenueCat Test Store ready';
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
      setActiveDemoStep(1);
    } else {
      showMessage('Pro research loaded.', 'success');
      setActiveDemoStep(3);
    }
    scrollToResults();
  } catch (err) {
    showMessage(err.message, 'error');
  }
});

els.unlockBtn.addEventListener('click', () => purchasePro());
els.restoreBtn.addEventListener('click', () => restorePurchases());
els.closePaywallBtn.addEventListener('click', () => closePaywallModal());

els.demoStep1.addEventListener('click', () => runFreeScan());
els.demoStep2.addEventListener('click', () => purchasePro());
els.demoStep3.addEventListener('click', () => showProResults());
els.demoStep4.addEventListener('click', () => simulateFail());
els.demoStep5.addEventListener('click', () => simulateExpire());

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
    } else {
      els.address.value = DEMO_ADDRESS;
    }
  } catch (err) {
    showMessage(`Boot error: ${err.message}`, 'error');
  }
})();
