var INGREDIENTS_TABLE_ = 'Ingredients';

function listIngredients_() {
  var records = [];
  var offset = null;
  do {
    var suffix = offset ? '?offset=' + encodeURIComponent(offset) : '';
    var page = airtableRequest_('get', '/' + encodeURIComponent(INGREDIENTS_TABLE_) + suffix);
    records = records.concat(page.records || []);
    offset = page.offset || null;
  } while (offset);
  return records.map(ingredientFromRecord_);
}

function createIngredients_(ingredients) {
  chunk_(ingredients, 10).forEach(function(batch) {
    airtableRequest_('post', '/' + encodeURIComponent(INGREDIENTS_TABLE_), { records: batch.map(function(ingredient) { return { fields: ingredientFields_(ingredient) }; }) });
  });
}

function updateIngredients_(ingredients) {
  chunk_(ingredients, 10).forEach(function(batch) {
    airtableRequest_('patch', '/' + encodeURIComponent(INGREDIENTS_TABLE_), { records: batch.map(function(ingredient) { return { id: ingredient.id, fields: ingredientFields_(ingredient) }; }) });
  });
}

function ingredientFromRecord_(record) {
  var fields = record.fields || {};
  return { id: record.id, name: String(fields['Name'] || ''), key: String(fields['Key'] || ''), firstExposureDate: String(fields['First Exposure Date'] || ''), notes: String(fields['Notes'] || '') };
}

function ingredientFields_(ingredient) { return { 'Name': ingredient.name, 'Key': ingredient.key, 'First Exposure Date': ingredient.firstExposureDate }; }

function airtableRequest_(method, path, payload) {
  var config = getConfig_();
  if (!config.token || !config.baseId) throw new ApiError_('CONFIGURATION_ERROR', 'The Airtable connection has not been configured yet.');
  var options = { method: method, headers: { Authorization: 'Bearer ' + config.token }, muteHttpExceptions: true };
  if (payload) { options.contentType = 'application/json'; options.payload = JSON.stringify(payload); }
  var response;
  try { response = UrlFetchApp.fetch('https://api.airtable.com/v0/' + encodeURIComponent(config.baseId) + path, options); } catch (error) { throw new ApiError_('AIRTABLE_ERROR', 'Airtable could not be reached. Please retry.'); }
  var status = response.getResponseCode();
  if (status < 200 || status >= 300) {
    console.log('Airtable request failed with status ' + status);
    throw new ApiError_('AIRTABLE_ERROR', 'Airtable could not complete that request. Please retry.');
  }
  try { return JSON.parse(response.getContentText()); } catch (error) { throw new ApiError_('AIRTABLE_ERROR', 'Airtable returned an unreadable response.'); }
}

function chunk_(items, size) { var output = []; for (var index = 0; index < items.length; index += size) output.push(items.slice(index, index + size)); return output; }
