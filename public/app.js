import {
  Purchases,
  ErrorCode,
  PurchasesError,
} from 'https://esm.sh/@revenuecat/purchases-js@1.53.1';

const STORAGE_USER_KEY = 'mlpay_app_user_id';
const STORAGE_LAST_ADDRESS = 'mlpay_last_address';
const DEMO_ADDRESS = 'So11111111111111111111111111111111111111112';

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
  entitlementLabelInline: document.getElementById('entitlement-label-inline'),
  paywallEntitlement: document.getElementById('paywall-entitlement'),
  refreshEntitlementBtn: document.getElementById('refresh-entitlement-btn'),
  appUserId: document.getElementById('app-user-id'),
  rcStatus: document.getElementById('rc-status'),
  lastPurchase: document.getElementById('last-purchase'),
  paywallModal: document.getElementById('paywall-modal'),
  paywallContainer: document.getElementById('paywall-container'),
  closePaywallBtn: document.getElementById('close-paywall-btn'),
  stepBeforeBtn: document.getElementById('step-before-btn'),
  stepUnlockBtn: document.getElementById('step-unlock-btn'),
  stepAfterBtn: document.getElementById('step-after-btn'),
  stepFailBtn: document.getElementById('step-fail-btn'),
  stepExpireBtn: document.getElementById('step-expire-btn'),
  judgeStepStatus: document.getElementById('judge-step-status'),
  judgeSteps: document.getElementById('judge-steps'),
};

const state = {
  config: null,
  purchases: null,
  hasPro: false,
  demoOverride: null,
  currentPackage: null,
  lastAddress: localStorage.getItem(STORAGE_LAST_ADDRESS) || '',
  activeJudgeStep: null,
};

function showMessage(text, type = 'info') {
  els.message.hidden = false;
  els.message.textContent = text;
  els.message.className = `message ${type}`;
}

function hideMessage() {
  els.message.hidden = true;
}

function setJudgeStepStatus(html) {
  els.judgeStepStatus.innerHTML = html;
}

function highlightJudgeStep(step) {
  state.activeJudgeStep = step;
  els.judgeSteps.querySelectorAll('.judge-step-btn').forEach((btn) => {
    btn.classList.toggle('is-active', Number(btn.dataset.step) === step);
  });
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
    <div class="tier-banner tier-banner-free">
      <span class="tier-banner-icon">🔒</span>
      <div>
        <strong>FREE TIER</strong>
        <p>Teaser only — Pro unlocks score, verdict, flags &amp; sources</p>
      </div>
    </div>
    <div class="card card-free">
      <h3>${data.addressType}</h3>
      <p><code>${data.address}</code></p>
      <p>${data.teaser}</p>
      <p class="free-hint">Risk band hint: <strong>${data.riskHint}</strong></p>
    </div>
    <div class="locked-grid">
      <div class="locked-field">
        <span class="locked-label">Risk score</span>
        <p class="score score-locked">██ / 100</p>
        <span class="lock-tag">PRO ONLY</span>
      </div>
      <div class="locked-field">
        <span class="locked-label">Verdict</span>
        <p class="locked-redacted">████████</p>
        <span class="lock-tag">PRO ONLY</span>
      </div>
      <div class="locked-field">
        <span class="locked-label">Flags</span>
        <ul class="locked-list">
          <li class="locked-redacted">████████████</li>
          <li class="locked-redacted">████████████</li>
          <li class="locked-redacted">████████████</li>
        </ul>
        <span class="lock-tag">PRO ONLY</span>
      </div>
      <div class="locked-field">
        <span class="locked-label">Sources</span>
        <p class="locked-redacted">${data.lockedFields.length} cited sources hidden</p>
        <span class="lock-tag">PRO ONLY</span>
      </div>
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
    <div class="tier-banner tier-banner-pro">
      <span class="tier-banner-icon">✓</span>
      <div>
        <strong>PRO UNLOCKED</strong>
        <p>Full research via RevenueCat entitlement — TEST / SANDBOX</p>
      </div>
    </div>
    <div class="card card-pro">
      <h3>${data.addressType} · Pro research</h3>
      <p><code>${data.address}</code></p>
      <p class="score score-pro">${data.riskScore} / 100</p>
      <span class="verdict ${verdictClass(data.verdict)}">${data.verdict}</span>
      <p class="pro-summary">${data.summary}</p>
    </div>
    <div class="card card-pro">
      <h3>Research detail</h3>
      <p>${data.detail.narrative}</p>
      <ul>${data.detail.checklist.map((c) => `<li>${c}</li>`).join('')}</ul>
    </div>
    <div class="card card-pro">
      <h3>Flags (${data.flags.length})</h3>
      <ul class="pro-flags">${flags}</ul>
    </div>
    <div class="card card-pro">
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
  if (!customerInfo?.entitlements?.active) return false;
  const active = customerInfo.entitlements.active;
  if (active[entitlementId]) return true;
  // Accept common aliases documented in README (pay-35 Pro, pay-35-pro, etc.)
  const aliases = ['pro', 'pay-35-pro', 'pay35_pro', 'morning_light_pro'];
  return aliases.some((id) => id !== entitlementId && active[id]);
}

