/* Insomnus petlisted application
 * Paste your Apps Script web app URL after deploying tools/petlist-apply.gs */
const APPLY_SCRIPT = 'https://script.google.com/macros/s/AKfycbz9ZOXVQFkEOAVIAxgDfO1ok3QCjIeWHtAuVIStLUquYoGccst_Zs9XZirk6IUZAgNB/exec';
const PINNED = 'https://x.com/insomnusxyz/status/2094810680948097106';
const WINDOW_END = new Date('2026-09-04T15:32:40Z');
const STORE_KEY = 'insomnus-petlist-apply';

const $ = (id) => document.getElementById(id);

function isHandle(raw) {
  return /^[A-Za-z0-9_]{1,15}$/.test(String(raw || '').trim().replace(/^@/, ''));
}

function isXPost(raw) {
  try {
    const u = new URL(String(raw || '').trim());
    if (!/^(www\.)?(x|twitter)\.com$/i.test(u.hostname)) return false;
    return /\/status\/\d+/.test(u.pathname);
  } catch (e) {
    return false;
  }
}

function isWallet(raw) {
  return /^0x[a-fA-F0-9]{40}$/.test(String(raw || '').trim());
}

function shortWallet(addr) {
  const a = String(addr || '');
  return a.slice(0, 6) + '…' + a.slice(-4);
}

function loadSaved() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); }
  catch (e) { return null; }
}

function saveLocal(data) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); }
  catch (e) {}
}

/* Header */
const header = $('header');
const menuBtn = $('menuBtn');
const mobileMenu = $('mobileMenu');
window.addEventListener('scroll', () => {
  if (header) header.classList.toggle('scrolled', window.scrollY > 60);
});
if (menuBtn && mobileMenu) {
  menuBtn.addEventListener('click', () => mobileMenu.classList.toggle('open'));
  mobileMenu.querySelectorAll('a').forEach((a) => {
    a.addEventListener('click', () => mobileMenu.classList.remove('open'));
  });
}

/* 72h window tag */
function tickWindow() {
  const el = $('windowTag');
  if (!el) return;
  const ms = WINDOW_END.getTime() - Date.now();
  if (ms <= 0) {
    el.textContent = 'window open';
    return;
  }
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  el.textContent = h + 'h ' + String(m).padStart(2, '0') + 'm ' + String(s).padStart(2, '0') + 's';
}
tickWindow();
setInterval(tickWindow, 1000);

/* Decorative header fill */
const FILLS = { fillName: 'SLEEPER', fillRank: 'GEN-1', fillDate: '09 / 03 / 26' };
function writeFills() {
  Object.keys(FILLS).forEach((id, i) => {
    const el = $(id);
    if (!el) return;
    el.textContent = '';
    const text = FILLS[id];
    let n = 0;
    setTimeout(function step() {
      n += 1;
      el.textContent = text.slice(0, n);
      if (n < text.length) setTimeout(step, 45);
    }, 180 * i);
  });
}
writeFills();
const headerLine = $('slipHeaderLine');
if (headerLine) headerLine.addEventListener('click', writeFills);

/* Pet deck */
const deck = $('petDeck');
if (deck) {
  deck.querySelectorAll('.pet-card').forEach((card) => {
    card.addEventListener('click', () => {
      deck.querySelectorAll('.pet-card').forEach((c) => c.classList.remove('active'));
      card.classList.add('active');
    });
  });
}

/* Checkboxes */
function bindCheck(id) {
  const el = $(id);
  if (!el) return;
  const toggle = () => {
    const on = el.getAttribute('aria-checked') === 'true';
    el.setAttribute('aria-checked', on ? 'false' : 'true');
    const err = $('err-agree');
    if (err) err.classList.remove('on');
  };
  el.addEventListener('click', toggle);
  el.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      toggle();
    }
  });
}
bindCheck('agreeCheckbox1');
bindCheck('agreeCheckbox2');

function checked(id) {
  return $(id) && $(id).getAttribute('aria-checked') === 'true';
}

function setWrap(id, state) {
  const el = $(id);
  if (!el) return;
  el.classList.remove('ok', 'bad');
  if (state) el.classList.add(state);
}

function showErr(id, on) {
  const el = $(id);
  if (!el) return;
  el.classList.toggle('on', Boolean(on));
}

function currentValues() {
  return {
    handle: String($('f-x').value || '').trim().replace(/^@/, ''),
    post: String($('f-quote').value || '').trim(),
    wallet: String($('f-wallet').value || '').trim()
  };
}

function validateLive() {
  const v = currentValues();
  if (v.handle) {
    const ok = isHandle(v.handle);
    setWrap('wrap-x', ok ? 'ok' : 'bad');
    showErr('err-x', !ok);
  } else {
    setWrap('wrap-x', '');
    showErr('err-x', false);
  }
  if (v.post) {
    const ok = isXPost(v.post);
    setWrap('wrap-quote', ok ? 'ok' : 'bad');
    showErr('err-quote', !ok);
  } else {
    setWrap('wrap-quote', '');
    showErr('err-quote', false);
  }
  if (v.wallet) {
    const ok = isWallet(v.wallet);
    setWrap('wrap-wallet', ok ? 'ok' : 'bad');
    showErr('err-wallet', !ok);
  } else {
    setWrap('wrap-wallet', '');
    showErr('err-wallet', false);
  }
}

