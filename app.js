/* Insomnus petlisted application
 * Paste your Apps Script web app URL after deploying tools/petlist-apply.gs */
const APPLY_SCRIPT = 'https://script.google.com/macros/s/AKfycbz9ZOXVQFkEOAVIAxgDfO1ok3QCjIeWHtAuVIStLUquYoGccst_Zs9XZirk6IUZAgNB/exec';
const PINNED = 'https://x.com/insomnusxyz/status/2094810680948097106';
const X_ACCOUNT = 'insomnusxyz';
const X_KOKO = 'KokoApe_';
const DISCORD_URL = 'https://discord.gg/BCThPrJUtN';
const STORE_KEY = 'insomnus-petlist-apply';
const REF_KEY = 'insomnus-petlist-ref';
const SESSION_KEY = 'insomnus-x-session';
const PKCE_KEY = 'insomnus-x-pkce';
const TASK_KEY = 'insomnus-petlist-tasks';
const SOCIAL_POSTS = [
  { id: 't1', url: 'https://x.com/insomnusxyz/status/2050211623059763345' },
  { id: 't2', url: 'https://x.com/insomnusxyz/status/2088255514048438439' },
  { id: 't3', url: 'https://x.com/insomnusxyz/status/2052616450284863879' },
  { id: 't4', url: 'https://x.com/insomnusxyz/status/2045873017813934411' },
  { id: 't5', url: 'https://x.com/KokoApe_/status/2039587520753832060' }
];
const TASK_PTS = { follow: 100, discord: 100, like: 5, retweet: 10, quote: 15 };
const SB_URL = 'https://murnfprvourhkmieuref.supabase.co';
const SB_KEY = 'sb_publishable_EL3A6f2X9DlNgZap4MxCHQ_tLl4Axfc';
let sb = null;

function isLocalHost() {
  return /^(localhost|127\.0\.0\.1)$/i.test(location.hostname);
}

function sbClient() {
  if (sb) return sb;
  if (window.supabase && window.supabase.createClient) {
    sb = window.supabase.createClient(SB_URL, SB_KEY);
  }
  return sb;
}
/* Google Cloud → APIs & Services → Credentials → OAuth client (Web). Free.
   Also set GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET in tools/script-properties.txt */
const GOOGLE_CLIENT_ID = '866978225999-66emqrflkhjbqlfo8aka27lp0i8qm2re.apps.googleusercontent.com';

const $ = (id) => document.getElementById(id);

function cleanHandle(raw) {
  return String(raw || '').trim().replace(/^@/, '');
}

function isHandle(raw) {
  return /^[A-Za-z0-9_]{1,15}$/.test(cleanHandle(raw));
}

function refLinkFor(handle) {
  const u = new URL(location.href);
  u.search = 'ref=' + encodeURIComponent(cleanHandle(handle).toLowerCase());
  u.hash = '';
  return u.toString();
}

function readRefFromUrl() {
  const q = new URLSearchParams(location.search);
  const raw = q.get('ref') || q.get('r') || '';
  return isHandle(raw) ? cleanHandle(raw) : '';
}

function rememberRef(handle) {
  if (!handle) return;
  try { localStorage.setItem(REF_KEY, cleanHandle(handle)); } catch (e) {}
}

function loadRef() {
  const fromUrl = readRefFromUrl();
  if (fromUrl) {
    rememberRef(fromUrl);
    return fromUrl;
  }
  try { return localStorage.getItem(REF_KEY) || ''; } catch (e) { return ''; }
}

function copyText(value, btn) {
  if (!value) return;
  const done = () => {
    if (!btn) return;
    const prev = btn.textContent;
    btn.textContent = 'Copied';
    setTimeout(() => { btn.textContent = prev; }, 1400);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(value).then(done).catch(() => {});
    return;
  }
  const el = document.createElement('textarea');
  el.value = value;
  document.body.appendChild(el);
  el.select();
  try { document.execCommand('copy'); done(); } catch (e) {}
  el.remove();
}

function loadSession() {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    if (!s || !s.id) return null;
    /* Old Connect X sessions used this same key. Drop them. */
    if (s.provider !== 'google') {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return s;
  } catch (e) { return null; }
}
function saveSession(s) {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch (e) {}
}
function clearSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch (e) {}
}

function redirectUri() {
  let path = location.pathname || '/';
  if (path === '' || path === '/') return location.origin + '/';
  return location.origin + path;
}