async function syncEntitlementFromSdk() {
  if (!state.purchases || !state.config) return;

  if (state.demoOverride === 'expired' || state.demoOverride === 'fail') {
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
    els.stepUnlockBtn.disabled = true;
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
    els.stepUnlockBtn.disabled = !pkg;
  } catch (err) {
    els.offeringPrice.textContent = `Offerings error: ${err.message}`;
    els.unlockBtn.disabled = true;
    els.stepUnlockBtn.disabled = true;
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
  highlightJudgeStep(2);
  setJudgeStepStatus('Step <strong>2 Unlock Pro</strong> — choose <strong>Success</strong>, <strong>Fail</strong>, or <strong>Cancel</strong> in the TEST / SANDBOX modal.');
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
      highlightJudgeStep(3);
      setJudgeStepStatus('Step <strong>3 After</strong> — Pro entitlement active. Full score, verdict, flags &amp; sources unlocked.');
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
    highlightJudgeStep(4);
    setJudgeStepStatus('Step <strong>4 Fail</strong> — TEST / SANDBOX purchase failed. Free tier locked content restored.');
    showMessage(`TEST / SANDBOX purchase failed: ${err.message || 'Unknown error'}`, 'error');
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

async function runBeforeStep() {
  hideMessage();
  state.demoOverride = null;
  state.hasPro = false;
  updateEntitlementBadge();

  els.address.value = DEMO_ADDRESS;
  state.lastAddress = DEMO_ADDRESS;
  localStorage.setItem(STORAGE_LAST_ADDRESS, DEMO_ADDRESS);

  await refreshResults(DEMO_ADDRESS);
  highlightJudgeStep(1);
  setJudgeStepStatus('Step <strong>1 Before</strong> — free tier teaser loaded. Score, verdict, flags &amp; sources are locked.');
  showMessage('Free teaser loaded — locked fields visible. Tap step 2 to unlock Pro via TEST checkout.', 'info');
}

async function runAfterStep() {
  if (!state.lastAddress) {
    await runBeforeStep();
  }

  if (!state.hasPro) {
    showMessage('Complete step 2 (Unlock Pro) with a successful TEST purchase first, or use Restore if you already purchased.', 'error');
    return;
  }

  state.demoOverride = null;
  await syncEntitlementFromSdk();
  await refreshResults();
  highlightJudgeStep(3);
  setJudgeStepStatus('Step <strong>3 After</strong> — Pro research with full score, verdict, flags &amp; sources.');
  showMessage('Pro research loaded — all fields unlocked.', 'success');
}

async function runFailStep() {
  if (!state.lastAddress) {
    await runBeforeStep();
  }

  state.demoOverride = 'fail';
  state.hasPro = false;
  els.lastPurchase.textContent = `TEST / SANDBOX fail @ ${new Date().toLocaleTimeString()}`;
  updateEntitlementBadge();
  await refreshResults();
  highlightJudgeStep(4);
  setJudgeStepStatus('Step <strong>4 Fail</strong> — TEST / SANDBOX failed purchase. Still on free tier with locked content.');
  showMessage('TEST / SANDBOX: simulated failed purchase — free tier restored.', 'error');
}

async function runExpireStep() {
  if (!state.lastAddress) {
    await runBeforeStep();
  }

  state.demoOverride = 'expired';
  state.hasPro = false;
  els.lastPurchase.textContent = `TEST / SANDBOX expire @ ${new Date().toLocaleTimeString()}`;
  updateEntitlementBadge();
  await refreshResults();
  highlightJudgeStep(5);
  setJudgeStepStatus('Step <strong>5 Expire</strong> — TEST / SANDBOX expired entitlement. Pro content locked again.');
  showMessage('TEST / SANDBOX: simulated expired entitlement — Pro content locked.', 'error');
}

async function initRevenueCat(config) {
  state.config = config;
  const entitlementId = config.entitlementId || 'pro';
  els.entitlementLabel.textContent = entitlementId;
  els.entitlementLabelInline.textContent = entitlementId;
  els.paywallEntitlement.textContent = entitlementId;

  const appUserId = getOrCreateAppUserId();
  els.appUserId.textContent = appUserId;

  if (!config.hasRevenueCatKey) {
    els.rcStatus.textContent = 'Missing API key (UI demo only)';
    els.unlockBtn.disabled = true;
    els.stepUnlockBtn.disabled = true;
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

els.stepBeforeBtn.addEventListener('click', () => runBeforeStep());
els.stepUnlockBtn.addEventListener('click', () => purchasePro());
els.stepAfterBtn.addEventListener('click', () => runAfterStep());
els.stepFailBtn.addEventListener('click', () => runFailStep());
els.stepExpireBtn.addEventListener('click', () => runExpireStep());

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
