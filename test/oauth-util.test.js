var should = require('should');
var express = require('express');
var hmacsign = require('oauth-sign').hmacsign;
var request = require('supertest');

var oauthUtil = require('../').oauthUtil;

describe('oauthUtil.hmacSignedMiddleware()', function() {
  var middleware = oauthUtil.hmacSignedMiddleware;

  function app(isInitialRequest, oauth, getSecrets) {
    oauth.oauth_signature_method = 'HMAC-SHA1';
    return express()
      .use(function(req, res, next) { req.oauth = oauth; next(); })
      .use(middleware({
        baseURL: 'http://example.org',
        getSecrets: getSecrets,
        isInitialRequest: isInitialRequest
      }))
      .get('*', function(req, res) { return res.send(200); });
  }

  it('should reject invalid consumer key', function(done) {
    request(app(true, {
      oauth_consumer_key: 'lol',
    }, function getSecrets(consumerKey, oauthToken, cb) {
      consumerKey.should.eql('lol');
      should.equal(oauthToken, undefined);
      cb(null, null, null);
    })).get('/')
      .expect('invalid consumer key')
      .expect(401, done);
  });

  it('should reject invalid oauth token', function(done) {
    request(app(false, {
      oauth_consumer_key: 'lol',
      oauth_token: 'bleh'
    }, function getSecrets(consumerKey, oauthToken, cb) {
      consumerKey.should.eql('lol');
      oauthToken.should.eql('bleh');
      cb(null, 'lol', null);
    })).get('/')
      .expect('invalid oauth token')
      .expect(401, done);
  });

  it('should reject invalid signatures', function(done) {
    request(app(true, {
      oauth_consumer_key: 'lol',
      oauth_signature: 'totally invalid.'
    }, function getSecrets(consumerKey, oauthToken, cb) {
      cb(null, 'hey');
    })).get('/')
      .expect('invalid signature')
      .expect(401, done);
  });

  it('should accept valid signatures', function(done) {
    var signature = hmacsign('GET', 'http://example.org/boop', {
      foo: 'lol',
      z: 'z',
      oauth_signature_method: 'HMAC-SHA1',
      oauth_version: '1.0A',
      oauth_timestamp: 1396492044,
      oauth_nonce: 'u',
      oauth_token: 'blugrh',
      oauth_consumer_key: 'lol'
    }, 'consumersecret', 'atsecret');

    request(app(false, {
      oauth_version: '1.0A',
      oauth_timestamp: '1396492044',
      oauth_nonce: 'u',
      oauth_token: 'blugrh',
      oauth_consumer_key: 'lol',
      oauth_signature: signature
    }, function getSecrets(consumerKey, oauthToken, cb) {
      oauthToken.should.eql('blugrh');
      cb(null, 'consumersecret', 'atsecret');
    })).get('/boop?foo=lol&z=z')
      .expect(200, done);
  });
});

describe('oauthUtil.validNonceAndTimestampMiddleware()', function() {
  var middleware = oauthUtil.validNonceAndTimestampMiddleware;
  var usedNonces = [];

  beforeEach(function() { usedNonces = []; });

  function app(oauth) {
    return express()
      .use(function(req, res, next) { req.oauth = oauth; next(); })
      .use(middleware(function check(options, cb) {
        var key = [options.consumerKey, options.nonce,
                   options.timestamp].join(':');
        if (usedNonces.indexOf(key) != -1)
          return process.nextTick(function() { cb(null, false); });
        usedNonces.push(key);
        process.nextTick(function() { cb(null, true); });
      }))
      .get('/', function(req, res) { return res.send(200); });
  }

  it('should pass through valid key/nonce/timestamp', function(done) {
    request(app({
      oauth_consumer_key: 'lol',
      oauth_nonce: 'wut',
      oauth_timestamp: '123'
    })).get('/').expect(200, function(err) {
      if (err) return done(err);
      usedNonces.should.eql(['lol:wut:123']);
      done();
    });
  });

  it('should reject invalid timestamp', function(done) {
    request(app({oauth_timestamp: '0'})).get('/')
      .expect('invalid timestamp')
      .expect(401, done);
  });

  it('should reject used key/nonce/timestamp', function(done) {
    usedNonces.push('lol:wut:123');
    request(app({
      oauth_consumer_key: 'lol',
      oauth_nonce: 'wut',
      oauth_timestamp: '123'
    })).get('/')
      .expect('invalid nonce or timestamp')
      .expect(401, done);
  });
});