async function sbHeaders(extra) {
  const headers = {
    apikey: SB_KEY,
    Authorization: 'Bearer ' + SB_KEY,
    'Content-Type': 'application/json',
    Prefer: 'return=representation'
  };
  const client = sbClient();
  if (client) {
    try {
      const { data } = await client.auth.getSession();
      if (data && data.session && data.session.access_token) {
        headers.Authorization = 'Bearer ' + data.session.access_token;
      }
    } catch (e) {}
  }
  if (extra) Object.keys(extra).forEach((k) => { headers[k] = extra[k]; });
  return headers;
}

async function sbRest(method, path, query, body) {
  const url = SB_URL + '/rest/v1' + path + (query ? '?' + query : '');
  const extra = (method === 'POST' && query && query.indexOf('on_conflict') >= 0)
    ? { Prefer: 'resolution=merge-duplicates,return=representation' }
    : null;
  const res = await fetch(url, {
    method: method,
    headers: await sbHeaders(extra),
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
  return { ok: res.ok, status: res.status, data: data };
}

function taskPtsId(id) {
  const tid = String(id || '');
  if (tid === 'follow-insomnusxyz') return 0;
  if (tid.indexOf('follow-') === 0) return 100;
  if (tid.indexOf('discord-') === 0) return 100;
  if (tid.indexOf('like-') === 0) return 5;
  if (tid.indexOf('rt-') === 0) return 10;
  if (tid.indexOf('quote-') === 0) return 15;
  return 0;
}

function rankFromLive(apps, claims) {
  const people = {};
  (apps || []).forEach((r) => {
    const h = cleanHandle(r.handle).toLowerCase();
    if (!isHandle(h)) return;
    if (!people[h]) {
      people[h] = {
        handle: h,
        score: SCORE.follow + SCORE.quote + SCORE.seal,
        refs: 0,
        extras: 0,
        at: r.created_at || ''
      };
    }
  });
  (apps || []).forEach((r) => {
    const by = cleanHandle(r.ref).toLowerCase();
    if (people[by]) {
      people[by].refs += 1;
      people[by].score += SCORE.ref;
    }
  });
  (claims || []).forEach((c) => {
    const h = cleanHandle(c.handle).toLowerCase();
    const pts = taskPtsId(c.task_id);
    if (h && pts && people[h]) {
      people[h].extras += pts;
      people[h].score += pts;
    }
  });
  return Object.keys(people).map((k) => people[k])
    .sort((a, b) => b.score - a.score || String(a.at).localeCompare(String(b.at)));
}

function b64url(bytes) {
  let s = '';
  bytes.forEach((b) => { s += String.fromCharCode(b); });
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function randomVerifier() {
  const a = new Uint8Array(32);
  crypto.getRandomValues(a);
  return b64url(a);
}

async function challengeOf(verifier) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return b64url(new Uint8Array(hash));
}

async function callScript(payload) {
  const body = JSON.stringify(payload);
  if (payload && payload.action === 'xauth' && /^(localhost|127\.0\.0\.1)$/i.test(location.hostname)) {
    try {
      const local = await fetch('/xauth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body
      });
      const data = await local.json().catch(() => null);
      if (data) return data;
    } catch (e) {}
  }
  try {
    const res = await fetch(APPLY_SCRIPT, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: body
    });
    if (res.ok) return await res.json();
  } catch (e) {}
  return null;
}

function xNotConfigured(msg) {
  const note = $('authGateNote');
  if (note) note.textContent = msg || 'Add GOOGLE_CLIENT_ID in app.js and script-properties.txt.';
}

async function startSupabaseGoogle() {
  const client = sbClient();
  if (!client) {
    xNotConfigured('Auth failed to load. Refresh and try again.');
    return;
  }
  const { error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectUri(),
      queryParams: { prompt: 'select_account' }
    }
  });
  if (error) {
    xNotConfigured(error.message || 'Enable Google in Supabase Auth, then add the callback in Google Cloud.');
  }
}

async function upsertUserFromSession(session) {
  if (!session || !session.user) return;
  const u = session.user;
  const meta = u.user_metadata || {};
  const name = meta.full_name || meta.name || u.email || 'Google';
  const pfp = meta.avatar_url || meta.picture || '';
  const email = u.email || '';
  let handle = (email.split('@')[0] || '').replace(/[^A-Za-z0-9_]/g, '').slice(0, 15);
  if (!handle) handle = ('g' + String(u.id).replace(/-/g, '')).slice(0, 15);
  saveSession({
    provider: 'google',
    id: String(u.id),
    handle: handle,
    name: name,
    pfp: pfp,
    at: Date.now()
  });
  await sbRest('POST', '/users', 'on_conflict=xid', {
    xid: String(u.id),
    handle: handle.toLowerCase(),
    name: name,
    pfp: pfp,
    last_login: new Date().toISOString()
  });
}

