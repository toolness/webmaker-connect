var url = require('url');

var application = require('./application');
var Tokens = require('../model/tokens');

var WEBMAKER_URL = process.env.WEBMAKER_URL || 'https://webmaker.org';
var WEBMAKER_DOMAIN = url.parse(WEBMAKER_URL).hostname;

function requireLogin(req, res, next) {
  if (req.session.email && req.session.username) return next();
  return res.status(401).render('401.html');
}

function authorizeErr(res, message) {
  return res.render('authorize.html', {error: message});
}

function getOAuthToken(req, res, next) {
  var token = req.param('oauth_token');
  if (!token) return authorizeErr(res, 'Request token not present');
  Tokens.RequestToken.findOne({
    token: req.query.oauth_token
  }).populate('application').exec(function(err, reqToken) {
    if (err) return next(err);
    if (!reqToken) return authorizeErr(res, 'Request token not found');
    if (reqToken.verifier)
      return authorizeErr(res, 'Request token already used');
    req.oauthToken = reqToken;
    next();
  });
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

  app.namedRoutes.add('/authorize', 'oauth:authorize');
  app.all('/authorize', [
    requireLogin,
    getOAuthToken
  ], function(req, res, next) {
    var token = req.oauthToken;

    if (req.method == 'GET') {
      return res.render('authorize.html', {
        oauthToken: token,
        app: token.application
      });
    } else {
      token.userInfo = {username: req.session.username};
      token.save(function(err) {
        if (err) return next(err);

        // TODO: Use url.parse(), add query param, then stringify
        return res.redirect(token.callbackURL + '?oauth_verifier=' +
                            encodeURIComponent(token.verifier));
      });
    }
  });
};
