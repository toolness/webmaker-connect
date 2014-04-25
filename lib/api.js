var _ = require('underscore');
var fs = require('fs');
var nunjucks = require('nunjucks');

var paths = require('./paths');
var oauthUtil = require('./oauth-util');
var Application = require('./model/application');
var publicUserInfo = require('./model/user').publicInfo;
var Tokens = require('./model/tokens');

var VALIDATORS = oauthUtil.VALIDATORS;
var TIMESTAMP_THRESHOLD = Tokens.NONCE_EXPIRATION / 2;
var NOTIFY_TEMPLATE = fs.readFileSync(paths.templateDir +
                                      '/notification-email.txt', 'utf8');

var replayAttackBlocker = oauthUtil.validNonceAndTimestampMiddleware({
  checkAndRemember: function(options, cb) {
    // TODO: Consider recording the most recent timestamp on the
    // access token model and ensure the timestamp is newer than that.
    // This used to be part of the OAuth specification but was removed.
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
  },
  timestampThreshold: TIMESTAMP_THRESHOLD
});

function oauthTokenMiddleware(origin, model) {
  return oauthUtil.hmacSignedMiddleware({
    getSecrets: function(req, consumerKey, oauthToken, cb) {
      if (!oauthToken) return cb(new Error('expected oauth token'));
      model.findOne({
        token: oauthToken
      }).populate('application').exec(function(err, token) {
        if (err) return cb(err);
        if (!token) return cb(null);
        req.oauthToken = token;
        cb(null, token.application.apiSecret, token.tokenSecret);
      });
    },
    baseURL: origin,
    isInitialRequest: false
  });
}

exports.express = function(app, options) {
  var emailBackend = options.emailBackend;

  if (app.apiPrefix != '/api/')
    throw new Error('expected apiPrefix to be /api/');

  app.namedRoutes.add('/api/oauth/request_token', 'oauth:request_token');
  app.all('/api/oauth/request_token', [
    oauthUtil.notBadOAuthRequestMiddleware(VALIDATORS.REQUEST_TOKEN),
    oauthUtil.hmacSignedMiddleware({
      getSecrets: function(req, consumerKey, oauthToken, cb) {
        Application.findOne({
          apiKey: consumerKey
        }, function(err, application) {
          if (err) return cb(err);
          if (!application) return cb(null);
          req.application = application;
          cb(null, application.apiSecret);
        });
      },
      baseURL: options.origin,
      isInitialRequest: true
    }),
    replayAttackBlocker
  ], function(req, res, next) {
    var reqToken = new Tokens.RequestToken({
      callbackURL: req.oauth.oauth_callback,
      application: req.application._id
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

  app.namedRoutes.add('/api/oauth/access_token', 'oauth:access_token');
  app.all('/api/oauth/access_token', [
    oauthUtil.notBadOAuthRequestMiddleware(VALIDATORS.ACCESS_TOKEN),
    oauthTokenMiddleware(options.origin, Tokens.RequestToken),
    replayAttackBlocker
  ], function(req, res, next) {
    var requestToken = req.oauthToken;

    if (req.oauth.oauth_verifier != requestToken.verifier)
      return res.send(400, 'invalid verifier');

    Tokens.AccessToken.fromRequestToken(requestToken, function(err, tok) {
      if (err) return next(err);

      return oauthUtil.sendFormURLEncoded(res, _.extend({
        oauth_token: tok.token,
        oauth_token_secret: tok.tokenSecret,
      }, publicUserInfo(tok.user)));
    });
  });

  app.namedRoutes.add('/api/account/settings.json', 'api:account:settings');
  app.get('/api/account/settings.json', [
    oauthUtil.notBadOAuthRequestMiddleware(VALIDATORS.AUTHORIZED),
    oauthTokenMiddleware(options.origin, Tokens.AccessToken),
    replayAttackBlocker
  ], function(req, res, next) {
    return res.send(publicUserInfo(req.oauthToken.user));
  });

  app.namedRoutes.add('/api/account/notify.json', 'api:account:notify');
  app.post('/api/account/notify.json', [
    oauthUtil.notBadOAuthRequestMiddleware(VALIDATORS.AUTHORIZED),
    oauthTokenMiddleware(options.origin, Tokens.AccessToken),
    replayAttackBlocker
  ], function(req, res, next) {
    var appName = req.oauthToken.application.name;
    var username = req.oauthToken.user.username;

    if (!req.body.text) return res.send(400, 'text required');
    // TODO: Limit maximum size of text.

    emailBackend.send({
      to: [{
        name: username,
        email: req.oauthToken.user.email,
        type: 'to'
      }],
      subject: 'Webmaker Connect notification from the ' + appName + ' app',
      text: nunjucks.renderString(NOTIFY_TEMPLATE, {
        appName: appName,
        username: username,
        indentedText: req.body.text.split('\n').map(function(line) {
          return '    ' + line.trim()
        }).join('\n'),
        unsubscribeURL: app.namedRoutes.reverseAbsolute('app:authorized')
      })
    }, function(err) {
      if (err) return next(err);
      return res.send({status: 'sent'});
    });
  });
};