async function hydrateSupabaseSession() {
  const client = sbClient();
  if (!client) return false;
  const q = new URLSearchParams(location.search);
  if (q.get('code')) {
    try { await client.auth.exchangeCodeForSession(q.get('code')); } catch (e) {}
    const clean = new URL(location.href);
    clean.searchParams.delete('code');
    clean.searchParams.delete('state');
    const keepRef = loadRef();
    if (keepRef) clean.searchParams.set('ref', keepRef);
    history.replaceState({}, '', clean.pathname + (clean.search || ''));
  }
  const { data } = await client.auth.getSession();
  if (!data || !data.session) return false;
  await upsertUserFromSession(data.session);
  return true;
}

async function startXLogin() {
  if (!isLocalHost()) {
    await startSupabaseGoogle();
    return;
  }
  if (!GOOGLE_CLIENT_ID) {
    xNotConfigured('Create a free Google OAuth client, then paste the Client ID in app.js.');
    const paper = $('slipPaper');
    if (paper) paper.classList.add('locked');
    return;
  }
  const verifier = randomVerifier();
  const state = randomVerifier();
  const challenge = await challengeOf(verifier);
  sessionStorage.setItem(PKCE_KEY, JSON.stringify({ verifier: verifier, state: state, ref: loadRef() }));
  const url = 'https://accounts.google.com/o/oauth2/v2/auth'
    + '?response_type=code'
    + '&client_id=' + encodeURIComponent(GOOGLE_CLIENT_ID)
    + '&redirect_uri=' + encodeURIComponent(redirectUri())
    + '&scope=' + encodeURIComponent('openid email profile')
    + '&state=' + encodeURIComponent(state)
    + '&code_challenge=' + encodeURIComponent(challenge)
    + '&code_challenge_method=S256'
    + '&access_type=online'
    + '&prompt=select_account';
  location.href = url;
}

async function finishXLogin(code, state) {
  let pkce = null;
  try { pkce = JSON.parse(sessionStorage.getItem(PKCE_KEY) || 'null'); } catch (e) {}
  sessionStorage.removeItem(PKCE_KEY);
  if (!pkce || pkce.state !== state) {
    xNotConfigured('Google login state mismatch. Connect again.');
    paintXSession();
    return;
  }
  if (pkce.ref) rememberRef(pkce.ref);
  const data = await callScript({
    action: 'xauth',
    code: code,
    verifier: pkce.verifier,
    redirect: redirectUri()
  });
  if (data && data.ok && data.id) {
    saveSession({
      provider: 'google',
      id: String(data.id || ''),
      handle: cleanHandle(data.handle || ''),
      name: data.name || data.handle || 'Google',
      pfp: data.pfp || '',
      at: Date.now()
    });
  } else {
    xNotConfigured((data && data.error) ? String(data.error) : 'Google login failed. Try again.');
  }
  const clean = new URL(location.href);
  clean.search = '';
  const keepRef = loadRef();
  if (keepRef) clean.searchParams.set('ref', keepRef);
  history.replaceState({}, '', clean.pathname + (clean.search || ''));
  paintXSession();
  if (typeof flushPendingTasks === 'function') flushPendingTasks();
  if (typeof loadBoard === 'function') loadBoard();
}

function paintXSession() {
  const s = loadSession();
  const paper = $('slipPaper');
  const btnH = $('btnHeaderX');
  const btnM = $('btnMobileX');
  const user = $('xUser');
  if (s && s.id) {
    if (paper) paper.classList.remove('locked');
    if (btnH) btnH.hidden = true;
    if (btnM) btnM.hidden = true;
    if (user) {
      user.hidden = false;
      const name = $('xName');
      const pfp = $('xPfp');
      if (name) name.textContent = s.name || s.handle || 'Google';
      if (pfp) {
        if (s.pfp) { pfp.src = s.pfp; pfp.hidden = false; }
        else pfp.hidden = true;
      }
    }
  } else {
    if (paper) paper.classList.add('locked');
    if (btnH) btnH.hidden = false;
    if (btnM) btnM.hidden = false;
    if (user) user.hidden = true;
  }
  if (typeof renderBoardPage === 'function') renderBoardPage();
  if (typeof refreshShares === 'function') refreshShares();
}

