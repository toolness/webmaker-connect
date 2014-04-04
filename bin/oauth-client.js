var fs = require('fs');
var express = require('express');
var OAuth = require('oauth').OAuth;
var _ = require('underscore');

var ORIGIN = require('./app').ORIGIN;
var CONSUMER_PORT = process.env.CONSUMER_PORT || 3001;
var CONSUMER_ORIGIN = 'http://localhost:' + CONSUMER_PORT;
var CONSUMER_KEY = process.env.CONSUMER_KEY;
var CONSUMER_SECRET = process.env.CONSUMER_SECRET;
var SESSION_FILE = __dirname + '/../.oauth-client-session.json';

var app = express();

if (!(ORIGIN && CONSUMER_KEY && CONSUMER_SECRET)) {
  console.log('please set the ORIGIN, CONSUMER_KEY, CONSUMER_SECRET');
  console.log('environment variables.');
  process.exit(1);
}

function oauth() {
  return new OAuth(
    ORIGIN + '/api/oauth/request_token',
    ORIGIN + '/api/oauth/access_token',
    process.env.CONSUMER_KEY,
    process.env.CONSUMER_SECRET,
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

  oauth().getOAuthAccessToken(
    session.oauth_token,
    session.oauth_secret,
    verifier,
    function(err, access_token, access_secret, results2) {
      if (err) throw err;
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

app.listen(CONSUMER_PORT, function() {
  console.log('listening on ' + CONSUMER_PORT);
});