describe('oauthUtil.notBadOAuthRequestMiddleware()', function() {
  var VALIDATORS = oauthUtil.VALIDATORS;
  var middleware = oauthUtil.notBadOAuthRequestMiddleware;

  function app(criteria) {
    return express().get('/', middleware(criteria), function(req, res) {
      return res.send(200, req.oauth);
    });
  }

  it('should reject requests without auth header', function(done) {
    request(app(VALIDATORS.REQUEST_TOKEN))
      .get('/')
      .expect('missing authorization header')
      .expect(400, done);
  });

  it('should reject requests with bad auth header', function(done) {
    request(app(VALIDATORS.REQUEST_TOKEN))
      .get('/')
      .set('Authorization', 'lolwut')
      .expect('invalid or malformed authorization header')
      .expect(400, done);
  });

  it('should pass through requests w/ not-bad auth header', function(done) {
    request(app(VALIDATORS.REQUEST_TOKEN))
      .get('/')
      .set('Authorization',
           'OAuth ' + [
             'oauth_consumer_key="lol"',
             'oauth_signature_method="HMAC-SHA1"',
             'oauth_signature="meh"',
             'oauth_timestamp="123"',
             'oauth_nonce="blah"',
             'oauth_version="1.0"',
             'oauth_callback="' + encodeURIComponent('http://foo.org') + '"'
           ].join(','))
      .expect({
        oauth_consumer_key: 'lol',
        oauth_signature_method: "HMAC-SHA1",
        oauth_signature: "meh",
        oauth_timestamp: "123",
        oauth_nonce: "blah",
        oauth_version: "1.0",
        oauth_callback: "http://foo.org"
      })
      .expect(200, done);
  });
});

describe('oauthUtil.decodeAuthorizationHeader()', function() {
  var decode = oauthUtil.decodeAuthorizationHeader;

  it('should accept complex objects for validation criteria', function() {
    var criteria = {a: {required: false, regexp: /c/}, eh: true};
    should.equal(decode('oauth a="b", eh="1"', criteria), null);
    should.equal(decode('oauth a="c"', criteria), null);
    decode('oauth a="c", eh="1"', criteria).should.eql({a: 'c', eh: '1'});
    decode('oauth eh="1"', criteria).should.eql({eh: '1'});
  });

  it('should reject params not matching regexp', function() {
    should.equal(decode('oauth a="b"', {a: /c/}), null);
  });

  it('should accept params matching regexp', function() {
    decode('oauth a="b"', {a: /b/}).should.eql({a: 'b'});
  });

  it('should accept params matching regexp', function() {
    should.equal(decode('oauth funk="heh"', {}), null);
  });

  it('should reject names not on whitelist', function() {
    should.equal(decode('oauth funk="heh"', {}), null);
  });

  it('should accept names on whitelist', function() {
    decode('oauth oauth_nonce="heh"', {oauth_nonce: true}).should.eql({
      oauth_nonce: 'heh'
    });
  });

  it('should fail when required params are not present', function() {
    should.equal(decode('oauth a="heh"', {a: true, b: true}), null);
  });

  it('should succeed when optional params are not present', function() {
    decode('oauth a="1"', {a: true, b: false}).should.eql({a: '1'});
  });

  it('should reject non-oauth auth-schemes', function() {
    should.equal(decode('lol realm="example"'), null);
  });

  it('should reject oauth headers w/ duplicate values', function() {
    should.equal(decode('OAuth realm="example", a="", a=""'), null);
  });

  it('should be case insensitive', function() {
    decode('OAuth realm="example"').should.eql({realm: 'example'});
    decode('oauth realm="example"').should.eql({realm: 'example'});    
  });

  it('should parse multiple parameters', function() {
    decode('OAuth realm="example", oauth_lol="hi"').should.eql({
      realm: 'example',
      oauth_lol: 'hi'
    });
  });

  it('should reject malformed parameters', function() {
    should.equal(decode('OAuth realmexample, u="hi"'), null);
  });

  it('should percent-decode parameter values', function() {
    decode('OAuth foo="bar%20baz"').should.eql({foo: 'bar baz'});
  });

  it('should percent-decode parameter names', function() {
    decode('OAuth hi%20u="hmm"').should.eql({'hi u': 'hmm'});
  });

  it('should accept chars in the unreserved character set', function() {
    decode('OAuth Az0-._~="~_.-0zA"').should.eql({'Az0-._~': '~_.-0zA'});
  });

  it('should reject malformed percent-encoded param values', function() {
    should.equal(decode('OAuth a="a%AFc"'), null);
  });

  it('should reject malformed percent-encoded param names', function() {
    should.equal(decode('OAuth a%AFc="hi"'), null);
  });

  it('should allow for empty values', function() {
    decode('OAuth a=""').should.eql({a: ''});
  });
});