function logoutX() {
  clearSession();
  const client = sbClient();
  if (client) client.auth.signOut().catch(function () {});
  paintXSession();
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
['btnHeaderX', 'btnGateX', 'btnMobileX'].forEach((id) => {
  const el = $(id);
  if (el) el.addEventListener('click', () => startXLogin());
});
if ($('btnLogoutX')) $('btnLogoutX').addEventListener('click', logoutX);

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
    handle: cleanHandle($('f-x') && $('f-x').value),
    post: String($('f-quote') && $('f-quote').value || '').trim(),
    wallet: String($('f-wallet') && $('f-wallet').value || '').trim(),
    ref: cleanHandle($('f-ref') && $('f-ref').value)
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
  if (v.ref) {
    const ok = isHandle(v.ref) && v.ref.toLowerCase() !== v.handle.toLowerCase();
    setWrap('wrap-ref', ok ? 'ok' : 'bad');
    showErr('err-ref', !ok);
  } else {
    setWrap('wrap-ref', '');
    showErr('err-ref', false);
  }
}

['f-x', 'f-quote', 'f-wallet', 'f-ref'].forEach((id) => {
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
  if ($('disabledNote')) $('disabledNote').textContent = 'one wallet · one slot';
}

document.querySelectorAll('[data-reset]').forEach((btn) => {
  btn.addEventListener('click', resetSlipForm);
});

async function sendApply(addr, handle, post, ref, xid) {
  const body = JSON.stringify({ address: addr, handle: handle, post: post, ref: ref || '', xid: xid || '' });
  try {
    const res = await fetch('/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body
    });
    const data = await res.json().catch(() => null);
    if (data && data.error === 'seen') return 'seen';
    if (data && data.ok) return data.n || true;
    if (data && data.error) return false;
  } catch (e) {}
  try {
    await sbRest('POST', '/users', 'on_conflict=xid', {
      xid: xid,
      handle: handle.toLowerCase(),
      name: (loadSession() && loadSession().name) || handle,
      pfp: (loadSession() && loadSession().pfp) || '',
      last_login: new Date().toISOString()
    });
    const seen = await sbRest('GET', '/applications', 'address=eq.' + encodeURIComponent(addr.toLowerCase()) + '&select=id,handle');
    if (seen.ok && Array.isArray(seen.data) && seen.data.length) return 'seen';
    const ins = await sbRest('POST', '/applications', '', {
      xid: xid,
      handle: handle.toLowerCase(),
      address: addr.toLowerCase(),
      post: post,
      ref: ref || '',
      status: 'pending'
    });
    if (!ins.ok) {
      const msg = typeof ins.data === 'string' ? ins.data : JSON.stringify(ins.data || '');
      if (/duplicate|unique/i.test(msg)) return 'seen';
      return false;
    }
    return true;
  } catch (e) {}
  return false;
}

function demoState(wallet) {
  const w = wallet.toLowerCase();
  if (w.endsWith('0000')) return 'full';
  if (w.endsWith('9f0c')) return 'already';
  if (w.endsWith('dead')) return 'network';
  return '';
}

function fillRefLink(inputId, handle) {
  const el = $(inputId);
  if (!el || !handle) return '';
  const link = refLinkFor(handle);
  el.value = link;
  return link;
}

function sharePostFor(handle) {
  const link = isHandle(handle)
    ? refLinkFor(handle)
    : (location.origin + (location.pathname || '/'));
  const lead = isHandle(handle)
    ? 'I just applied to the petlisted application from @insomnusxyz.'
    : 'The petlisted application from @insomnusxyz is open.';
  const text = [
    lead,
    '',
    'Insomnus is a dungeon game. You and your pet fight through the night. Embers Wake is already live.',
    '',
    isHandle(handle) ? ('Join with my link (@' + cleanHandle(handle) + '):') : 'Join the petlist:',
    link
  ].join('\n');
  return {
    link: link,
    text: text,
    href: 'https://x.com/intent/post?text=' + encodeURIComponent(text)
  };
}

function refreshShares(handle) {
  const h = isHandle(handle) ? cleanHandle(handle) : youHandle();
  const pack = sharePostFor(h);
  ['btnShareX', 'btnShareAlreadyX', 'btnEarnShare'].forEach((id) => {
    const el = $(id);
    if (el) el.href = pack.href;
  });
  const preview = $('sharePreview');
  if (preview) preview.textContent = pack.text;
  return pack;
}

function paintAlready(addr, handle) {
  const meta = $('alreadyMeta');
  if (meta) meta.textContent = shortWallet(addr) + ' · @' + (handle || 'you');
  fillRefLink('alreadyRefLink', handle);
  refreshShares(handle);
  showView('slipAlreadyView');
}

function paintSuccess(n, handle) {
  const q = $('queueNumber');
  if (q) q.textContent = n && Number(n) ? ("You're #" + n) : 'Application received';
  fillRefLink('refLink', handle);
  refreshShares(handle);
  showView('slipSuccessView');
}

