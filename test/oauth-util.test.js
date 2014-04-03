var should = require('should');
var express = require('express');
var request = require('supertest');

var oauthUtil = require('../').oauthUtil;

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
