import {
  Purchases,
  ErrorCode,
  PurchasesError,
  LogLevel,
} from 'https://esm.sh/@revenuecat/purchases-js@1.53.1';

const STORAGE_USER_KEY = 'mlpay_app_user_id';
const STORAGE_LAST_ADDRESS = 'mlpay_last_address';
const DEMO_ADDRESS = 'So11111111111111111111111111111111111111112';
const SDK_UI_MOUNT_TIMEOUT_MS = 4000;
const WAIT_OVERLAY_MAX_MS = 3000;
const SDK_INIT_MAX_MS = 3000;
const PURCHASE_MAX_MS = 120000;

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
  paywallFallback: document.getElementById('paywall-fallback'),
  paywallStatus: document.getElementById('paywall-status'),
  closePaywallBtn: document.getElementById('close-paywall-btn'),
  stepBeforeBtn: document.getElementById('step-before-btn'),
  stepUnlockBtn: document.getElementById('step-unlock-btn'),
  stepAfterBtn: document.getElementById('step-after-btn'),
  stepFailBtn: document.getElementById('step-fail-btn'),
  stepExpireBtn: document.getElementById('step-expire-btn'),
  judgeStepStatus: document.getElementById('judge-step-status'),
  judgeSteps: document.getElementById('judge-steps'),
  payReady: document.getElementById('pay-ready'),
  payReadyStatus: document.getElementById('pay-ready-status'),
};

const state = {
  config: null,
  purchases: null,
  hasPro: false,
  demoOverride: null,
  currentPackage: null,
  availablePackages: [],
  offeringsError: null,
  lastAddress: localStorage.getItem(STORAGE_LAST_ADDRESS) || '',
  activeJudgeStep: null,
  checkoutInProgress: false,
  waitOverlayTimer: null,
  rcInitTimedOut: false,
};

function isTestStoreApiKey(apiKey) {
  return Boolean(apiKey && /^test_[a-zA-Z0-9_.-]+$/.test(apiKey));
}

function isWebBillingApiKey(apiKey) {
  return Boolean(apiKey && /^rcb_[a-zA-Z0-9_.-]+$/.test(apiKey));
}

function describeApiKeyType(apiKey) {
  if (isTestStoreApiKey(apiKey)) return 'Test Store (test_*)';
  if (isWebBillingApiKey(apiKey)) return 'Web Billing (rcb_*)';
  if (apiKey) return 'Unknown key prefix — use test_* or rcb_* public key';
  return 'Not configured';
}

function clearWaitOverlayTimer() {
  if (state.waitOverlayTimer) {
    clearTimeout(state.waitOverlayTimer);
    state.waitOverlayTimer = null;
  }
}

function dismissStuckSdkOverlays() {
  const selectors = [
    '#rcb-ui-pw-root',
    '[id^="rcb-ui"]',
    '[class*="rcb-ui"]',
    '[class*="rc-purchases"]',
  ];

  selectors.forEach((selector) => {
    document.querySelectorAll(selector).forEach((el) => {
      if (el.closest('#paywall-modal') || el.closest('#pay-ready')) return;
      el.remove();
    });
  });

  document.body.style.pointerEvents = '';
  document.body.style.overflow = '';
}

function hideWaitOverlay({ timedOut = false, errorMessage = '' } = {}) {
  clearWaitOverlayTimer();
  if (els.payReady) els.payReady.hidden = true;
  dismissStuckSdkOverlays();

  if (timedOut && errorMessage) {
    showMessage(errorMessage, 'error');
    if (els.rcStatus) {
      els.rcStatus.textContent = 'Init timed out (3s) — app usable; retry Unlock Pro or use steps 4–5';
    }
  }
}

