/**
 * Google Apps Script backend for the Grocery List app (household edition).
 *
 * DATA MODEL (three tabs in one Google Sheet; created by setupSheets()):
 *   Households   - one row per household; the passcode is stored only as a salted hash.
 *   Members      - one row per device that joined; only a hash of its random token is stored.
 *   GroceryItems - the items, each stamped with the householdId that owns it.
 *
 * SETUP / UPGRADE:
 * 1. Open the Sheet > Extensions > Apps Script and paste this entire file in.
 * 2. Run setupSheets() once from the editor and authorize. It creates the Households and
 *    Members tabs and adds a householdId column to GroceryItems. Existing rows are kept.
 * 3. Deploy > Manage deployments > Edit > New version (keeps the same Web App URL).
 *    First time: Deploy > New deployment > Web app, Execute as: Me, Who has access: Anyone.
 *    "Anyone" only lets people reach the script; every request still needs a valid
 *    device token (or a household name + passcode to join).
 * 4. Create your household in the web app ("Create household").
 * 5. To keep your EXISTING rows: edit the name in adoptMyRows() below, then run it from the
 *    editor. It stamps every row that has no householdId with your household.
 *
 * LEGACY iOS APP: the old app sends one shared secret. Put it in LEGACY_SECRET below to keep
 * it working; it will read/write the household chosen by adoptMyRows(). Leave it empty to
 * switch the legacy path off.
 *
 * Treat the spreadsheet itself as sensitive: anyone with edit access can read the hashes.
 */

const LEGACY_SECRET = '';

const SHEET_HOUSEHOLDS = 'Households';
const SHEET_MEMBERS = 'Members';
const SHEET_ITEMS = 'GroceryItems';

const HOUSEHOLD_COLUMNS = ['householdId', 'name', 'nameKey', 'passSalt', 'passHash', 'failedAttempts', 'lockedUntil', 'createdAt'];
const MEMBER_COLUMNS = ['memberId', 'householdId', 'displayName', 'tokenHash', 'createdAt', 'lastSeenAt', 'revokedAt'];
const ITEM_COLUMNS = [
  'id', 'name', 'recommendedStore', 'recommendedQuantity', 'cadence',
  'customCadenceDays', 'isChecked', 'lastCheckedDate', 'updatedAt', 'householdId',
];

const HASH_ROUNDS = 3000;
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
const GLOBAL_JOIN_FAILURE_LIMIT = 40; // failed joins per 15 minutes across all households
const GLOBAL_CREATE_LIMIT = 10; // household creations per hour
const MAX_ITEM_JSON = 4000;

const GENERIC_JOIN_ERROR = 'invalid household name or passcode';

