var url = require('url');

var WEBMAKER_URL = process.env.WEBMAKER_URL || 'https://webmaker.org';
var WEBMAKER_DOMAIN = url.parse(WEBMAKER_URL).hostname;

function requireLogin(req, res, next) {
  if (req.session.email && req.session.username) return next();
  return res.render('401.html');
}

exports.express = function(app, options) {
  app.locals.WEBMAKER_URL = WEBMAKER_URL;
  app.locals.WEBMAKER_DOMAIN = WEBMAKER_DOMAIN;

  app.namedRoutes.add('/', 'home');
  app.get('/', function(req, res, next) {
    return res.render('index.html');
  });

  // This is for testing, remove once we actually have a real
  // page that requires login.
  app.get('/login-required', requireLogin, function(req, res) {
    return res.render('index.html');
  });
};
