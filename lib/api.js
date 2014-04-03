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
    Application.findOne({
      apiKey: req.oauth.oauth_consumer_key
    }, function(err, application) {
      if (err) return next(err);
      if (!application) return next(new Error('application should exist'));
      var reqToken = new Tokens.RequestToken({
        callbackURL: req.oauth.oauth_callback,
        app: application
      });
      reqToken.save(function(err) {
        if (err) return next(err);
        return oauthUtil.sendFormURLEncoded(res, {
          oauth_token: reqToken.token,
          oauth_token_secret: reqToken.tokenSecret,
          oauth_callback_confirmed: 'true'
        });
      });
    });
  });

  app.namedRoutes.add('/api/oauth/access_token', 'oauth:access_token');
  app.all('/api/oauth/access_token', function(req, res, next) {
    return next(501);
  });
};