function doGet(e) {
  try {
    const params = (e && e.parameter) || {};
    // Legacy iOS app only. The web app never sends a token in the URL.
    if (LEGACY_SECRET && params.action === 'list' && params.token === LEGACY_SECRET) {
      const householdId = legacyHouseholdId();
      if (!householdId) return jsonResponse({ error: 'unauthorized' });
      return jsonResponse({ items: listItems(householdId) });
    }
    return jsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse({ error: 'server exception' });
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (err) {
    return jsonResponse({ error: 'server busy, try again' });
  }
  try {
    let body;
    try {
      body = JSON.parse(e.postData.contents);
    } catch (err) {
      return jsonResponse({ error: 'invalid JSON body' });
    }
    return jsonResponse(handle(body));
  } catch (err) {
    if (err && err.userMessage) return jsonResponse({ error: err.userMessage });
    return jsonResponse({ error: 'server exception' });
  } finally {
    lock.releaseLock();
  }
}

function handle(body) {
  if (body.action === 'createHousehold') return createHousehold(body);
  if (body.action === 'joinHousehold') return joinHousehold(body);

  const auth = authenticate(body.token);
  if (!auth) fail('unauthorized');

  switch (body.action) {
    case 'list':
      return { items: listItems(auth.householdId) };
    case 'upsert':
      upsertItem(auth.householdId, body.item);
      return { success: true };
    case 'delete':
      deleteItem(auth.householdId, body.id);
      return { success: true };
    case 'leave':
      if (!auth.memberId) fail('unsupported');
      revokeMember(auth.memberId);
      return { success: true };
    default:
      fail('unknown action');
  }
}

// ---------- Households ----------

function validatePasscode(passcode) {
  return typeof passcode === 'string' &&
    passcode.length >= 8 && passcode.length <= 128 &&
    /[A-Za-z]/.test(passcode) && /[0-9]/.test(passcode) && /[^A-Za-z0-9]/.test(passcode);
}

function normalizeName(name) {
  return String(name || '').trim().replace(/\s+/g, ' ');
}

function createHousehold(body) {
  const name = normalizeName(body.name);
  if (name.length < 2 || name.length > 40) fail('household name must be 2-40 characters');
  if (!validatePasscode(body.passcode)) {
    fail('passcode must be at least 8 characters with a letter, a number and a special character');
  }
  throttle('creates', GLOBAL_CREATE_LIMIT, 3600, 'too many households created, try again later');

  const sheet = getTable(SHEET_HOUSEHOLDS, HOUSEHOLD_COLUMNS);
  const nameKey = name.toLowerCase();
  if (readRows(sheet, HOUSEHOLD_COLUMNS).some(function (r) { return r.nameKey === nameKey; })) {
    fail('that household name is already taken');
  }

  const salt = randomToken();
  const householdId = Utilities.getUuid().toUpperCase();
  appendRow(sheet, HOUSEHOLD_COLUMNS, {
    householdId: householdId,
    name: name,
    nameKey: nameKey,
    passSalt: salt,
    passHash: hashPasscode(body.passcode, salt),
    failedAttempts: 0,
    lockedUntil: 0,
    createdAt: Date.now(),
  });
  const session = createMember(householdId, body.displayName);
  return { householdId: householdId, householdName: name, memberId: session.memberId, deviceToken: session.token };
}

function joinHousehold(body) {
  if (failureCount('joinFails') >= GLOBAL_JOIN_FAILURE_LIMIT) fail('too many attempts, try again later');

  const nameKey = normalizeName(body.name).toLowerCase();
  const passcode = typeof body.passcode === 'string' ? body.passcode : '';
  const sheet = getTable(SHEET_HOUSEHOLDS, HOUSEHOLD_COLUMNS);
  const household = readRows(sheet, HOUSEHOLD_COLUMNS).filter(function (r) { return r.nameKey === nameKey; })[0];

  if (!household) {
    // Burn comparable CPU so an unknown name is not obviously faster than a wrong passcode.
    hashPasscode(passcode, 'decoy');
    recordFailure('joinFails', 900);
    fail(GENERIC_JOIN_ERROR);
  }
  if (Number(household.lockedUntil) > Date.now()) {
    fail('too many attempts, try again later');
  }

  if (!safeEqual(hashPasscode(passcode, household.passSalt), household.passHash)) {
    recordFailure('joinFails', 900);
    let failed = Number(household.failedAttempts) + 1;
    let lockedUntil = 0;
    if (failed >= MAX_FAILED_ATTEMPTS) {
      failed = 0;
      lockedUntil = Date.now() + LOCK_MINUTES * 60 * 1000;
    }
    updateRow(sheet, HOUSEHOLD_COLUMNS, household.rowIndex, { failedAttempts: failed, lockedUntil: lockedUntil });
    fail(GENERIC_JOIN_ERROR);
  }

  updateRow(sheet, HOUSEHOLD_COLUMNS, household.rowIndex, { failedAttempts: 0, lockedUntil: 0 });
  const session = createMember(household.householdId, body.displayName);
  return {
    householdId: household.householdId,
    householdName: household.name,
    memberId: session.memberId,
    deviceToken: session.token,
  };
}

// ---------- Members / sessions ----------

function createMember(householdId, displayName) {
  const token = randomToken() + randomToken();
  const memberId = Utilities.getUuid().toUpperCase();
  appendRow(getTable(SHEET_MEMBERS, MEMBER_COLUMNS), MEMBER_COLUMNS, {
    memberId: memberId,
    householdId: householdId,
    displayName: String(displayName || '').slice(0, 40),
    tokenHash: sha256Hex(token),
    createdAt: Date.now(),
    lastSeenAt: Date.now(),
    revokedAt: 0,
  });
  return { memberId: memberId, token: token };
}

/** Returns { householdId, memberId } for a valid token, or null. */
function authenticate(token) {
  if (typeof token !== 'string' || token === '') return null;
  if (LEGACY_SECRET && safeEqual(token, LEGACY_SECRET)) {
    const householdId = legacyHouseholdId();
    return householdId ? { householdId: householdId, memberId: null } : null;
  }
  if (token.length < 32) return null;

  const sheet = getTable(SHEET_MEMBERS, MEMBER_COLUMNS);
  const hash = sha256Hex(token);
  const member = readRows(sheet, MEMBER_COLUMNS).filter(function (r) {
    return safeEqual(r.tokenHash, hash) && Number(r.revokedAt) === 0;
  })[0];
  if (!member) return null;

  if (Date.now() - Number(member.lastSeenAt) > 3600 * 1000) {
    updateRow(sheet, MEMBER_COLUMNS, member.rowIndex, { lastSeenAt: Date.now() });
  }
  return { householdId: member.householdId, memberId: member.memberId };
}

function revokeMember(memberId) {
  const sheet = getTable(SHEET_MEMBERS, MEMBER_COLUMNS);
  const member = readRows(sheet, MEMBER_COLUMNS).filter(function (r) { return r.memberId === memberId; })[0];
  if (member) updateRow(sheet, MEMBER_COLUMNS, member.rowIndex, { revokedAt: Date.now() });
}

// ---------- Items (always scoped to one household) ----------

function listItems(householdId) {
  const values = getItemsSheet().getDataRange().getValues();
  if (values.length < 2) return [];
  return values.slice(1)
    .filter(function (row) { return row[0] && String(row[9]) === householdId; })
    .map(rowToItem);
}

function upsertItem(householdId, item) {
  if (!item || typeof item !== 'object' || !item.id || typeof item.id !== 'string') fail('invalid item');
  if (JSON.stringify(item).length > MAX_ITEM_JSON) fail('item too large');

  const sheet = getItemsSheet();
  const found = findItemRow(sheet, item.id);
  if (found && found.householdId !== householdId) fail('conflict');

  const row = ITEM_COLUMNS.map(function (col) {
    if (col === 'householdId') return householdId;
    const value = item[col];
    return value === undefined || value === null ? '' : value;
  });
  if (!found) {
    sheet.appendRow(row);
  } else {
    sheet.getRange(found.rowIndex, 1, 1, ITEM_COLUMNS.length).setValues([row]);
  }
}

function deleteItem(householdId, id) {
  const sheet = getItemsSheet();
  const found = findItemRow(sheet, String(id));
  if (found && found.householdId === householdId) sheet.deleteRow(found.rowIndex);
}

function findItemRow(sheet, id) {
  const numDataRows = sheet.getLastRow() - 1;
  if (numDataRows < 1) return null;
  const rows = sheet.getRange(2, 1, numDataRows, ITEM_COLUMNS.length).getValues();
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][0]) === id) return { rowIndex: i + 2, householdId: String(rows[i][9]) };
  }
  return null;
}

