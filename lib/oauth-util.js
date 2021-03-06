var url = require('url');
var querystring = require('querystring');
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

function isTimestampAroundNow(timestamp, thresholdInSeconds) {
  var now = Math.floor(Date.now() / 1000);
  return Math.abs(timestamp - now) < thresholdInSeconds;
}

function validNonceAndTimestampMiddleware(options) {
  if (typeof(options) == 'function')
    options = {checkAndRemember: options};

  var checkAndRemember = options.checkAndRemember;
  var threshold = options.timestampThreshold;

  return function(req, res, next) {
    var oauth = req.oauth;

    if (!oauth) throw new Error('req.oauth does not exist');

    var timestamp = parseInt(oauth.oauth_timestamp);

    if (isNaN(timestamp) || timestamp <= 0)
      return res.send(401, 'invalid timestamp');

    if (threshold && !isTimestampAroundNow(timestamp, threshold))
      return res.send(401, 'timestamp is too old or too new');

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

function sendFormURLEncoded(res, params) {
  return res
    .type('application/x-www-form-urlencoded')
    .send(querystring.stringify(params));
}

function hmacSignedMiddleware(options) {
  var getSecrets = options.getSecrets;
  var baseURL = options.baseURL;
  var isInitialRequest = options.isInitialRequest;

  return function(req, res, next) {
    var oauth = req.oauth;

    if (!oauth) throw new Error('req.oauth does not exist');
    if (oauth.oauth_signature_method != 'HMAC-SHA1')
      throw new Error('unsupporterd signature method');
    if (isInitialRequest && oauth.oauth_token)
      throw new Error('oauth_token is present on initial request');
    if (!isInitialRequest && !oauth.oauth_token)
      throw new Error('oauth_token not present on non-initial request');

    var absoluteURL = url.resolve(baseURL, req.path);

    getSecrets(
      req,
      oauth.oauth_consumer_key,
      isInitialRequest ? undefined : oauth.oauth_token,
      function(err, consumerSecret, oauthTokenSecret) {
        if (err) return next(err);
        if (!consumerSecret)
          return res.send(401, 'invalid consumer key');
        if (isInitialRequest) {
          oauthTokenSecret = undefined;
        } else if (!oauthTokenSecret) {
          return res.send(401, 'invalid oauth token');
        }
        var isUrlEncoded = (req.get('content-type') == 
                            'application/x-www-form-urlencoded');
        var params = _.extend(_.omit(oauth, 'oauth_signature'),
                              req.query,
                              isUrlEncoded && req.body ? req.body : {});

        var signature = hmacsign(req.method, absoluteURL, params,
                                 consumerSecret, oauthTokenSecret);
        if (signature != oauth.oauth_signature)
          return res.send(401, 'invalid signature');
        next();
      }
    );
  };
}

function callbackURL(baseURL, token, verifier) {
  var parts = url.parse(baseURL, true);

  if (!token) throw new Error('token required');
  if (!verifier) throw new Error('verifier required');

  delete parts.search;
  parts.query.oauth_token = token;
  parts.query.oauth_verifier = verifier;

  return url.format(parts);
}

exports.decodeAuthorizationHeader = decodeAuthorizationHeader;
exports.notBadOAuthRequestMiddleware = notBadOAuthRequestMiddleware;
exports.validNonceAndTimestampMiddleware = validNonceAndTimestampMiddleware;
exports.isTimestampAroundNow = isTimestampAroundNow;
exports.hmacSignedMiddleware = hmacSignedMiddleware;
exports.sendFormURLEncoded = sendFormURLEncoded;
exports.callbackURL = callbackURL;
exports.VALIDATORS = VALIDATORS;
