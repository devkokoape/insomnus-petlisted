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
 * time | address | handle | post | status
 */

var TAB = 'Applications';
var HEAD = ['time', 'address', 'handle', 'post', 'status'];

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

function saveRow_(address, handle, post) {
  var addr = String(address || '').trim().toLowerCase();
  var user = String(handle || '').trim().replace(/^@/, '');
  var link = String(post || '').trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) return { ok: false, error: 'bad address' };
  if (!/^[A-Za-z0-9_]{1,15}$/.test(user)) return { ok: false, error: 'bad handle' };
  if (!/^https?:\/\/(www\.)?(x|twitter)\.com\//i.test(link)) return { ok: false, error: 'bad post' };

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
    sheet.appendRow([new Date(), addr, '@' + user, link, 'pending']);
    var n = sheet.getLastRow() - 1;
    return { ok: true, n: n };
  } finally {
    lock.releaseLock();
  }
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
    address: data.address || p.address || '',
    handle: data.handle || p.handle || '',
    post: data.post || p.post || ''
  };
}

function doPost(e) {
  try {
    var d = read_(e);
    return json_(saveRow_(d.address, d.handle, d.post));
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function doGet(e) {
  try {
    var d = read_(e);
    if (!d.address && !d.post) return json_({ ok: true, ready: true });
    return json_(saveRow_(d.address, d.handle, d.post));
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}
