var PREPARATION_PREFIX_ = /^(?:blended|pureed|puree|mashed|steamed|boiled|roasted|cooked|raw)\s+/i;
var SINGULAR_EXCEPTIONS_ = { bass: true, cress: true, asparagus: true };

function normalizeCandidates_(values) {
  var seen = {};
  var normalized = [];
  values.forEach(function(value) {
    var item = normalizeCandidate_(value);
    if (item && !seen[item.key]) { seen[item.key] = true; normalized.push(item); }
  });
  return normalized;
}

function normalizeCandidate_(value) {
  if (typeof value !== 'string') return null;
  var key = value.trim().toLowerCase().replace(PREPARATION_PREFIX_, '');
  key = key.replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '').replace(/\s+/g, ' ');
  if (!key || key.length > 80 || !/[a-z0-9]/.test(key)) return null;
  key = singularize_(key);
  return { key: key, name: titleCase_(key) };
}

function singularize_(key) {
  if (key.length < 4 || SINGULAR_EXCEPTIONS_[key] || /(ss|us|is)$/.test(key)) return key;
  if (/ies$/.test(key)) return key.slice(0, -3) + 'y';
  if ((key === 'tomatoes' || key === 'potatoes') && /oes$/.test(key)) return key.slice(0, -2);
  return key.length > 3 && /s$/.test(key) ? key.slice(0, -1) : key;
}

function titleCase_(value) { return value.replace(/\b[a-z0-9]/g, function(letter) { return letter.toUpperCase(); }); }
