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

describe('Application', function() {
  beforeEach(db.wipe);

  it('should auto-generate api key and secret on save', function(done) {
    (new Application(exampleApp)).save(function(err, model) {
      if (err) return done(err);
      model.apiKey.should.match(/^([A-Za-z0-9]+)$/);
      model.apiSecret.should.match(/^([A-Za-z0-9]+)$/);
      done();
    });
  });

  it('should raise errors on unsafe website URLs', function(done) {
    (new Application({website: 'javascript:lol'})).save(function(err) {
      err.errors.website.message
        .should.eql('Valid URLs must be http or https.');
      done();
    });
  });

  it('should raise errors on unsafe callback URLs', function(done) {
    (new Application({callbackURL: 'javascript:lol'})).save(function(err) {
      err.errors.callbackURL.message
        .should.eql('Valid URLs must be http or https.');
      done();
    });
  });

  it('should accept empty callback URLs', function(done) {
    (new Application({callbackURL: ''})).save(function(err) {
      should.equal(err.errors.callbackURL, undefined);
      done();
    });
  });

  describe('revokeAccessToUser()', function() {
    var app0, app1;

    beforeEach(function(done) {
      Application.create(exampleApp, {
        name: 'another cool app',
        description: 'another cool app yo',
        website: 'http://coolapp2.com',
        owner: 'bleh'
      }, function(err, first, second) {
        if (err) return done(err);
        app0 = first;
        app1 = second;
        done();
      });
    });
    beforeEach(function(done) {
      Tokens.AccessToken.create({
        token: 'app0 to foo',
        user: {userId: 'foo'},
        application: app0._id
      }, {
        token: 'app1 to foo',
        user: {userId: 'foo'},
        application: app1._id        
      }, {
        token: 'app0 to bar',
        user: {userId: 'bar'},
        application: app0._id
      }, done);
    });

    it('should revoke only tokens for user ID and app', function(done) {
      app0.revokeAccessToUser('foo', function(err) {
        if (err) return done(err);
        Tokens.AccessToken.find({}, function(err, results) {
          if (err) return done(err);
          results.should.have.length(2);
          done();
        });
      });
    });
  });
});

describe('Application.findAuthorizedByUser', function(done) {
  var application, token;

  beforeEach(db.wipe);
  beforeEach(function(done) {
    application = new Application(exampleApp);
    application.save(done);
  });
  beforeEach(function(done) {
    token = new Tokens.AccessToken({
      token: 'lol',
      user: {userId: 'foo'},
      application: application._id
    });
    token.save(done);
  });

  it('should return apps that user has access tokens for', function(done) {
    Application.findAuthorizedByUser('foo', function(err, apps) {
      if (err) return done(err);
      apps.should.have.length(1);
      apps[0].name.should.eql('my cool app');
      done();
    });
  });

  it('should not return apps that user hasn\'t authorized', function(done) {
    Application.findAuthorizedByUser('bar', function(err, apps) {
      if (err) return done(err);
      apps.should.have.length(0);
      done();
    });
  });

  it('should not return duplicate entries', function(done) {
    new Tokens.AccessToken({
      token: 'dup',
      user: {userId: 'foo'},
      application: application._id
    }).save(function(err) {
      if (err) return done(err);
      Application.findAuthorizedByUser('foo', function(err, apps) {
        if (err) return done(err);
        apps.should.have.length(1);
        done();
      });
    });    
  });
});