function rowToItem(row) {
  const item = {};
  ITEM_COLUMNS.slice(0, 9).forEach(function (col, i) { item[col] = row[i]; });
  // Sheets turns numeric-looking text into numbers; coerce back to what the clients expect.
  item.isChecked = (item.isChecked === true || item.isChecked === 'true' || item.isChecked === 'TRUE');
  item.customCadenceDays = Number(item.customCadenceDays) || 1;
  item.id = String(item.id);
  item.recommendedQuantity = String(item.recommendedQuantity);
  item.lastCheckedDate = item.lastCheckedDate ? String(item.lastCheckedDate) : null;
  item.updatedAt = String(item.updatedAt);
  return item;
}

// ---------- Setup and migration (run from the editor) ----------

function setupSheets() {
  getTable(SHEET_HOUSEHOLDS, HOUSEHOLD_COLUMNS);
  getTable(SHEET_MEMBERS, MEMBER_COLUMNS);
  const items = getItemsSheet();
  const header = items.getRange(1, 1, 1, Math.max(items.getLastColumn(), 1)).getValues()[0];
  if (header.indexOf('householdId') === -1) {
    items.getRange(1, ITEM_COLUMNS.length).setValue('householdId');
  }
}

/** Stamps every item row that has no householdId with the named household. */
function adoptLegacyRows(householdName) {
  const nameKey = normalizeName(householdName).toLowerCase();
  const households = readRows(getTable(SHEET_HOUSEHOLDS, HOUSEHOLD_COLUMNS), HOUSEHOLD_COLUMNS);
  const household = households.filter(function (r) { return r.nameKey === nameKey; })[0];
  if (!household) throw new Error('No household named "' + householdName + '". Create it in the app first.');

  const sheet = getItemsSheet();
  const last = sheet.getLastRow();
  let stamped = 0;
  if (last >= 2) {
    const range = sheet.getRange(2, ITEM_COLUMNS.length, last - 1, 1);
    const values = range.getValues().map(function (r) {
      if (r[0] === '') {
        stamped++;
        return [household.householdId];
      }
      return r;
    });
    range.setValues(values);
  }
  PropertiesService.getScriptProperties().setProperty('LEGACY_HOUSEHOLD_ID', household.householdId);
  Logger.log('Stamped ' + stamped + ' rows into "' + household.name + '".');
}