const submitBtn = $('btnSubmitSlip');
if (submitBtn) {
  submitBtn.addEventListener('click', async () => {
    const sess = loadSession();
    if (!sess || !sess.id) {
      startXLogin();
      return;
    }
    const v = currentValues();
    let bad = false;
    if (!isHandle(v.handle)) { showErr('err-x', true); setWrap('wrap-x', 'bad'); bad = true; }
    if (!isXPost(v.post)) { showErr('err-quote', true); setWrap('wrap-quote', 'bad'); bad = true; }
    if (!isWallet(v.wallet)) { showErr('err-wallet', true); setWrap('wrap-wallet', 'bad'); bad = true; }
    if (v.ref && (!isHandle(v.ref) || v.ref.toLowerCase() === v.handle.toLowerCase())) {
      showErr('err-ref', true); setWrap('wrap-ref', 'bad'); bad = true;
    }
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
    $('disabledNote').textContent = 'Sending…';

    const ref = v.ref && v.ref.toLowerCase() !== v.handle.toLowerCase() ? v.ref : '';
    const result = await sendApply(v.wallet, v.handle, v.post, ref, sess.id);
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
      xid: sess.id || '',
      post: v.post,
      ref: ref,
      at: Date.now(),
      n: result === true ? null : result
    });
    paintSuccess(result === true ? null : result, v.handle);
    loadBoard();
  });
}

if ($('btnCopyRef')) {
  $('btnCopyRef').addEventListener('click', () => copyText($('refLink') && $('refLink').value, $('btnCopyRef')));
}
if ($('btnCopyAlreadyRef')) {
  $('btnCopyAlreadyRef').addEventListener('click', () => copyText($('alreadyRefLink') && $('alreadyRefLink').value, $('btnCopyAlreadyRef')));
}

/* Prefill referral from ?ref=xusername and restore prior apply */
(function restore() {
  const incoming = loadRef();
  const refInput = $('f-ref');
  if (refInput && incoming && !refInput.value) {
    refInput.value = incoming;
    const hint = $('refHint');
    if (hint) {
      hint.textContent = 'Brought by @' + incoming;
      hint.classList.add('on');
    }
  }

  const saved = loadSaved();
  if (saved && saved.address) {
    const wallet = $('f-wallet');
    if (wallet && !wallet.value) wallet.value = saved.address;
    if ($('f-x') && saved.handle && !$('f-x').value) $('f-x').value = saved.handle;
  }
  refreshShares(saved && saved.handle);
})();

const SCORE = { follow: 100, like: 5, retweet: 10, quote: 15, seal: 50, ref: 80 };
const BASE = SCORE.follow + SCORE.quote + SCORE.seal;
const EXAMPLE_BOARD = [
  ['nightwarden', 8],
  ['emberking', 7],
  ['sleeplessxyz', 7],
  ['gloopkeeper', 6],
  ['demondoggo', 6],
  ['healbotfan', 5],
  ['wakewalker', 5],
  ['somniarun', 4],
  ['dungeonrat', 4],
  ['robinhoodog', 4],
  ['lasttorch', 3],
  ['redrain_', 3],
  ['orbhunter', 3],
  ['ashsleeper', 3],
  ['voiddash', 2],
  ['bonechoir', 2],
  ['cinderpath', 2],
  ['noarmor', 2],
  ['staminadry', 2],
  ['hordeyes', 2],
  ['quietslash', 1],
  ['marksmist', 1],
  ['iceward', 1],
  ['holyglint', 1],
  ['repulse', 1],
  ['dashonly', 1],
  ['onepotion', 1],
  ['nextrun', 1],
  ['stillalive', 0],
  ['justgas', 0],
  ['walletopen', 0],
  ['firstseal', 0],
  ['latequote', 0],
  ['followdone', 0],
  ['pinreplied', 0],
  ['noaltacc', 0],
  ['onewallet', 0],
  ['sleeplessjr', 0],
  ['emberpup', 0],
  ['lastinline', 0]
].map(([handle, refs]) => ({ handle: handle, refs: refs, score: BASE + refs * SCORE.ref }));

function rankRows(rows) {
  const copy = rows.map((r) => ({
    handle: String(r.handle || '').replace(/^@/, '').replace(/[^A-Za-z0-9_]/g, '').slice(0, 15).toLowerCase(),
    score: Number(r.score) || 0,
    refs: Number(r.refs) || 0,
    extras: Number(r.extras) || 0
  })).filter((r) => r.handle);
  copy.sort((a, b) => b.score - a.score || a.handle.localeCompare(b.handle));
  copy.forEach((r, i) => { r.rank = i + 1; });
  return copy;
}

