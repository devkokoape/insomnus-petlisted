/**
 * Petlisted application intake for the standalone landing page.
 *
 * 1. Open the Google Sheet used for petlist applications.
 * 2. Extensions → Apps Script
 * 3. Paste this file, Save.
 * 4. Deploy → New deployment → Type: Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 5. Copy the Web app URL into app.js as APPLY_SCRIPT.
 *
 * Writes to a tab named "Applications":
 * time | address | handle | post | ref | xid | status
 *
 * Users tab (X logins):
 * time | xid | handle | name | pfp
 *
 * Script properties:
 *   X_CLIENT_ID     — OAuth 2.0 Client ID from developer.x.com
 *   X_CLIENT_SECRET — optional, if the app is confidential
 *
 * ref is an X username (no @), not a random code.
 */

var TAB = 'Applications';
var HEAD = ['time', 'address', 'handle', 'post', 'ref', 'xid', 'status'];
var USERS = 'Users';
var USER_HEAD = ['time', 'xid', 'handle', 'name', 'pfp'];
var SCORE_FOLLOW = 100;
var SCORE_QUOTE = 30;
var SCORE_SEAL = 50;
var SCORE_REF = 80;

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(TAB);
  if (!sheet) {
    sheet = ss.insertSheet(TAB);
    sheet.appendRow(HEAD);
    sheet.setFrozenRows(1);
  } else if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEAD);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function saveUser_(xid, handle, name, pfp) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(USERS);
  if (!sheet) {
    sheet = ss.insertSheet(USERS);
    sheet.appendRow(USER_HEAD);
    sheet.setFrozenRows(1);
  } else if (sheet.getLastRow() === 0) {
    sheet.appendRow(USER_HEAD);
    sheet.setFrozenRows(1);
  }
  var last = sheet.getLastRow();
  if (last > 1) {
    var ids = sheet.getRange(2, 2, last - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      if (String(ids[i][0]) === String(xid)) {
        sheet.getRange(i + 2, 1, 1, 5).setValues([[new Date(), xid, '@' + handle, name, pfp]]);
        return;
      }
    }
  }
  sheet.appendRow([new Date(), xid, '@' + handle, name, pfp]);
}

function xAuth_(code, verifier, redirect) {
  var props = PropertiesService.getScriptProperties();
  var id = String(props.getProperty('X_CLIENT_ID') || '');
  var secret = String(props.getProperty('X_CLIENT_SECRET') || '');
  if (!id) return { ok: false, error: 'no x client' };
  if (!code || !verifier || !redirect) return { ok: false, error: 'bad oauth' };

  var payload = {
    grant_type: 'authorization_code',
    code: String(code),
    redirect_uri: String(redirect),
    client_id: id,
    code_verifier: String(verifier)
  };
  var opts = {
    method: 'post',
    payload: payload,
    muteHttpExceptions: true
  };
  if (secret) {
    opts.headers = { Authorization: 'Basic ' + Utilities.base64Encode(id + ':' + secret) };
  }
  var tokRes = UrlFetchApp.fetch('https://api.twitter.com/2/oauth2/token', opts);
  var tok = {};
  try { tok = JSON.parse(tokRes.getContentText() || '{}'); } catch (err) { tok = {}; }
  if (!tok.access_token) return { ok: false, error: tok.error_description || tok.error || 'token failed' };

  var meRes = UrlFetchApp.fetch(
    'https://api.twitter.com/2/users/me?user.fields=profile_image_url,name,username',
    { headers: { Authorization: 'Bearer ' + tok.access_token }, muteHttpExceptions: true }
  );
  var me = {};
  try { me = JSON.parse(meRes.getContentText() || '{}'); } catch (err2) { me = {}; }
  var d = me.data || {};
  if (!d.id || !d.username) return { ok: false, error: 'user failed' };
  saveUser_(d.id, d.username, d.name || '', d.profile_image_url || '');
  return {
    ok: true,
    id: String(d.id),
    handle: String(d.username),
    name: d.name || d.username,
    pfp: d.profile_image_url || ''
  };
}

