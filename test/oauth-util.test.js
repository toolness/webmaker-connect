var should = require('should');

var oauthUtil = require('../').oauthUtil;

describe('oauthUtil.decodeAuthorizationHeader()', function() {
  var decode = oauthUtil.decodeAuthorizationHeader;

  it('should ignore non-oauth auth-schemes', function() {
    decode('lol realm="example"').should.eql({});
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

  it('should ignore malformed parameters', function() {
    decode('OAuth realmexample, u="hi"').should.eql({u: 'hi'});
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

  it('should ignore malformed percent-encoded param values', function() {
    decode('OAuth a="a%AFc"').should.eql({a: ''});
  });

  it('should ignore malformed percent-encoded param names', function() {
    decode('OAuth a%AFc="hi"').should.eql({});
  });

  it('should allow for empty values', function() {
    decode('OAuth a=""').should.eql({a: ''});
  });
});
