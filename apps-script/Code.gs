function doGet(event) {
  if ((event.parameter || {}).action !== 'health') return jsonResponse_(errorBody_('INVALID_ACTION', 'Use the health action.'));
  return jsonResponse_({ ok: true, service: 'magnus-food-tracker', configured: configurationStatus_() });
}

function doPost(event) {
  try { return jsonResponse_(routePost_(parseBody_(event))); }
  catch (error) {
    var safe = error instanceof ApiError_ ? error : new ApiError_('AIRTABLE_ERROR', 'The service could not complete that request.');
    if (!(error instanceof ApiError_)) console.log('Unhandled server error: ' + String(error));
    return jsonResponse_(errorBody_(safe.code, safe.message));
  }
}

function routePost_(body) {
  if (!body || typeof body.action !== 'string') throw new ApiError_('INVALID_ACTION', 'Choose a valid action.');
  if (body.action !== 'snapshot' && body.action !== 'saveIngredients' && body.action !== 'verifyTestTarget') throw new ApiError_('INVALID_ACTION', 'Choose a valid action.');
  requirePasscode_(body.passcode);
  if (body.action === 'snapshot') return snapshot_();
  if (body.action === 'verifyTestTarget') return verifyTestTarget_(body.expectedBaseId);
  return saveIngredients_(body);
}

function snapshot_() {
  var ingredients = listIngredients_().filter(function(item) { return item.key && item.name && isDateOnly_(item.firstExposureDate); });
  return { summary: { totalIngredients: ingredients.length, goal: 100 }, ingredients: ingredients };
}

function verifyTestTarget_(expectedBaseId) {
  if (typeof expectedBaseId !== 'string' || !expectedBaseId || expectedBaseId !== getConfig_().baseId) throw new ApiError_('CONFIGURATION_ERROR', 'The proxy is not configured for the approved disposable test base.');
  return { ok: true, verified: true };
}

function saveIngredients_(body) {
  if (!isDateOnly_(body.exposureDate)) throw new ApiError_('INVALID_DATE', 'Choose a valid date.');
  if (!Array.isArray(body.ingredients) || body.ingredients.length < 1 || body.ingredients.length > 20 || body.ingredients.some(function(item) { return typeof item !== 'string' || item.length > 200; })) throw new ApiError_('INVALID_INGREDIENTS', 'Enter between 1 and 20 ingredients.');
  var normalized = normalizeCandidates_(body.ingredients);
  if (!normalized.length) throw new ApiError_('INVALID_INGREDIENTS', 'Enter at least one usable ingredient.');
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) throw new ApiError_('CONFLICT_RETRY', 'Another save is in progress. Please retry.');
  try {
    var existing = listIngredients_();
    var byKey = {};
    existing.forEach(function(item) { byKey[item.key] = item; });
    var created = [], alreadyKnown = [], dateCorrected = [];
    normalized.forEach(function(candidate) {
      var known = byKey[candidate.key];
      if (!known) {
        var fresh = { name: candidate.name, key: candidate.key, firstExposureDate: body.exposureDate, notes: '' };
        created.push(fresh); byKey[fresh.key] = fresh;
      } else if (body.exposureDate < known.firstExposureDate) {
        known.firstExposureDate = body.exposureDate; dateCorrected.push(known);
      } else alreadyKnown.push(known);
    });
    if (created.length) createIngredients_(created);
    if (dateCorrected.length) updateIngredients_(dateCorrected);
    return { summary: { totalIngredients: existing.length + created.length, goal: 100 }, created: created, alreadyKnown: alreadyKnown, dateCorrected: dateCorrected, allIngredientKeys: normalized.map(function(item) { return item.key; }) };
  } finally { lock.releaseLock(); }
}

function parseBody_(event) {
  try { return JSON.parse(event.postData && event.postData.contents ? event.postData.contents : ''); }
  catch (error) { throw new ApiError_('INVALID_ACTION', 'Send a JSON request body.'); }
}

function isDateOnly_(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  var parts = value.split('-').map(Number);
  var date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  return date.getUTCFullYear() === parts[0] && date.getUTCMonth() === parts[1] - 1 && date.getUTCDate() === parts[2];
}

function ApiError_(code, message) { this.code = code; this.message = message; }
ApiError_.prototype = Object.create(Error.prototype);
ApiError_.prototype.constructor = ApiError_;
function errorBody_(code, message) { return { ok: false, code: code, message: message }; }
function jsonResponse_(body) { return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON); }
