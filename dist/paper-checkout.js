// Payment sandbox only. Never use this state as a real billing entitlement.
const PAPER_BALANCE = 50000;
const PAPER_SUCCESS_CARD = '4242424242424242';
const PAPER_DECLINE_CARD = '4000000000000002';
function paperAccount() {
  const billing = growthState().paperBilling;
  return billing && billing.mode === 'paper' ? billing : { mode: 'paper', balance: PAPER_BALANCE, subscription: null, receipts: [] };
}
function paperPrice(yearly) { return yearly ? { amount: 7200, cycle: 'yearly', label: '$72 / year' } : { amount: 900, cycle: 'monthly', label: '$9 / month' }; }
function paperMoney(cents) { return '$' + (cents / 100).toFixed(2); }
function paperActive() { return paperAccount().subscription?.status === 'active'; }
function validatePaperPayment(values, now = new Date()) {
  const card = String(values.card || '').replace(/[\s-]/g, '');
  if (![PAPER_SUCCESS_CARD, PAPER_DECLINE_CARD].includes(card)) return 'Use a test card: 4242 4242 4242 4242. Real card details are not accepted.';
  if (!String(values.name || '').trim()) return 'Enter a test cardholder name.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email || '')) return 'Enter a valid receipt email. No email will be sent.';
  const expiry = /^(\d{2})\s*\/\s*(\d{2})$/.exec(String(values.expiry || '').trim());
  if (!expiry || +expiry[1] < 1 || +expiry[1] > 12 || +expiry[2] + 2000 < now.getFullYear() || (+expiry[2] + 2000 === now.getFullYear() && +expiry[1] < now.getMonth() + 1)) return 'Use a future expiry in MM/YY format.';
  if (String(values.cvc || '') !== '123') return 'Use the test security code 123.';
  if (!String(values.postal || '').trim()) return 'Enter a test billing postal code.';
  if (card === PAPER_DECLINE_CARD) return 'Test payment declined. Try 4242 4242 4242 4242 to simulate a successful payment.';
  return '';
}
function makePaperPurchase(account, yearly, now = new Date()) {
  if (account.subscription?.status === 'active') throw Error('Your test Premium plan is already active. Cancel or reset it before another test payment.');
  const price = paperPrice(yearly);
  if (!Number.isSafeInteger(account.balance) || account.balance < price.amount) throw Error('Not enough virtual funds. Reset your paper account to try again.');
  const receipt = { id: 'paper-' + crypto.randomUUID(), mode: 'paper', amount: price.amount, cycle: price.cycle, paidAt: now.toISOString(), last4: '4242' };
  return { mode: 'paper', balance: account.balance - price.amount, subscription: { status: 'active', cycle: price.cycle, startedAt: receipt.paidAt }, receipts: [...account.receipts, receipt].slice(-20) };
}
function paperCheckoutPage() {
  const account = paperAccount(), active = paperActive(), price = paperPrice(annualPricing), latest = account.receipts.at(-1);
  return title('Try Premium with paper money.', 'A test checkout for your Nextwork account. No real money moves.') + `<div class="paper-test-banner">${icon('spark',20)}<div><b>TEST MODE · Virtual funds only</b><p>Use the fake payment details below. Real card details are not accepted. Card numbers and security codes are never saved or sent to a payment provider.</p></div></div><div class="paper-checkout-grid"><section class="panel wide-panel"><div class="paper-account-heading"><div><span class="eyebrow">YOUR PAPER ACCOUNT</span><h2>${active ? 'Test Premium is active' : 'Your test checkout'}</h2><p>${esc(Account.user.email || 'Your Nextwork account')}</p></div><span class="paper-balance"><small>Virtual balance</small><b>${paperMoney(account.balance)}</b></span></div>${active ? `<div class="paper-success" role="status">${icon('check',24)}<div><b>Test payment successful</b><p>Premium ${account.subscription.cycle} · No real charge or automatic renewal.</p></div></div><div class="dialog-actions"><a class="primary" href="#premium">Open Premium workspace →</a><button class="outline" onclick="cancelPaperPlan()">Cancel test plan</button></div>` : `<div class="billing-switch" role="group" aria-label="Test billing period"><button class="${!annualPricing?'active':''}" aria-pressed="${!annualPricing}" onclick="annualPricing=false;render()">Monthly · $9</button><button class="${annualPricing?'active':''}" aria-pressed="${annualPricing}" onclick="annualPricing=true;render()">Yearly · $72</button></div><div class="paper-test-details"><div><b>Fake card: 4242 4242 4242 4242</b><small>Future expiry · CVC 123 · Any test name and postal code</small></div><button class="outline" type="button" onclick="fillPaperDetails()">Fill test details</button></div><form id="paper-checkout-form" autocomplete="off"><div class="profile-fields"><label class="field">Test cardholder name<input name="name" id="paper-name" required maxlength="120" placeholder="Alex Graduate"></label><label class="field">Receipt email<input name="email" id="paper-email" type="email" required maxlength="254" value="${esc(Account.user.email || '')}"></label></div><label class="field">Test card number<input name="card" id="paper-card" type="text" inputmode="numeric" autocomplete="off" required maxlength="23" placeholder="4242 4242 4242 4242" aria-describedby="paper-card-help"></label><small id="paper-card-help">Only designated test card numbers are accepted.</small><div class="profile-fields"><label class="field">Expiry<input name="expiry" id="paper-expiry" inputmode="numeric" required maxlength="7" placeholder="MM/YY"></label><label class="field">Test security code<input name="cvc" id="paper-cvc" type="password" inputmode="numeric" autocomplete="off" required maxlength="3" placeholder="123"></label><label class="field">Test postal code<input name="postal" id="paper-postal" required maxlength="20" placeholder="10001"></label></div><label class="consent"><input id="paper-consent" type="checkbox" required> I understand this is a simulated payment using virtual funds.</label><p id="paper-checkout-error" class="review-error" role="alert"></p><button class="primary paper-pay-button" type="submit">Pay ${paperMoney(price.amount)} in test money →</button><p class="resume-hint">No charge, renewal, payment processor, or email delivery. Your Free tools stay available.</p></form>`}${account.subscription?.status === 'cancelled' ? '<p class="resume-hint">Your test plan was cancelled. Previous virtual payments remain in your test history.</p>' : ''}${latest ? `<details class="paper-receipt"><summary>Latest test receipt · ${paperMoney(latest.amount)}</summary><dl><dt>Reference</dt><dd>${esc(latest.id)}</dd><dt>Plan</dt><dd>Premium · ${esc(latest.cycle)}</dd><dt>Test card</dt><dd>•••• 4242</dd><dt>Amount</dt><dd>${paperMoney(latest.amount)} virtual USD</dd><dt>Paid</dt><dd>${esc(new Date(latest.paidAt).toLocaleString())}</dd></dl></details>` : ''}<button class="text-control paper-reset" onclick="resetPaperAccount()">Reset paper account to $500</button><p id="paper-manage-error" class="review-error" role="alert"></p></section><aside class="panel wide-panel paper-order"><span class="eyebrow">ORDER SUMMARY</span><h2>Nextwork Premium</h2><div class="paper-order-price">${active ? paperPrice(account.subscription.cycle==='yearly').label : price.label}</div><p>Paid-plan experience with virtual funds.</p>${planFeatures(['Employer-shared contact cards & outreach drafts','Outreach tracker and follow-up planning','Profile review requests & priority placement preview','Saved project alerts and activity insights'])}<div class="notice">Test activation does not issue a verified badge, change real application ranking, or connect unavailable employer services.</div><a class="text-link" href="#pricing">Compare plans →</a></aside></div>`;
}
function fillPaperDetails() {
  $('#paper-name').value = 'Alex Graduate'; $('#paper-email').value = 'alex@example.com';
  $('#paper-card').value = '4242 4242 4242 4242';
  $('#paper-expiry').value = '12/' + String(new Date().getFullYear() + 2).slice(-2);
  $('#paper-cvc').value = '123'; $('#paper-postal').value = '10001';
}
async function persistPaperAccount(billing) {
  if (!Account.user || isOrganizationAccount() || !Backend.ready) throw Error('Sign in to your personal account and reconnect before testing a payment.');
  const owner = Account.user.id, state = growthState();
  state.paperBilling = billing; saveGrowth(state);
  await saveWorkspace();
  if (Account.user?.id !== owner || !Backend.ready) throw Error('Your account changed. Sign in again before testing a payment.');
}
function bindPaperCheckout() {
  const form = $('#paper-checkout-form'); if (!form) return;
  let submitting = false;
  form.onsubmit = async event => {
    event.preventDefault(); if (submitting) return;
    const errorNode = $('#paper-checkout-error'), button = form.querySelector('button[type="submit"]');
    const values = Object.fromEntries(new FormData(form)), error = validatePaperPayment(values);
    // Clear sensitive-shaped fields before any asynchronous work. They never enter workspace state.
    $('#paper-card').value = ''; $('#paper-cvc').value = '';
    if (error) { errorNode.textContent = error; return; }
    if (!$('#paper-consent').checked) { errorNode.textContent = 'Confirm that you are using virtual funds.'; return; }
    submitting = true; button.disabled = true; errorNode.textContent = '';
    try {
      await persistPaperAccount(makePaperPurchase(paperAccount(), annualPricing));
      render(); toast('Test Premium activated. No real money charged.');
    } catch (error) { errorNode.textContent = error.message; }
    finally { submitting = false; button.disabled = false; }
  };
}
async function cancelPaperPlan() {
  const account = paperAccount(); if (!paperActive()) return;
  try { await persistPaperAccount({...account, subscription: {...account.subscription, status:'cancelled'}}); render(); toast('Test plan cancelled. No real subscription was affected.'); }
  catch (error) { $('#paper-manage-error').textContent = error.message; }
}
async function resetPaperAccount() {
  try { await persistPaperAccount({mode:'paper',balance:PAPER_BALANCE,subscription:null,receipts:[]}); render(); toast('Paper account reset to $500 in virtual funds.'); }
  catch (error) { $('#paper-manage-error').textContent = error.message; }
}
