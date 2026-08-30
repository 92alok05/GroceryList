/**
 * Google Apps Script "server" for the Grocery List app.
 *
 * SETUP:
 * 1. Create a new Google Sheet. Rename the first tab to exactly: GroceryItems
 * 2. In row 1, add these exact column headers (one per column, A through I):
 *      id | name | recommendedStore | recommendedQuantity | cadence | customCadenceDays | isChecked | lastCheckedDate | updatedAt
 * 3. Open Extensions > Apps Script from the Sheet's menu.
 * 4. Delete any starter code and paste this entire file in.
 * 5. Change the SECRET constant below to a private value only you and your
 *    family will use (treat it like a password — it's the only thing
 *    preventing strangers from reading/writing your sheet if they guess the URL).
 * 6. Click Deploy > New deployment.
 *    - Select type: "Web app"
 *    - Description: anything, e.g. "Grocery List Sync v1"
 *    - Execute as: Me
 *    - Who has access: Anyone (this does NOT mean anyone can read your sheet —
 *      only requests that include the correct token/SECRET are honored)
 *    - Click Deploy, authorize the script when prompted.
 * 7. Copy the "Web app URL" it gives you (ends in /exec) — this is the
 *    "Web App URL" you'll paste into the Grocery List app's Settings tab,
 *    along with the SECRET you chose above.
 * 8. Every family member enters the SAME Web App URL and SAME secret in their
 *    own copy of the app's Settings tab.
 *
 * NOTE: If you edit this script later, you must create a NEW deployment
 * version (Deploy > Manage deployments > Edit > New version) for changes to
 * take effect on the existing Web App URL.
 */

const SHEET_NAME = 'GroceryItems';
const SECRET = 'manalok1208';

const COLUMNS = [
  'id',
  'name',
  'recommendedStore',
  'recommendedQuantity',
  'cadence',
  'customCadenceDays',
  'isChecked',
  'lastCheckedDate',
  'updatedAt',
];

function doGet(e) {
  try {
    const params = e.parameter || {};
    if (params.token !== SECRET) {
      return jsonResponse({ error: 'unauthorized' });
    }
    if (params.action === 'list') {
      return jsonResponse({ items: listItems() });
    }
    return jsonResponse({ error: 'unknown action' });
  } catch (err) {
    return jsonResponse({ error: 'server exception: ' + err.message });
  }
}

function doPost(e) {
  try {
    let body;
    try {
      body = JSON.parse(e.postData.contents);
    } catch (err) {
      return jsonResponse({ error: 'invalid JSON body' });
    }

    if (body.token !== SECRET) {
      return jsonResponse({ error: 'unauthorized' });
    }

    if (body.action === 'upsert') {
      upsertItem(body.item);
      return jsonResponse({ success: true });
    }
    if (body.action === 'delete') {
      deleteItem(body.id);
      return jsonResponse({ success: true });
    }
    return jsonResponse({ error: 'unknown action' });
  } catch (err) {
    return jsonResponse({ error: 'server exception: ' + err.message });
  }
}

function listItems() {
  const sheet = getSheet();
  const range = sheet.getDataRange().getValues();
  if (range.length < 2) return [];
  return range.slice(1)
    .filter(function (row) { return row[0]; })
    .map(rowToItem);
}

function upsertItem(item) {
  const sheet = getSheet();
  const rowIndex = findRowIndexById(sheet, item.id);
  const row = COLUMNS.map(function (col) {
    const value = item[col];
    return value === undefined || value === null ? '' : value;
  });
  if (rowIndex === -1) {
    sheet.appendRow(row);
  } else {
    sheet.getRange(rowIndex, 1, 1, COLUMNS.length).setValues([row]);
  }
}

function deleteItem(id) {
  const sheet = getSheet();
  const rowIndex = findRowIndexById(sheet, id);
  if (rowIndex !== -1) {
    sheet.deleteRow(rowIndex);
  }
}

function findRowIndexById(sheet, id) {
  const numDataRows = sheet.getLastRow() - 1;
  if (numDataRows < 1) return -1; // Sheet has only the header row (or is empty) — nothing to search.
  const ids = sheet.getRange(2, 1, numDataRows, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (ids[i][0] === id) {
      return i + 2; // +2: 1-indexed, plus header row
    }
  }
  return -1;
}

function rowToItem(row) {
  const item = {};
  COLUMNS.forEach(function (col, i) {
    item[col] = row[i];
  });
  // Normalize types coming back from Sheets (booleans/numbers may be stored as strings).
  item.isChecked = (item.isChecked === true || item.isChecked === 'true' || item.isChecked === 'TRUE');
  item.customCadenceDays = Number(item.customCadenceDays) || 1;
  item.id = String(item.id);
  // Google Sheets auto-detects numeric-looking text (e.g. "1", "2") and stores it
  // as a real number, so getValues() can return a JS number here even though the
  // app's model expects a string. Force it back to a string so JSONDecoder (which
  // is strict about types) doesn't fail to decode the entire list.
  item.recommendedQuantity = String(item.recommendedQuantity);
  item.lastCheckedDate = item.lastCheckedDate ? String(item.lastCheckedDate) : null;
  item.updatedAt = String(item.updatedAt);
  return item;
}

function getSheet() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) {
    throw new Error('Sheet tab "' + SHEET_NAME + '" not found. Rename a tab to match exactly.');
  }
  return sheet;
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