function mergeLocal(rows) {
  const saved = loadSaved();
  const list = rankRows(rows);
  const extra = extraTaskScore();
  const key = youHandle();
  if (!key) return list;
  const mine = list.find((r) => r.handle === key);
  if (mine) {
    if (!mine.extras) mine.score += extra;
  } else if (saved && isHandle(saved.handle)) {
    list.push({
      handle: key,
      score: SCORE.follow + SCORE.quote + SCORE.seal + extra,
      refs: 0,
      extras: extra
    });
  }
  return rankRows(list);
}

const PAGE_SIZE = 10;
let boardAll = [];
let boardPage = 0;

function youHandle() {
  const saved = loadSaved();
  if (saved && isHandle(saved.handle)) return cleanHandle(saved.handle).toLowerCase();
  const live = $('f-x') && $('f-x').value;
  if (isHandle(live)) return cleanHandle(live).toLowerCase();
  return '';
}

function renderYou(rows) {
  const el = $('boardYou');
  if (!el) return;
  const sess = loadSession();
  const h = youHandle();
  if (!sess) {
    el.innerHTML = 'Connect Google to take a rank.';
    return;
  }
  if (!h) {
    el.innerHTML = (sess.name || 'You') + ' · add your X handle, then seal the slip.';
    return;
  }
  const mine = rows.find((r) => r.handle === h);
  if (!mine) {
    el.innerHTML = '<span class="who">@' + h + '</span> · unranked';
    return;
  }
  el.innerHTML = '<span class="who">@' + h + '</span> · Rank <span class="rk">#' + mine.rank + '</span> · ' + mine.score + ' pts';
}

function renderBoardPage() {
  const box = $('boardRows');
  if (!box) return;
  const you = youHandle();
  const pages = Math.max(1, Math.ceil(boardAll.length / PAGE_SIZE));
  if (boardPage > pages - 1) boardPage = pages - 1;
  if (boardPage < 0) boardPage = 0;
  const slice = boardAll.slice(boardPage * PAGE_SIZE, boardPage * PAGE_SIZE + PAGE_SIZE);
  if (!boardAll.length) {
    box.innerHTML = '<div class="board-empty">No sealed slips yet. Be first.</div>';
  } else {
    box.innerHTML = slice.map((r) => {
      const cls = ['board-row'];
      if (r.rank === 1) cls.push('top1');
      if (you && r.handle === you) cls.push('you');
      return '<div class="' + cls.join(' ') + '">' +
        '<span class="rk">#' + r.rank + '</span>' +
        '<span class="who">@' + r.handle + '</span>' +
        '<span class="rf">' + r.refs + '</span>' +
        '<span class="sc">' + r.score + '</span>' +
        '</div>';
    }).join('');
  }
  const label = $('boardPageLabel');
  if (label) label.textContent = (boardPage + 1) + ' / ' + pages;
  const prev = $('boardPrev');
  const next = $('boardNext');
  if (prev) prev.disabled = boardPage <= 0;
  if (next) next.disabled = boardPage >= pages - 1;
  renderYou(boardAll);
}

function jumpToYou() {
  const h = youHandle();
  if (!h) return;
  const i = boardAll.findIndex((r) => r.handle === h);
  if (i < 0) return;
  boardPage = Math.floor(i / PAGE_SIZE);
}

function setBoard(rows) {
  boardAll = mergeLocal(rows);
  jumpToYou();
  renderBoardPage();
}

async function loadBoard() {
  let rows = [];
  try {
    const res = await fetch('/board');
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.rows) && data.rows.length) rows = data.rows;
    }
  } catch (e) {}
  if (!rows.length) {
    try {
      const apps = await sbRest('GET', '/applications', 'select=handle,ref,created_at&order=created_at.asc');
      const claims = await sbRest('GET', '/task_claims', 'select=handle,task_id');
      if (apps.ok && Array.isArray(apps.data) && apps.data.length) {
        rows = rankFromLive(apps.data, (claims.ok && claims.data) || []);
      }
    } catch (e) {}
  }
  if (!rows.length) rows = EXAMPLE_BOARD;
  setBoard(rows);
}

if ($('boardPrev')) $('boardPrev').addEventListener('click', () => { boardPage -= 1; renderBoardPage(); });
if ($('boardNext')) $('boardNext').addEventListener('click', () => { boardPage += 1; renderBoardPage(); });
if ($('f-x')) $('f-x').addEventListener('input', () => { renderBoardPage(); refreshShares(); });

function tweetIdFrom(url) {
  const m = String(url || '').match(/\/status\/(\d+)/i);
  return m ? m[1] : '';
}

