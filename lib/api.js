var oauthUtil = require('./oauth-util');
var Application = require('./model/application');
var Tokens = require('./model/tokens');

var VALIDATORS = oauthUtil.VALIDATORS;

exports.express = function(app, options) {
  if (app.apiPrefix != '/api/')
    throw new Error('expected apiPrefix to be /api/');

  app.namedRoutes.add('/api/oauth/request_token', 'oauth:request_token');
  app.all('/api/oauth/request_token', [
    oauthUtil.notBadOAuthRequestMiddleware(VALIDATORS.REQUEST_TOKEN),
    oauthUtil.hmacSignedMiddleware({
      getSecrets: function(consumerKey, oauthToken, cb) {
        Application.findOne({
          apiKey: consumerKey
        }, function(err, application) {
          if (err) return cb(err);
          if (!application) return cb(null);
          cb(null, application.apiSecret);
        });
      },
      baseURL: options.origin,
      isInitialRequest: true
    }),
    oauthUtil.validNonceAndTimestampMiddleware(function(options, cb) {
      Tokens.Nonce.findOne(options, function(err, nonce) {
        if (err) return cb(err);
        if (!nonce) {
          nonce = new Tokens.Nonce(options);
          return nonce.save(function(err) {
            if (err) return cb(err);
            cb(null, true);
          });
        }
        return cb(null, false);
      });
    })
  ], function(req, res, next) {
    return next(501);
  });

  app.namedRoutes.add('/api/oauth/access_token', 'oauth:access_token');
  app.all('/api/oauth/access_token', function(req, res, next) {
    return next(501);
  });
};
