var http = require('http');
var express = require('express');
var OAuth = require('oauth').OAuth;
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
      owner: 'tester',
      apiKey: 'consumerkey',
      apiSecret: 'consumersecret'
    }).save(done);
  });

  afterEach(function(done) { server.close(done); });

  it('should work', function(done) {
    var auth = oauth();
    auth.getOAuthRequestToken(function(err, token, secret, results) {
      if (err) return done(errorify(err));
      Tokens.RequestToken.findOne({
        token: token
      }).populate('application').exec(function(err, reqToken) {
        if (err) return done(err);
        reqToken.application.name.should.eql('example app');
        reqToken.callbackURL.should.eql('http://example.org/callback');
        should.equal(reqToken.verifier, undefined);
        reqToken.userInfo = {username: 'foo'};
        reqToken.save(function(err) {
          if (err) return done(err);
          reqToken.verifier.should.be.a('string');
          auth.getOAuthAccessToken(
            token,
            secret,
            reqToken.verifier,
            function(err, accessToken, accessSecret, results) {
              if (err) return done(errorify(err));
              results.username.should.eql('foo');
              auth.get(
                origin + '/api/account/settings.json',
                accessToken,
                accessSecret,
                function(err, data) {
                  if (err) return done(errorify(err));
                  JSON.parse(data).should.eql({username: 'foo'});
                  done();
                }
              );
            }
          );
        });
      });
    });
  });
});
