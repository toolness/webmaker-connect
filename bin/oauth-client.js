var fs = require('fs');
var util = require('util');
var express = require('express');
var OAuth = require('oauth').OAuth;
var Application = require('../').module('./model/application');
var _ = require('underscore');

var ORIGIN = require('./app').ORIGIN;
var CONSUMER_PORT = process.env.CONSUMER_PORT || 3001;
var CONSUMER_ORIGIN = 'http://localhost:' + CONSUMER_PORT;
var SESSION_FILE = __dirname + '/../.oauth-client-session.json';

var app = express();
var oauthAppName = process.argv[2];
var consumerKey, consumerSecret;

if (!ORIGIN) {
  console.error('Please set ORIGIN or DEBUG as per README.md.');
  process.exit(1);
}

if (!oauthAppName)
  oauthAppNameError('Please provide the name of an app in the database.');

function oauthAppNameError(msg) {
  console.error(msg);
  console.error('You can manage your apps at ' + ORIGIN + '/app.');
  process.exit(1);
}

function oauth() {
  return new OAuth(
    ORIGIN + '/api/oauth/request_token',
    ORIGIN + '/api/oauth/access_token',
    consumerKey,
    consumerSecret,
    '1.0A',
    CONSUMER_ORIGIN + '/callback',
    'HMAC-SHA1'
  );
}

function loadSession() {
  if (fs.existsSync(SESSION_FILE))
    return JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
  return {};
}

function writeSession(session) {
  fs.writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2));
}

function updateSession(session) {
  session = _.extend(loadSession(), session);
  writeSession(session);
  return session;
}

app.get('/', function(req, res) {
  return res.send([
    '<a href="/login">login</a>',
    '<a href="/settings">user settings</a> (requires login)',
    '<a href="/logout">logout</a>',
  ].join('<br>'));
});

app.get('/callback', function(req, res) {
  var token = req.param('oauth_token');
  var verifier = req.param('oauth_verifier');
  var session = loadSession();

  if (token != session.oauth_token)
    return res.send('token mismatch');

  oauth().getOAuthAccessToken(
    session.oauth_token,
    session.oauth_secret,
    verifier,
    function(err, access_token, access_secret, results2) {
      if (err) {
        return res.type('text/plain').send(util.inspect(err));
      }
      delete session.oauth_token;
      delete session.oauth_secret;
      session.access_token = access_token;
      session.access_secret = access_secret;
      writeSession(session);
      console.log(results2);
      return res.redirect('/settings');
    }
  );
});

app.get('/settings', function(req, res, next) {
  var session = loadSession();
  if (!session.access_token) return res.redirect('/login');
  var req = oauth().get(
    ORIGIN + '/api/account/settings.json',
    session.access_token,
    session.access_secret
  );
  req.on('response', function(oauthRes) {
    if (oauthRes.statusCode != 200) return res.send('status ' +
                                                    oauthRes.statusCode);
    res.type('application/json');
    oauthRes.pipe(res);
  });
  req.end();
});

app.get('/logout', function(req, res, next) {
  writeSession({});
  return res.send('logged out');
});

app.get('/login', function(req, res, next) {
  oauth().getOAuthRequestToken(function(err, token, secret, results) {
    if (err) throw err;
    updateSession({
      oauth_token: token,
      oauth_secret: secret
    });
    return res.redirect(ORIGIN + '/authorize?oauth_token=' + token);
  });
});

Application.findOne({name: oauthAppName}, function(err, application) {
  if (err) throw err;
  if (!application)
    return oauthAppNameError('App "' + oauthAppName + '" not found.');
  consumerKey = application.apiKey;
  consumerSecret = application.apiSecret;
  console.log('Found app "' + oauthAppName + '" with API key ' +
              consumerKey + '.');
  app.listen(CONSUMER_PORT, function() {
    console.log('Listening at ' + CONSUMER_ORIGIN + '.');
  });
});
