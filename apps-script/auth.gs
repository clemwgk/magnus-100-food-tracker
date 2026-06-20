var PASSCODE_MAX_FAILURES_ = 5;
var PASSCODE_THROTTLE_SECONDS_ = 300;

function getConfig_() {
  var properties = PropertiesService.getScriptProperties();
  return {
    token: properties.getProperty('AIRTABLE_TOKEN'),
    baseId: properties.getProperty('AIRTABLE_BASE_ID'),
    passcodeHash: properties.getProperty('FAMILY_PASSCODE_HASH'),
    passcodeSalt: properties.getProperty('FAMILY_PASSCODE_SALT')
  };
}

function configurationStatus_() {
  var config = getConfig_();
  return { airtableToken: !!config.token, airtableBaseId: !!config.baseId, familyPasscode: !!(config.passcodeHash && config.passcodeSalt) };
}

function requirePasscode_(passcode) {
  var config = getConfig_();
  if (!config.passcodeHash || !config.passcodeSalt) throw new ApiError_('CONFIGURATION_ERROR', 'The service has not been configured yet.');
  var attemptKey = 'magnus-passcode-' + sha256Hex_(typeof passcode === 'string' ? passcode : 'invalid').slice(0, 20);
  var cache = CacheService.getScriptCache();
  if (Number(cache.get(attemptKey) || '0') >= PASSCODE_MAX_FAILURES_) throw new ApiError_('PASSCODE_THROTTLED', 'Too many attempts. Please wait a few minutes and try again.');
  var candidate = sha256Hex_(config.passcodeSalt + ':' + (typeof passcode === 'string' ? passcode : ''));
  if (!constantTimeEqual_(candidate, config.passcodeHash)) {
    var failures = Number(cache.get(attemptKey) || '0') + 1;
    cache.put(attemptKey, String(failures), PASSCODE_THROTTLE_SECONDS_);
    throw new ApiError_('INVALID_PASSCODE', 'That family passcode is not correct.');
  }
}

function sha256Hex_(value) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value, Utilities.Charset.UTF_8);
  return bytes.map(function(byte) { var value = byte < 0 ? byte + 256 : byte; return ('0' + value.toString(16)).slice(-2); }).join('');
}

function constantTimeEqual_(left, right) {
  if (typeof right !== 'string' || left.length !== right.length) return false;
  var mismatch = 0;
  for (var index = 0; index < left.length; index += 1) mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return mismatch === 0;
}
