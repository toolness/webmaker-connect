var AUTH_HEADER_RE = /^OAuth(.+)/i;
var AUTH_HEADER_PARAM_RE = /^([A-Za-z0-9\-._~%]+)="([A-Za-z0-9\-._~%]*)"$/;

function safePercentDecode(val) {
  try { return decodeURIComponent(val); } catch (e) { return null; }
}

function normalizevalidationCriteria(validationCriteria) {
  var result = {};

  Object.keys(validationCriteria).forEach(function(name) {
    if (typeof(validationCriteria[name]) == 'boolean') {
      result[name] = {required: validationCriteria[name]};
    } else if (validationCriteria[name] instanceof RegExp) {
      result[name] = {
        required: true,
        regexp: validationCriteria[name]
      };
    } else {
      if (typeof(validationCriteria.required) == 'boolean')
        throw new Error('invalid validation info for ' + name);
      result[name] = validationCriteria[name];
    }
  });
  return result;
}

// http://tools.ietf.org/html/rfc5849#section-3.5.1
function decodeAuthorizationHeader(header, validationCriteria) {
  var result = {};
  var headerMatch = header.match(AUTH_HEADER_RE);

  if (!headerMatch) return null;
  if (headerMatch[1].split(',').some(function(param) {
    var match  = param.trim().match(AUTH_HEADER_PARAM_RE);
    if (!match) return true;
    var name = safePercentDecode(match[1]);
    var value = safePercentDecode(match[2]);

    if (name === null || value === null) return true;

    // The OAuth spec recommends we reject duplicate values, so
    // we'll return an empty object when this happens.
    if (name) {
      if (name in result) return true;
      if (validationCriteria)
        if (!(name in validationCriteria)) return true;

      // TODO: What if 'name' is something gross like __proto__?
      result[name] = value;
    }
  })) return null;

  if (validationCriteria) {
    validationCriteria = normalizevalidationCriteria(validationCriteria);
    if (Object.keys(validationCriteria).some(function(name) {
      var info = validationCriteria[name];
      if (info.required && !(name in result)) return true;
      if (!info.required && !(name in result)) return false;
      if (info.regexp && !info.regexp.test(result[name])) return true;
    })) return null;
  }

  return result;
}

function isAuthorizationHeaderValid(header) {
  var info = decodeAuthorizationHeader(header, {
    oauth_consumer_key: true,
    oauth_signature_method: /^HMAC-SHA1$/,
    oauth_signature: true,
    oauth_timestamp: /^([0-9]+)$/,
    oauth_version: {
      required: false,
      regexp: /^1\.0a?$/i
    },
    oauth_callback: /^https?:\/\//
  });
}

exports.decodeAuthorizationHeader = decodeAuthorizationHeader;