function adoptMyRows() {
  adoptLegacyRows('CHANGE ME TO YOUR HOUSEHOLD NAME');
}

function legacyHouseholdId() {
  return PropertiesService.getScriptProperties().getProperty('LEGACY_HOUSEHOLD_ID');
}

// ---------- Table helpers ----------

function getItemsSheet() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ITEMS);
  if (!sheet) throw new Error('Sheet tab "' + SHEET_ITEMS + '" not found.');
  return sheet;
}

/** Households and Members are plain-text tables so Sheets never reinterprets hashes or ids. */
function getTable(name, columns) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.getRange(1, 1, 1, columns.length).setValues([columns]);
    sheet.getRange(2, 1, sheet.getMaxRows() - 1, columns.length).setNumberFormat('@');
  }
  return sheet;
}

function readRows(sheet, columns) {
  const last = sheet.getLastRow();
  if (last < 2) return [];
  return sheet.getRange(2, 1, last - 1, columns.length).getValues().map(function (row, i) {
    const obj = { rowIndex: i + 2 };
    columns.forEach(function (col, c) { obj[col] = String(row[c]); });
    return obj;
  });
}

function appendRow(sheet, columns, obj) {
  const row = sheet.getLastRow() + 1;
  sheet.getRange(row, 1, 1, columns.length).setValues([columns.map(function (c) { return String(obj[c]); })]);
}

function updateRow(sheet, columns, rowIndex, changes) {
  Object.keys(changes).forEach(function (key) {
    sheet.getRange(rowIndex, columns.indexOf(key) + 1).setValue(String(changes[key]));
  });
}

// ---------- Crypto and throttling ----------

function toHex(bytes) {
  return bytes.map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}

function sha256Hex(text) {
  return toHex(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8));
}

/** Salted, iterated SHA-256 (Apps Script has no bcrypt/PBKDF2). Lockouts are the real brute-force defence. */
function hashPasscode(passcode, salt) {
  const saltBytes = Utilities.newBlob(String(salt)).getBytes();
  let digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    saltBytes.concat(Utilities.newBlob(passcode).getBytes()),
  );
  for (let i = 0; i < HASH_ROUNDS; i++) {
    digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, digest.concat(saltBytes));
  }
  return toHex(digest);
}

function randomToken() {
  return Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
}

function safeEqual(a, b) {
  a = String(a);
  b = String(b);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Fails once `limit` events were seen in the cache window, otherwise counts this one. */
function throttle(key, limit, ttlSeconds, message) {
  if (failureCount(key) >= limit) fail(message);
  recordFailure(key, ttlSeconds);
}

function failureCount(key) {
  return Number(CacheService.getScriptCache().get(key)) || 0;
}

function recordFailure(key, ttlSeconds) {
  CacheService.getScriptCache().put(key, String(failureCount(key) + 1), ttlSeconds);
}

function fail(message) {
  const error = new Error(message);
  error.userMessage = message;
  throw error;
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