function allSocialTasks() {
  const tasks = [
    {
      id: 'follow-' + X_ACCOUNT,
      type: 'follow',
      pts: TASK_PTS.follow,
      label: 'Follow',
      screen: X_ACCOUNT,
      once: true,
      base: true
    },
    {
      id: 'follow-' + X_KOKO,
      type: 'follow',
      pts: TASK_PTS.follow,
      label: 'Follow',
      screen: X_KOKO,
      once: true
    },
    {
      id: 'discord-insomnus',
      type: 'discord',
      pts: TASK_PTS.discord,
      label: 'Join',
      url: DISCORD_URL,
      once: true
    }
  ];
  SOCIAL_POSTS.forEach((p) => {
    const tweetId = tweetIdFrom(p.url);
    tasks.push(
      { id: 'like-' + p.id, type: 'like', pts: TASK_PTS.like, label: 'Like this', post: p, tweetId: tweetId, url: p.url, once: true },
      { id: 'rt-' + p.id, type: 'retweet', pts: TASK_PTS.retweet, label: 'Repost this', post: p, tweetId: tweetId, url: p.url, once: true },
      { id: 'quote-' + p.id, type: 'comment', pts: TASK_PTS.quote, label: 'Comment this', post: p, tweetId: tweetId, url: p.url, once: true }
    );
  });
  return tasks;
}

function loadTaskClaims() {
  try { return JSON.parse(localStorage.getItem(TASK_KEY) || '{}'); }
  catch (e) { return {}; }
}

function saveTaskClaim(id) {
  const all = loadTaskClaims();
  if (all[id]) return false;
  all[id] = Date.now();
  try { localStorage.setItem(TASK_KEY, JSON.stringify(all)); } catch (e) {}
  return true;
}

function extraTaskScore() {
  const claims = loadTaskClaims();
  let n = 0;
  allSocialTasks().forEach((t) => {
    if (t.base) return;
    if (claims[t.id]) n += t.pts;
  });
  return n;
}

function xIntent(task) {
  if (task.type === 'follow') {
    return 'https://x.com/' + encodeURIComponent(task.screen);
  }
  if (task.type === 'discord') {
    return task.url || DISCORD_URL;
  }
  if (task.type === 'like') {
    return 'https://x.com/intent/like?tweet_id=' + encodeURIComponent(task.tweetId);
  }
  if (task.type === 'retweet') {
    return 'https://x.com/intent/retweet?tweet_id=' + encodeURIComponent(task.tweetId);
  }
  if (task.type === 'quote' || task.type === 'comment') {
    return 'https://x.com/intent/tweet?in_reply_to=' + encodeURIComponent(task.tweetId);
  }
  return task.url || 'https://x.com/' + X_ACCOUNT;
}

function setTaskNote(msg) {
  const el = $('taskNote');
  if (!el) return;
  if (!msg) {
    el.classList.remove('on');
    el.textContent = '';
    return;
  }
  el.textContent = msg;
  el.classList.add('on');
}

const PENDING_TASKS = 'insomnus-pending-tasks';

function queuePendingTask(id) {
  try {
    const q = JSON.parse(sessionStorage.getItem(PENDING_TASKS) || '[]');
    if (q.indexOf(id) < 0) q.push(id);
    sessionStorage.setItem(PENDING_TASKS, JSON.stringify(q));
  } catch (e) {}
}