function showWaitOverlay(detail = '', { maxMs = WAIT_OVERLAY_MAX_MS } = {}) {
  if (!els.payReady) return;

  els.payReady.hidden = false;
  if (els.payReadyStatus) els.payReadyStatus.textContent = detail;
  clearWaitOverlayTimer();

  state.waitOverlayTimer = setTimeout(() => {
    state.rcInitTimedOut = true;
    hideWaitOverlay({
      timedOut: true,
      errorMessage:
        'RevenueCat is taking too long — wait overlay dismissed after 3s. You can still use steps 4 Fail / 5 Expire, or retry Unlock Pro.',
    });
  }, maxMs);
}

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s`)), ms);
    }),
  ]);
}

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

function setModalStatus(text, type = 'info') {
  if (!text) {
    els.paywallStatus.hidden = true;
    els.paywallStatus.textContent = '';
    return;
  }
  els.paywallStatus.hidden = false;
  els.paywallStatus.textContent = text;
  els.paywallStatus.className = `paywall-status paywall-status-${type}`;
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

function formatPackageLabel(pkg) {
  const product = pkg?.webBillingProduct;
  if (!product) {
    return pkg?.identifier || 'Unknown package';
  }
  const name = product.displayName || product.identifier;
  const price = product.price?.formattedPrice || 'Test price';
  return `${name} · ${price}`;
}

function packageHasProduct(pkg) {
  return Boolean(pkg?.webBillingProduct?.identifier);
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

function collectPackagesFromOffering(offering) {
  if (!offering) return [];
  const fromAvailable = offering.availablePackages || [];
  if (fromAvailable.length) return fromAvailable.filter(packageHasProduct);
  const typed = [offering.monthly, offering.annual, offering.weekly, offering.lifetime].filter(Boolean);
  return typed.filter(packageHasProduct);
}

async function reloadOfferings() {
  state.offeringsError = null;
  state.availablePackages = [];
  state.currentPackage = null;

  if (!state.purchases) {
    state.offeringsError = 'RevenueCat SDK not initialized — add REVENUECAT_API_KEY.';
    return false;
  }

  try {
    const offerings = await state.purchases.getOfferings();
    const current = offerings.current;
    state.availablePackages = collectPackagesFromOffering(current);
    state.currentPackage = state.availablePackages[0] || null;
    return true;
  } catch (err) {
    state.offeringsError = err.message || String(err);
    return false;
  }
}

async function loadOfferingMeta() {
  if (!state.purchases) {
    els.offeringPrice.textContent = 'Add REVENUECAT_API_KEY to enable Test Store checkout.';
    els.unlockBtn.disabled = true;
    els.stepUnlockBtn.disabled = true;
    return;
  }

  await reloadOfferings();

  if (state.offeringsError) {
    els.offeringPrice.textContent = `Offerings error: ${state.offeringsError}`;
    els.unlockBtn.disabled = true;
    els.stepUnlockBtn.disabled = false;
    return;
  }

  if (state.currentPackage) {
    els.offeringPrice.textContent = `Current offering: ${formatPackageLabel(state.currentPackage)} · TEST / SANDBOX`;
  } else {
    els.offeringPrice.textContent =
      'No offering packages found. Attach a Test Store product to your current offering in RevenueCat.';
  }

  els.unlockBtn.disabled = !state.currentPackage;
  els.stepUnlockBtn.disabled = false;
}

function renderCheckoutFallback({ error = null, showInstructions = false } = {}) {
  const packages = state.availablePackages;
  els.paywallFallback.hidden = false;

  if (error) {
    setModalStatus(error, 'error');
  }

  const packageButtons =
    packages.length > 0
      ? `<ul class="paywall-package-list">${packages
          .map(
            (pkg, index) =>
              `<li><button type="button" class="paywall-package-btn" data-package-index="${index}">${formatPackageLabel(pkg)}</button></li>`
          )
          .join('')}</ul>`
      : '';

  const setupSteps = showInstructions
    ? `<ol class="paywall-setup-steps">
        <li>RevenueCat → Product catalog → create a <strong>Test Store</strong> product.</li>
        <li>Attach it to entitlement <code>${state.config?.entitlementId || 'pro'}</code>.</li>
        <li>Add the product to your <strong>Current</strong> offering as a package.</li>
        <li>Use a <code>test_*</code> Test Store public key (or <code>rcb_*</code> for Web Billing + Stripe).</li>
      </ol>`
    : '';

  els.paywallFallback.innerHTML = `
    <h4>${packages.length ? 'Choose a package' : 'Checkout unavailable'}</h4>
    <p>${
      packages.length
        ? 'Tap a package to start purchase(). If the RevenueCat UI above stays blank, use these buttons — they call the same SDK purchase flow.'
        : 'No purchasable packages were returned from RevenueCat. Fix the offering setup, then refresh this page.'
    }</p>
    ${packageButtons}
    ${setupSteps}
  `;

  els.paywallFallback.querySelectorAll('[data-package-index]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const index = Number(btn.dataset.packageIndex);
      const pkg = state.availablePackages[index];
      if (pkg) {
        void runCheckoutPurchase(pkg);
      }
    });
  });
}

function clearCheckoutModal() {
  els.paywallContainer.innerHTML = '';
  els.paywallFallback.hidden = true;
  els.paywallFallback.innerHTML = '';
  setModalStatus('');
}

function openPaywallModal() {
  clearCheckoutModal();
  els.paywallModal.hidden = false;
}

function closePaywallModal() {
  els.paywallModal.hidden = true;
  clearCheckoutModal();
}

function waitForNextFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function waitForSdkUiMount(container) {
  return new Promise((resolve) => {
    if (container.children.length > 0) {
      resolve(true);
      return;
    }

    const observer = new MutationObserver(() => {
      if (container.children.length > 0) {
        observer.disconnect();
        clearTimeout(timeoutId);
        resolve(true);
      }
    });

    observer.observe(container, { childList: true, subtree: true });

    const timeoutId = setTimeout(() => {
      observer.disconnect();
      resolve(false);
    }, SDK_UI_MOUNT_TIMEOUT_MS);
  });
}

function describePurchaseError(err) {
  if (!(err instanceof PurchasesError)) {
    return err?.message || 'Unknown purchase error';
  }

  if (err.errorCode === ErrorCode.UserCancelledError) {
    return 'Purchase cancelled.';
  }

  if (err.errorCode === ErrorCode.TestStoreSimulatedPurchaseError) {
    return 'Test Store simulated failed purchase.';
  }

  const code = err.errorCode != null ? ` (code ${err.errorCode})` : '';
  return `${err.message || 'Purchase failed'}${code}`;
}

async function handlePurchaseSuccess(purchaseResult) {
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
}

async function handlePurchaseFailure(err, { keepModalOpen = false } = {}) {
  if (err instanceof PurchasesError && err.errorCode === ErrorCode.UserCancelledError) {
    if (!keepModalOpen) closePaywallModal();
    showMessage('Purchase cancelled (Test Store cancel path).', 'info');
    return;
  }

  const message = describePurchaseError(err);
  els.lastPurchase.textContent = `TEST failed @ ${new Date().toLocaleTimeString()}`;

  if (err instanceof PurchasesError && err.errorCode === ErrorCode.TestStoreSimulatedPurchaseError) {
    state.demoOverride = 'fail';
    state.hasPro = false;
    updateEntitlementBadge();
    highlightJudgeStep(4);
    setJudgeStepStatus('Step <strong>4 Fail</strong> — TEST / SANDBOX purchase failed. Free tier locked content restored.');
    showMessage('TEST / SANDBOX: purchase failed in Test Store modal.', 'error');
    if (state.lastAddress) await refreshResults();
    if (!keepModalOpen) closePaywallModal();
    return;
  }

  state.demoOverride = 'fail';
  state.hasPro = false;
  updateEntitlementBadge();
  highlightJudgeStep(4);
  setJudgeStepStatus('Step <strong>4 Fail</strong> — TEST / SANDBOX purchase failed. Free tier locked content restored.');
  showMessage(`TEST / SANDBOX purchase failed: ${message}`, 'error');

  if (keepModalOpen) {
    setModalStatus(`Purchase error: ${message}. Try another package below or use step 4 Fail to simulate.`, 'error');
    renderCheckoutFallback();
  } else {
    closePaywallModal();
  }

  if (state.lastAddress) await refreshResults();
}

async function runCheckoutPurchase(rcPackage) {
  if (!state.purchases || !rcPackage) return;
  if (state.checkoutInProgress) return;

  state.checkoutInProgress = true;
  state.demoOverride = null;

  const apiKey = state.config?.revenueCatApiKey;
  const useTestStoreFlow = isTestStoreApiKey(apiKey);
  const useHostedModal = !useTestStoreFlow;

  showWaitOverlay(
    useTestStoreFlow
      ? 'Opening RevenueCat Test Store checkout…'
      : 'Loading Web Billing checkout…',
    { maxMs: WAIT_OVERLAY_MAX_MS }
  );

  try {
    if (useHostedModal) {
      if (els.paywallModal.hidden) openPaywallModal();
      els.paywallContainer.innerHTML = '';
      setModalStatus(`Loading checkout for ${formatPackageLabel(rcPackage)}…`, 'info');
      renderCheckoutFallback();
      await waitForNextFrame();
    } else {
      closePaywallModal();
      setModalStatus('');
      showMessage('RevenueCat Test Store modal opening — choose Success, Fail, or Cancel.', 'info');
    }

    const purchasePromise = state.purchases.purchase({
      rcPackage,
      ...(useHostedModal ? { htmlTarget: els.paywallContainer } : {}),
    });

    hideWaitOverlay();

    if (useHostedModal) {
      const mounted = await waitForSdkUiMount(els.paywallContainer);
      if (!mounted) {
        setModalStatus(
          'RevenueCat checkout UI did not render in this container. Use a package button below (same purchase() call) or verify Web Billing + Stripe setup for rcb_* keys.',
          'error'
        );
        renderCheckoutFallback();
      } else {
        setModalStatus('Complete checkout below, or cancel to close.', 'info');
      }
    }

    const purchaseResult = await withTimeout(purchasePromise, PURCHASE_MAX_MS, 'Purchase');
    await handlePurchaseSuccess(purchaseResult);
  } catch (err) {
    hideWaitOverlay();
    await handlePurchaseFailure(err, { keepModalOpen: useHostedModal });
  } finally {
    state.checkoutInProgress = false;
    hideWaitOverlay();
    dismissStuckSdkOverlays();
  }
}

async function purchasePro() {
  if (!state.purchases) {
    showMessage('Configure REVENUECAT_API_KEY to run Test Store purchases.', 'error');
    return;
  }

  highlightJudgeStep(2);
  setJudgeStepStatus('Step <strong>2 Unlock Pro</strong> — complete TEST / SANDBOX checkout (Success, Fail, or Cancel).');

  await reloadOfferings();

  if (state.offeringsError) {
    openPaywallModal();
    renderCheckoutFallback({ error: `Offerings error: ${state.offeringsError}`, showInstructions: true });
    showMessage(`Cannot load offerings: ${state.offeringsError}`, 'error');
    return;
  }

  if (!state.availablePackages.length) {
    openPaywallModal();
    renderCheckoutFallback({
      error: 'No packages in the current offering. RevenueCat returned an empty catalog.',
      showInstructions: true,
    });
    showMessage('No offering packages — see checkout modal for setup steps.', 'error');
    return;
  }

  const apiKey = state.config.revenueCatApiKey;
  const useTestStoreFlow = isTestStoreApiKey(apiKey);

  if (useTestStoreFlow) {
    showMessage(
      'RevenueCat Test Store modal will open on top of this page (not inside the white card). Choose Success, Fail, or Cancel.',
      'info'
    );
    await runCheckoutPurchase(state.currentPackage);
    return;
  }

  openPaywallModal();
  setModalStatus(`API key type: ${describeApiKeyType(apiKey)}. Loading Web Billing checkout…`, 'info');
  renderCheckoutFallback();

  if (state.currentPackage) {
    await runCheckoutPurchase(state.currentPackage);
    return;
  }

  try {
    setModalStatus('No default package — trying presentPaywall()…', 'info');
    const purchaseResult = await state.purchases.presentPaywall({
      htmlTarget: els.paywallContainer,
    });
    await handlePurchaseSuccess(purchaseResult);
  } catch (err) {
    const mounted = await waitForSdkUiMount(els.paywallContainer);
    if (!mounted) {
      renderCheckoutFallback({
        error: `${describePurchaseError(err)} — presentPaywall needs a paywall attached to the current offering.`,
        showInstructions: true,
      });
    }
    await handlePurchaseFailure(err, { keepModalOpen: true });
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
  hideWaitOverlay();
  closePaywallModal();
  dismissStuckSdkOverlays();

  if (!state.lastAddress) {
    await runBeforeStep();
  }

  state.demoOverride = 'fail';
  state.hasPro = false;
  state.checkoutInProgress = false;
  els.lastPurchase.textContent = `TEST / SANDBOX fail @ ${new Date().toLocaleTimeString()}`;
  updateEntitlementBadge();
  await refreshResults();
  highlightJudgeStep(4);
  setJudgeStepStatus('Step <strong>4 Fail</strong> — TEST / SANDBOX failed purchase. Still on free tier with locked content.');
  showMessage('TEST / SANDBOX: simulated failed purchase — free tier restored.', 'error');
}

async function runExpireStep() {
  hideWaitOverlay();
  closePaywallModal();
  dismissStuckSdkOverlays();

  if (!state.lastAddress) {
    await runBeforeStep();
  }

  state.demoOverride = 'expired';
  state.hasPro = false;
  state.checkoutInProgress = false;
  els.lastPurchase.textContent = `TEST / SANDBOX expire @ ${new Date().toLocaleTimeString()}`;
  updateEntitlementBadge();
  await refreshResults();
  highlightJudgeStep(5);
  setJudgeStepStatus('Step <strong>5 Expire</strong> — TEST / SANDBOX expired entitlement. Pro content locked again.');
  showMessage('TEST / SANDBOX: simulated expired entitlement — Pro content locked.', 'error');
}

async function initRevenueCat(config) {
  state.config = config;
  state.rcInitTimedOut = false;
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
    hideWaitOverlay();
    return;
  }

  showWaitOverlay('Connecting to RevenueCat Test Store…');

  try {
    Purchases.setLogLevel(LogLevel.Error);

    state.purchases = Purchases.configure({
      apiKey: config.revenueCatApiKey,
      appUserId,
    });

    const keyType = describeApiKeyType(config.revenueCatApiKey);
    els.rcStatus.textContent = `Connecting · ${keyType}`;

    await withTimeout(
      Promise.all([syncEntitlementFromSdk(), loadOfferingMeta()]),
      SDK_INIT_MAX_MS,
      'RevenueCat init'
    );

    els.rcStatus.textContent = `Test Store configured · ${keyType}`;
  } catch (err) {
    state.rcInitTimedOut = true;
    els.rcStatus.textContent = `Init issue: ${err.message}`;
    showMessage(`RevenueCat init: ${err.message}. Judge steps 4–5 still work.`, 'error');
  } finally {
    hideWaitOverlay();
    els.stepUnlockBtn.disabled = false;
    updateEntitlementBadge();
  }
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
els.closePaywallBtn.addEventListener('click', () => {
  hideWaitOverlay();
  closePaywallModal();
  dismissStuckSdkOverlays();
  state.checkoutInProgress = false;
});

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
  showWaitOverlay('Starting Morning Light Pay…');
  try {
    const res = await fetch('/api/config');
    const config = await res.json();
    await initRevenueCat(config);

    if (state.lastAddress) {
      els.address.value = state.lastAddress;
    }
  } catch (err) {
    showMessage(`Boot error: ${err.message}`, 'error');
  } finally {
    hideWaitOverlay();
    dismissStuckSdkOverlays();
  }
})();
