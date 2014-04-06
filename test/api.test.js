var http = require('http');
var express = require('express');
var OAuth = require('oauth').OAuth;
var async = require('async');
var should = require('should');

var libRequire = require('../').module;
var Application = libRequire('./model/application');
var Tokens = libRequire('./model/tokens');
var NamedRoutes = libRequire('./named-routes');
var api = libRequire('./api');
var db = require('./db');

function errorify(err) {
  if (err instanceof Error) return err;
  return new Error(JSON.stringify(err));
}

describe('api (oauth)', function() {
  var app, server, origin, oauth;

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
    server = http.createServer(app);
    server.listen(function() {
      origin = 'http://localhost:' + server.address().port;
      done();
    });
  });
  beforeEach(function setupApp() {
    app.apiPrefix = '/api/';
    app.namedRoutes = new NamedRoutes();
    api.express(app, {origin: origin});
  });
  beforeEach(function registerConsumerApplication(done) {
    new Application({
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
    }).save(done);
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
});
