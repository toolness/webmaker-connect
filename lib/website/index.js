var url = require('url');

var application = require('./application');
var oauthUtil = require('../oauth-util');
var userFromSession = require('../model/user').fromSession;
var Tokens = require('../model/tokens');

var WEBMAKER_URL = process.env.WEBMAKER_URL || 'https://webmaker.org';
var WEBMAKER_DOMAIN = url.parse(WEBMAKER_URL).hostname;

function requireLogin(req, res, next) {
  if (req.session.email && req.session.username) return next();
  return res.status(401).render('401.html');
}

exports.express = function(app, options) {
  app.locals.WEBMAKER_URL = WEBMAKER_URL;
  app.locals.WEBMAKER_DOMAIN = WEBMAKER_DOMAIN;

  app.requireLogin = requireLogin;

  application.express(app);

  app.namedRoutes.add('/', 'home');
  app.get('/', function(req, res, next) {
    return res.render('index.html');
  });

  app.namedRoutes.add('/docs/api/', 'docs:api');
  app.get('/docs/api/', function(req, res, next) {
    return res.render('docs/api.html');
  });

  app.namedRoutes.add('/authorize', 'oauth:authorize');
  app.all('/authorize', [
    requireLogin,
    Tokens.authorizeOAuthTokenMiddleware
  ], function(req, res, next) {
    var token = req.oauthToken;

    if (token.error)
      return res.render('authorize.html', {error: token.error.message});

    if (req.method == 'GET') {
      return res.render('authorize.html', {
        oauthToken: token,
        app: token.application
      });
    } else {
      token.user = userFromSession(req.session);
      token.save(function(err) {
        if (err) return next(err);

        return res.redirect(oauthUtil.callbackURL(
          token.callbackURL,
          token.token,
          token.verifier
        ));
      });
    }
  });
};
