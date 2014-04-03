var url = require('url');
var _ = require('underscore');
var hmacsign = require('oauth-sign').hmacsign;

var AUTH_HEADER_RE = /^OAuth(.+)/i;
var AUTH_HEADER_PARAM_RE = /^([A-Za-z0-9\-._~%]+)="([A-Za-z0-9\-._~%]*)"$/;

var VALIDATORS = {};

VALIDATORS.BASE = {
  oauth_consumer_key: /.+/,
  oauth_signature_method: /^HMAC-SHA1$/,
  oauth_signature: /.+/,
  oauth_timestamp: /^([0-9]+)$/,
  oauth_nonce: /.+/,
  oauth_version: {
    required: false,
    regexp: /^1\.0a?$/i
  }
};

VALIDATORS.REQUEST_TOKEN = _.defaults({
  oauth_callback: /^https?:\/\//
}, VALIDATORS.BASE);

VALIDATORS.ACCESS_TOKEN = _.defaults({
  // This will be the request token, not the access token.
  oauth_token: /.+/,
  oauth_verifier: /.+/
}, VALIDATORS.BASE);

VALIDATORS.AUTHORIZED = _.defaults({
  // This will be the access token, not the request token.
  oauth_token: /.+/,
}, VALIDATORS.BASE);

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

function notBadOAuthRequestMiddleware(validationCriteria) {
  return function(req, res, next) {
    var header = req.headers['authorization'];
    if (!header)
      return res.send(400, 'missing authorization header');

    var headerInfo = decodeAuthorizationHeader(header, validationCriteria);
    if (!headerInfo)
      return res.send(400, 'invalid or malformed authorization header');

    req.oauth = headerInfo;
    next();
  };
}

function validNonceAndTimestampMiddleware(checkAndRemember) {
  return function(req, res, next) {
    var oauth = req.oauth;

    if (!oauth) throw new Error('req.oauth does not exist');

    var timestamp = parseInt(oauth.oauth_timestamp);

    if (isNaN(timestamp) || timestamp <= 0)
      return res.send(401, 'invalid timestamp');

    checkAndRemember({
      consumerKey: oauth.oauth_consumer_key,
      nonce: oauth.oauth_nonce,
      timestamp: timestamp
    }, function(err, isValid) {
      if (err) return next(err);
      if (!isValid)
        return res.send(401, 'invalid nonce or timestamp');
      next();
    });
  };
}

function signedOAuthRequestMiddleware(options) {
  var getSecrets = options.getSecrets;
  var baseURL = options.baseURL;

  return function(req, res, next) {
    var oauth = req.oauth;

    if (!oauth) throw new Error('req.oauth does not exist');
    if (oauth.oauth_signature_method != 'HMAC-SHA1')
      throw new Error('unsupporterd signature method');

    var isRequestTokenReq = 'oauth_callback' in oauth;
    var isAccessTokenReq = 'oauth_verifier' in oauth;
    var isUsingAccessToken = !(isRequestTokenReq || isAccessTokenReq);
    var accessToken = isUsingAccessToken ? oauth.oauth_token : null;
    var absoluteURL = url.resolve(baseURL, req.path);

    getSecrets({
      consumerKey: oauth.oauth_consumer_key,
      accessToken: accessToken
    }, function(err, secrets) {
      if (err) return next(err);
      if (!secrets || !secrets.consumer ||
          (isUsingAccessToken && !secrets.accessToken))
        return res.send(401, 'invalid consumer key or access token');
      var params = _.extend(_.omit(oauth, 'oauth_signature'),
                            req.query);
      var signature = hmacsign(req.method, absoluteURL, params,
                               secrets.consumer, secrets.accessToken);
      if (signature != oauth.oauth_signature)
        return res.send(401, 'invalid signature');
      next();
    });
  };
}

exports.decodeAuthorizationHeader = decodeAuthorizationHeader;
exports.notBadOAuthRequestMiddleware = notBadOAuthRequestMiddleware;
exports.validNonceAndTimestampMiddleware = validNonceAndTimestampMiddleware;
exports.signedOAuthRequestMiddleware = signedOAuthRequestMiddleware;
exports.VALIDATORS = VALIDATORS;
