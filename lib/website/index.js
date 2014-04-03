var url = require('url');

var application = require('./application');

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

  app.namedRoutes.add('/api/oauth/request_token', 'oauth:request_token');
  app.all('/api/oauth/request_token', function(req, res, next) {
    return next(501);
  });

  app.namedRoutes.add('/authorize', 'oauth:authorize');
  app.all('/authorize', function(req, res, next) {
    return next(501);
  });

  app.namedRoutes.add('/api/oauth/access_token', 'oauth:access_token');
  app.all('/api/oauth/access_token', function(req, res, next) {
    return next(501);
  });
};