['f-x', 'f-quote', 'f-wallet'].forEach((id) => {
  const el = $(id);
  if (!el) return;
  el.addEventListener('input', validateLive);
  el.addEventListener('blur', validateLive);
});

/* Views */
const VIEWS = ['slipFormView', 'slipSuccessView', 'slipFullView', 'slipAlreadyView', 'slipNetworkView'];
function showView(id) {
  VIEWS.forEach((v) => {
    const el = $(v);
    if (!el) return;
    if (v === 'slipFormView') {
      el.style.display = id === 'slipFormView' ? '' : 'none';
    } else {
      el.classList.toggle('on', v === id);
    }
  });
}

function resetSlipForm() {
  showView('slipFormView');
  ['f-x', 'f-quote', 'f-wallet'].forEach((id) => {
    if ($(id) && id !== 'f-wallet') { /* keep wallet optional */ }
  });
  $('btnSubmitSlip').disabled = false;
  $('disabledNote').textContent = 'all three lines and the ticks, then seal it';
}

document.querySelectorAll('[data-reset]').forEach((btn) => {
  btn.addEventListener('click', resetSlipForm);
});

async function sendApply(addr, handle, post) {
  if (!APPLY_SCRIPT) return false;
  const body = JSON.stringify({ address: addr, handle: handle, post: post });
  try {
    const res = await fetch(APPLY_SCRIPT, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: body
    });
    if (res.ok) {
      const data = await res.json().catch(() => ({ ok: true }));
      if (data && data.error === 'seen') return 'seen';
      return data.ok !== false ? (data.n || true) : false;
    }
  } catch (e) {}
  try {
    const url = APPLY_SCRIPT + (APPLY_SCRIPT.includes('?') ? '&' : '?') +
      'address=' + encodeURIComponent(addr) +
      '&handle=' + encodeURIComponent(handle) +
      '&post=' + encodeURIComponent(post);
    await fetch(url, { method: 'GET', mode: 'no-cors', redirect: 'follow' });
    return true;
  } catch (e) {
    return false;
  }
}

function demoState(wallet) {
  const w = wallet.toLowerCase();
  if (w.endsWith('0000')) return 'full';
  if (w.endsWith('9f0c')) return 'already';
  if (w.endsWith('dead')) return 'network';
  return '';
}

function paintAlready(addr, handle) {
  const meta = $('alreadyMeta');
  if (meta) meta.textContent = shortWallet(addr) + ' · @' + (handle || 'you');
  showView('slipAlreadyView');
}

function paintSuccess(n) {
  const q = $('queueNumber');
  if (q) q.textContent = n && Number(n) ? ("You're #" + n) : 'Application received';
  const share = $('btnShareX');
  if (share) {
    share.href = 'https://x.com/intent/post?text=' +
      encodeURIComponent('I just applied for the @insomnusxyz petlist.');
  }
  showView('slipSuccessView');
}

const submitBtn = $('btnSubmitSlip');
if (submitBtn) {
  submitBtn.addEventListener('click', async () => {
    const v = currentValues();
    let bad = false;
    if (!isHandle(v.handle)) { showErr('err-x', true); setWrap('wrap-x', 'bad'); bad = true; }
    if (!isXPost(v.post)) { showErr('err-quote', true); setWrap('wrap-quote', 'bad'); bad = true; }
    if (!isWallet(v.wallet)) { showErr('err-wallet', true); setWrap('wrap-wallet', 'bad'); bad = true; }
    if (!checked('agreeCheckbox1') || !checked('agreeCheckbox2')) {
      showErr('err-agree', true);
      bad = true;
    }
    if (bad) return;

    const demo = demoState(v.wallet);
    if (demo === 'full') { showView('slipFullView'); return; }
    if (demo === 'already') { paintAlready(v.wallet, v.handle); return; }
    if (demo === 'network') { showView('slipNetworkView'); return; }

    const saved = loadSaved();
    if (saved && saved.address && saved.address.toLowerCase() === v.wallet.toLowerCase()) {
      paintAlready(v.wallet, saved.handle || v.handle);
      return;
    }

    submitBtn.disabled = true;
    $('disabledNote').textContent = 'Sending to the kennel…';

    const result = await sendApply(v.wallet, v.handle, v.post);
    if (result === 'seen') {
      paintAlready(v.wallet, v.handle);
      submitBtn.disabled = false;
      return;
    }
    if (!result) {
      showView('slipNetworkView');
      submitBtn.disabled = false;
      return;
    }

    saveLocal({
      address: v.wallet.toLowerCase(),
      handle: v.handle,
      post: v.post,
      at: Date.now(),
      n: result === true ? null : result
    });
    paintSuccess(result === true ? null : result);
  });
}

/* Restore if this wallet already applied this browser */
(function restore() {
  const saved = loadSaved();
  if (!saved || !saved.address) return;
  const wallet = $('f-wallet');
  if (wallet && !wallet.value) wallet.value = saved.address;
})();
