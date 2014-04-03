var url = require('url');

var application = require('./application');
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

  app.namedRoutes.add('/authorize', 'oauth:authorize');
  app.get('/authorize', requireLogin, function(req, res, next) {
    function showErr(message) {
      return res.render('authorize.html', {error: message});
    }

    if (!req.query.oauth_token)
      return showErr('i need a request token');
    Tokens.RequestToken.findOne({
      token: req.query.oauth_token
    }, function(err, reqToken) {
      if (err) return next(err);
      if (!reqToken) return showErr('request token not found');
      if (reqToken.verifier)
        return showErr('request token already used');
      return res.render('authorize.html');
    });
  });
};