function saveRow_(address, handle, post, ref, xid) {
  var addr = String(address || '').trim().toLowerCase();
  var user = String(handle || '').trim().replace(/^@/, '');
  var link = String(post || '').trim();
  var by = String(ref || '').trim().replace(/^@/, '').toLowerCase();
  var id = String(xid || '').trim();
  if (!id) return { ok: false, error: 'connect x' };
  if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) return { ok: false, error: 'bad address' };
  if (!/^[A-Za-z0-9_]{1,15}$/.test(user)) return { ok: false, error: 'bad handle' };
  if (!/^https?:\/\/(www\.)?(x|twitter)\.com\//i.test(link)) return { ok: false, error: 'bad post' };
  if (by && !/^[A-Za-z0-9_]{1,15}$/.test(by)) return { ok: false, error: 'bad ref' };
  if (by && by === user.toLowerCase()) by = '';

  var sheet = getSheet_();
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var last = sheet.getLastRow();
    if (last > 1) {
      var col = sheet.getRange(2, 2, last - 1, 1).getValues();
      for (var i = 0; i < col.length; i++) {
        if (String(col[i][0] || '').trim().toLowerCase() === addr) {
          return { ok: false, error: 'seen', row: i + 2 };
        }
      }
    }
    sheet.appendRow([new Date(), addr, '@' + user, link, by ? '@' + by : '', id, 'pending']);
    var n = sheet.getLastRow() - 1;
    return { ok: true, n: n };
  } finally {
    lock.releaseLock();
  }
}

function board_() {
  var sheet = getSheet_();
  var last = sheet.getLastRow();
  var people = {};
  if (last > 1) {
    var values = sheet.getRange(2, 1, last - 1, 7).getValues();
    for (var i = 0; i < values.length; i++) {
      var h = String(values[i][2] || '').replace(/^@/, '').toLowerCase();
      if (!h) continue;
      if (!people[h]) {
        people[h] = { handle: h, score: SCORE_FOLLOW + SCORE_QUOTE + SCORE_SEAL, refs: 0, at: values[i][0] };
      }
    }
    for (var j = 0; j < values.length; j++) {
      var by = String(values[j][4] || '').replace(/^@/, '').toLowerCase();
      if (by && people[by]) {
        people[by].refs += 1;
        people[by].score += SCORE_REF;
      }
    }
  }
  var rows = [];
  for (var k in people) rows.push(people[k]);
  rows.sort(function (a, b) {
    if (b.score !== a.score) return b.score - a.score;
    return new Date(a.at) - new Date(b.at);
  });
  for (var r = 0; r < rows.length; r++) {
    rows[r].rank = r + 1;
    rows[r].handle = '@' + rows[r].handle;
    delete rows[r].at;
  }
  return {
    ok: true,
    tasks: [
      { id: 'follow', pts: SCORE_FOLLOW, name: 'Follow' },
      { id: 'quote', pts: SCORE_QUOTE, name: 'Quote the pin' },
      { id: 'seal', pts: SCORE_SEAL, name: 'Seal the slip' },
      { id: 'ref', pts: SCORE_REF, name: 'Referral' }
    ],
    rows: rows.slice(0, 100)
  };
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function read_(e) {
  var data = {};
  if (e && e.postData && e.postData.contents) {
    try { data = JSON.parse(e.postData.contents); } catch (err) { data = {}; }
  }
  var p = (e && e.parameter) || {};
  return {
    action: data.action || p.action || '',
    address: data.address || p.address || '',
    handle: data.handle || p.handle || '',
    post: data.post || p.post || '',
    ref: data.ref || p.ref || '',
    xid: data.xid || p.xid || '',
    code: data.code || p.code || '',
    verifier: data.verifier || p.verifier || '',
    redirect: data.redirect || p.redirect || ''
  };
}

function doPost(e) {
  try {
    var d = read_(e);
    if (d.action === 'xauth') return json_(xAuth_(d.code, d.verifier, d.redirect));
    return json_(saveRow_(d.address, d.handle, d.post, d.ref, d.xid));
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function doGet(e) {
  try {
    var p = (e && e.parameter) || {};
    if (p.board === '1' || p.board === 'true') return json_(board_());
    var d = read_(e);
    if (d.action === 'xauth') return json_(xAuth_(d.code, d.verifier, d.redirect));
    if (!d.address && !d.post) return json_({ ok: true, ready: true });
    return json_(saveRow_(d.address, d.handle, d.post, d.ref, d.xid));
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}
