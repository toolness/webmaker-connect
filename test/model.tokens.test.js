var should = require('should');

var db = require('./db');
var Application = require('../').module('./model/application');
var Tokens = require('../').module('./model/tokens');

var exampleApp = {
  name: 'my cool app',
  description: 'this is my cool app yo',
  website: 'http://coolapp.com',
  owner: 'foo'
};

describe('AccessToken.fromRequestToken', function() {
  var app, reqToken;

  beforeEach(db.wipe);
  beforeEach(function(done) {
    Application.create(exampleApp, function(err, doc) {
      app = doc;
      done(err);
    });
  });
  beforeEach(function(done) {
    reqToken = new Tokens.RequestToken({
      user: {userId: 'id$foo'},
      application: app._id
    });
    reqToken.save(done);
  });

  it('should return existing access token if possible', function(done) {
    Tokens.AccessToken.create({
      user: {userId: 'id$foo'},
      application: app._id
    }, function(err, accessToken) {
      if (err) return done(err);

      Tokens.AccessToken.fromRequestToken(reqToken, function(err, tok) {
        if (err) return done(err);
        tok._id.should.eql(accessToken._id);
        tok.application.should.eql(app._id);
        done();
      });
    });
  });

  it('should create new access token when needed', function(done) {
    Tokens.AccessToken.fromRequestToken(reqToken, function(err, tok) {
      if (err) return done(err);
      tok.user.userId.should.eql('id$foo');
      tok.application.should.eql(app._id);
      done();
    });
  });

  it('should destroy request token', function(done) {
    var id = reqToken._id;
    Tokens.AccessToken.fromRequestToken(reqToken, function(err, tok) {
      if (err) return done(err);
      Tokens.RequestToken.findOne({_id: id}, function(err, doc) {
        if (err) return done(err);
        should.equal(doc, null);
        done();
      });
    });
  });
});
