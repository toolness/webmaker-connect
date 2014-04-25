var http = require('http');
var express = require('express');
var OAuth = require('oauth').OAuth;
var async = require('async');
var should = require('should');

var libRequire = require('../').module;
var Application = libRequire('./model/application');
var Tokens = libRequire('./model/tokens');
var NamedRoutes = libRequire('./named-routes');
var email = libRequire('./email');
var api = libRequire('./api');
var db = require('./db');

function errorify(err) {
  if (err instanceof Error) return err;
  return new Error(JSON.stringify(err));
}

describe('api (oauth)', function() {
  var app, server, origin, oauth, appModel, fakeEmail;

  function oauth(options) {
    options = options || {};
    return new OAuth(
      origin + '/api/oauth/request_token',
      origin + '/api/oauth/access_token',
      options.key || 'consumerkey',
      options.secret || 'consumersecret',
      '1.0A',
      'http://example.org/callback',
      'HMAC-SHA1'
    );
  }

  beforeEach(db.wipe);
  beforeEach(function startServer(done) {
    app = express();
    app.use(express.urlencoded());
    server = http.createServer(app);
    server.listen(function() {
      origin = 'http://localhost:' + server.address().port;
      done();
    });
  });
  beforeEach(function setupApp() {
    fakeEmail = email.createBackend('fake:');
    app.apiPrefix = '/api/';
    app.namedRoutes = new NamedRoutes('http://example.org');
    app.namedRoutes.add('/revoke', 'app:authorized');
    api.express(app, {
      origin: origin,
      emailBackend: fakeEmail
    });
  });
  beforeEach(function registerConsumerApplication(done) {
    appModel = new Application({
      name: 'example app',
      description: 'just for testing',
      website: 'http://example.org',
      owner: {
        userId: 'id$tester',
        username: 'tester',
        email: 'foo@bar.org'
      },
      apiKey: 'consumerkey',
      apiSecret: 'consumersecret'
    });
    appModel.save(done);
  });

  afterEach(function(done) { server.close(done); });

  it('should protect against replay attacks', function(done) {
    var auth = oauth();
    var nonce = auth._getNonce(auth._nonceSize);
    var timestamp = auth._getTimestamp();

    auth._getNonce = function() { return nonce; };
    auth._getTimestamp = function() { return timestamp; };

    auth.getOAuthRequestToken(function(err, token, secret, results) {
      if (err) return done(errorify(err));
      auth.getOAuthRequestToken(function(err, token, secret, results) {
        err.statusCode.should.eql(401);
        err.data.should.eql("invalid nonce or timestamp");
        done();
      });
    });
  });

  it('should reject requests with really old timestamps', function(done) {
    var auth = oauth();
    var timestamp = auth._getTimestamp() - 5000;

    auth._getTimestamp = function() { return timestamp; };

    auth.getOAuthRequestToken(function(err, token, secret, results) {
      err.statusCode.should.eql(401);
      err.data.should.eql("timestamp is too old or too new");
      done();
    });
  });

  it('should work', function(done) {
    var auth = oauth();

    function getRequestToken(cb) {
      auth.getOAuthRequestToken(function(err, token, secret, results) {
        if (err) return cb(errorify(err));
        cb(null, token, secret);
      });
    }

    function authorize(token, secret, cb) {
      Tokens.RequestToken.findOne({
        token: token
      }).populate('application').exec(function(err, reqToken) {
        if (err) return cb(err);
        reqToken.application.name.should.eql('example app');
        reqToken.callbackURL.should.eql('http://example.org/callback');
        should.equal(reqToken.verifier, undefined);
        reqToken.user = {username: 'foo', userId: 'id$foo',
                         email: 'foo@bar.org'};
        reqToken.save(function(err) {
          if (err) return cb(err);
          reqToken.verifier.should.be.a('string');
          cb(null, token, secret, reqToken.verifier);
        });
      });
    }

    function getAccessToken(token, secret, verifier, cb) {
      auth.getOAuthAccessToken(
        token,
        secret,
        verifier,
        function(err, accessToken, accessSecret, results) {
          if (err) return cb(errorify(err));
          results.username.should.eql('foo');
          cb(null, accessToken, accessSecret);
        }
      );
    }

    function getAccountSettings(token, secret, cb) {
      auth.get(
        origin + '/api/account/settings.json',
        token,
        secret,
        function(err, data) {
          if (err) return cb(errorify(err));
          JSON.parse(data).username.should.eql('foo');
          cb(null, token, secret);
        }
      );
    }

    async.waterfall([
      getRequestToken,
      authorize,
      getAccessToken,
      getAccountSettings
    ], done);
  });

  describe('privileged calls w/ access tokens', function() {
    beforeEach(function(done) {
      var token = new Tokens.AccessToken({
        token: 'at',
        tokenSecret: 'atsecret',
        user: {
          username: 'foo',
          userId: 'id$foo',
          email: 'foo@bar.org'
        },
        application: appModel._id
      });
      token.save(done);
    });

    it('returns 200 @ GET /api/account/settings.json', function(done) {
      oauth().get(
        origin + '/api/account/settings.json',
        'at',
        'atsecret',
        function(err, data) {
          if (err) return done(errorify(err));
          JSON.parse(data).username.should.eql('foo');
          done();
        }
      );
    });

    it('returns 200 @ POST /api/account/notify.json', function(done) {
      oauth().post(
        origin + '/api/account/notify.json',
        'at',
        'atsecret',
        {text: "hello there\nhow r u"},
        function(err, data) {
          if (err) return done(errorify(err));
          JSON.parse(data).status.should.eql('sent');
          fakeEmail.inbox.should.eql([{
            subject: 'Webmaker Connect notification from the example app app',
            text: [
              'Hi foo,',
              '',
              'The example app app wanted to notify you of the following:',
              '',
              '    hello there',
              '    how r u',
              '',
              'If you would like to stop receiving notifications from this',
              'app, you can do so at http://example.org/revoke.',
              '',
              'Sincerely,',
              '',
              'The Webmaker Connect Notification Robot'
            ].join('\n'),
            to: [{
              email: 'foo@bar.org',
              name: 'foo',
              type: 'to'
            }]
          }]);
          done();
        }
      );
    });
  });
});