async function claimTask(id, fromQueue) {
  const task = allSocialTasks().find((t) => t.id === id);
  if (!task) return false;
  if (loadTaskClaims()[id]) return false;
  const sess = loadSession();
  if (!sess || !sess.id) {
    queuePendingTask(id);
    if (!fromQueue) setTaskNote('Connect Google to keep +' + task.pts + ' on your rank.');
    return false;
  }
  if (!saveTaskClaim(id)) return false;
  if (task.id === 'follow-' + X_ACCOUNT) {
    const box = $('agreeCheckbox1');
    if (box) box.setAttribute('aria-checked', 'true');
  }
  const payload = {
    xid: sess.id,
    handle: youHandle() || '',
    task_id: id
  };
  try {
    await fetch('/task', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (e) {}
  try {
    await sbRest('POST', '/task_claims', 'on_conflict=xid,task_id', payload);
  } catch (e) {}
  return true;
}

async function flushPendingTasks() {
  const sess = loadSession();
  if (!sess || !sess.id) return;
  let q = [];
  try { q = JSON.parse(sessionStorage.getItem(PENDING_TASKS) || '[]'); } catch (e) {}
  try { sessionStorage.removeItem(PENDING_TASKS); } catch (e) {}
  let any = false;
  for (let i = 0; i < q.length; i++) {
    if (await claimTask(q[i], true)) any = true;
  }
  if (any) {
    renderTaskList();
    if (typeof loadBoard === 'function') loadBoard();
    setTaskNote('Sealed. Those tasks pay once.');
  }
}

function renderTaskList() {
  const box = $('taskList');
  if (!box) return;
  const claims = loadTaskClaims();
  const follows = allSocialTasks().filter((t) => t.type === 'follow');
  const discord = allSocialTasks().find((t) => t.type === 'discord');
  let html = '';
  function oneCard(kicker, title, inner) {
    return '<article class="dungeon-frame x-card"><div class="x-card-kicker">' + kicker + '</div><h3>' + title + '</h3><div class="x-card-actions one">' + inner + '</div></article>';
  }
  const ins = follows.find((t) => t.screen === X_ACCOUNT);
  const koko = follows.find((t) => t.screen === X_KOKO);
  if (ins) {
    const done = Boolean(claims[ins.id]);
    html += oneCard('FOLLOW', 'Follow Insomnus on X',
      '<a class="btn-ghost' + (done ? ' done' : '') + '" data-task="' + ins.id + '" href="' + xIntent(ins) + '" target="_blank" rel="noopener">Follow <em>+' + ins.pts + '</em></a>');
  }
  html += oneCard('REPEATS', 'Share your link',
    '<a class="btn-primary" id="btnEarnShare" target="_blank" rel="noopener" href="#">Share <em>+' + SCORE.ref + '</em></a>');
  if (koko) {
    const done = Boolean(claims[koko.id]);
    html += oneCard('FOLLOW', 'Follow KokoApe on X',
      '<a class="btn-ghost' + (done ? ' done' : '') + '" data-task="' + koko.id + '" href="' + xIntent(koko) + '" target="_blank" rel="noopener">Follow <em>+' + koko.pts + '</em></a>');
  }
  if (discord) {
    const done = Boolean(claims[discord.id]);
    html += oneCard('DISCORD', 'Join Insomnus Discord',
      '<a class="btn-ghost' + (done ? ' done' : '') + '" data-task="' + discord.id + '" href="' + xIntent(discord) + '" target="_blank" rel="noopener">Join <em>+' + discord.pts + '</em></a>');
  }
  SOCIAL_POSTS.forEach((p, i) => {
    const kids = allSocialTasks().filter((t) => t.post && t.post.id === p.id);
    const n = String(i + 1).padStart(2, '0');
    html += '<article class="dungeon-frame x-card">';
    html += '<a class="x-card-title" href="' + p.url + '" target="_blank" rel="noopener">';
    html += '<div class="x-card-kicker">TASK ' + n + '</div>';
    html += '<h3>Like, repost &amp; comment</h3>';
    html += '</a>';
    html += '<div class="x-card-actions">';
    kids.forEach((t) => {
      const done = Boolean(claims[t.id]);
      const kind = t.type === 'comment' ? 'btn-primary' : 'btn-ghost';
      html += '<a class="' + kind + (done ? ' done' : '') + '" data-task="' + t.id + '" href="' + xIntent(t) + '" target="_blank" rel="noopener">' +
        t.label + ' <em>+' + t.pts + '</em></a>';
    });
    html += '</div></article>';
  });
  html += '<div class="task-note" id="taskNote"></div>';
  box.innerHTML = html;
  box.querySelectorAll('[data-task]').forEach((btn) => {
    btn.addEventListener('click', () => onTaskTap(btn.getAttribute('data-task')));
  });
  if (typeof refreshShares === 'function') refreshShares();
}

async function onTaskTap(id) {
  const task = allSocialTasks().find((t) => t.id === id);
  if (!task) return;
  if (loadTaskClaims()[id]) {
    setTaskNote('Already sealed. Share is the loop.');
    return;
  }
  const ok = await claimTask(id);
  const keepNote = $('taskNote') ? $('taskNote').textContent : '';
  renderTaskList();
  if (ok) {
    setTaskNote('+' + task.pts + ' sealed. Once only.');
    if (typeof loadBoard === 'function') loadBoard();
  } else if (keepNote) {
    setTaskNote(keepNote);
  }
}

renderTaskList();
if (loadSession() && loadSession().id) flushPendingTasks();

loadBoard();

(async function bootX() {
  const q = new URLSearchParams(location.search);
  if (isLocalHost() && q.get('code') && q.get('state')) {
    await finishXLogin(q.get('code'), q.get('state'));
    return;
  }
  const ok = await hydrateSupabaseSession();
  if (ok) {
    if (typeof flushPendingTasks === 'function') flushPendingTasks();
    if (typeof loadBoard === 'function') loadBoard();
  }
  paintXSession();
})();
