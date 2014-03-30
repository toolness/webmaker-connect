var AUTH_HEADER_RE = /^OAuth(.+)/i;
var AUTH_HEADER_PARAM_RE = /^([A-Za-z0-9\-._~%]+)="([A-Za-z0-9\-._~%]*)"$/;

function safePercentDecode(val) {
  try { return decodeURIComponent(val); } catch (e) { return ''; }
}

// http://tools.ietf.org/html/rfc5849#section-3.5.1
function decodeAuthorizationHeader(header) {
  var result = {};
  var headerMatch = header.match(AUTH_HEADER_RE);

  if (!headerMatch) return result;
  headerMatch[1].split(',').forEach(function(param) {
    var match  = param.trim().match(AUTH_HEADER_PARAM_RE);
    if (!match) return;
    var name = safePercentDecode(match[1]);
    var value = safePercentDecode(match[2]);
    if (name) result[name] = value;
  });

  return result;
}

exports.decodeAuthorizationHeader = decodeAuthorizationHeader;
