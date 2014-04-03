var AUTH_HEADER_RE = /^OAuth(.+)/i;
var AUTH_HEADER_PARAM_RE = /^([A-Za-z0-9\-._~%]+)="([A-Za-z0-9\-._~%]*)"$/;

function safePercentDecode(val) {
  try { return decodeURIComponent(val); } catch (e) { return null; }
}

// http://tools.ietf.org/html/rfc5849#section-3.5.1
function decodeAuthorizationHeader(header, paramInfo) {
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
      if (paramInfo)
        if (!(name in paramInfo)) return true;

      // TODO: What if 'name' is something gross like __proto__?
      result[name] = value;
    }
  })) return null;

  if (paramInfo && Object.keys(paramInfo).some(function(name) {
    var isRequired = paramInfo[name];
    if (isRequired && (!(name in result))) return true;
  })) return null;

  return result;
}

exports.decodeAuthorizationHeader = decodeAuthorizationHeader;
