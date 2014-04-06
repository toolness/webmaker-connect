var express = require('express');
var request = require('supertest');
var should = require('should');

var lib = require('../');
var website = lib.website;
var template = lib.template;
var Application = lib.module('./model/application');
var Tokens = lib.module('./model/tokens');
var NamedRoutes = lib.NamedRoutes;
var db = require('./db');

var users = {
  'foo': {
    email: 'foo@example.org',
    username: 'foo',
    userId: 'id$foo'
  },
  'developer': {
    userId: 'id$developer',
    username: 'developer',
    email: 'developer@example.org'
  }
};

var exampleApp = {
  name: 'example app',
  description: 'just for testing',
  website: 'http://myapp.com',
  owner: users.developer,
  apiKey: 'consumerkey'
};

function bodyDoesNotContain(criteria) {
  return function(res) {
    function errIfTrue(condition) {
      if (condition)
        return 'expected ' + criteria + ' to not be in ' +
               JSON.stringify(res.text);
    }

    if (criteria instanceof RegExp)
      return errIfTrue(res.text.match(criteria));

    if (typeof(criteria) == 'string')
      return errIfTrue(res.text.indexOf(criteria) != -1);

    throw new Error('do not know what to do with ' + criteria);
  };
}

describe("website", function() {
  var app, email, username, userId;

  function setUser(userKey) {
    var user = users[userKey];
    should(user);
    email = user.email; username = user.username; userId = user.userId;
  }

  beforeEach(db.wipe);
  beforeEach(function(done) {
    email = null;
    username = null;
    userId = null;
    app = express();

    NamedRoutes.express(app, 'http://example.org');
    app.use(express.json());
    app.use(function(req, res, next) {
      req.csrfToken = function() { return 'irrelevant'; }
      req.session = {email: email, username: username, userId: userId};
      next();
    });

    template.express(app, {});
    website.express(app, {origin: 'http://example.org'});
    app.use(function(err, req, res, next) {
      if (typeof(err) == 'number')
        return res.send(err);
      throw err;
    });

    done();
  });

  it('should show login button when logged out', function(done) {
    request(app)
      .get('/')
      .expect(/js-login/)
      .expect(200, done);
  });

  it('should show logout button when logged in', function(done) {
    email = 'foo@example.org';
    request(app)
      .get('/')
      .expect(/foo@example\.org/)
      .expect(/js-logout/)
      .expect(200, done);
  });

  describe('/app', function() {
    var application;

    beforeEach(db.wipe);
    beforeEach(function(done) {
      app.namedRoutes.add('/oauth/request_token', 'oauth:request_token');
      app.namedRoutes.add('/oauth/access_token', 'oauth:access_token');
      application = new Application(exampleApp);
      application.save(done);      
    });

    it('should reject unauthenticated users', function(done) {
      request(app).get('/app').expect(401, done);
    });

    it('should show a user\'s owned apps', function(done) {
      setUser('developer');
      request(app)
        .get('/app')
        .expect(/example app/)
        .expect(200, done);
    });

    it('should not show a user\'s unowned apps', function(done) {
      setUser('foo');
      request(app)
        .get('/app')
        .expect(bodyDoesNotContain(/example app/))
        .expect(200, done);
    });

    describe('/app/:appId/', function(done) {
      it('should not show private app info to non-owners', function(done) {
        setUser('foo');
        request(app)
          .get('/app/' + application._id)
          .expect(/example app/)
          .expect(bodyDoesNotContain(/API Secret/))
          .expect(bodyDoesNotContain(application.apiSecret))
          .expect(200, done);
      });

      it('should show private app info to owners', function(done) {
        setUser('developer');
        request(app)
          .get('/app/' + application._id)
          .expect(/example app/)
          .expect(/API Secret/)
          .expect(200, done);
      });
    });
  });

  describe('/authorize', function() {
    var application, reqToken;

    beforeEach(function() { setUser('foo') })
    beforeEach(db.wipe);
    beforeEach(function makeApplication(done) {
      application = new Application(exampleApp);
      application.save(done);
    });
    beforeEach(function makeRequestToken(done) {
      reqToken = new Tokens.RequestToken({
        application: application._id,
        callbackURL: 'http://myapp.com/cb',
        token: 'reqtoken'
      });
      reqToken.save(done);
    });

    it('should reject invalid request tokens', function(done) {
      request(app)
        .get('/authorize?oauth_token=invalid')
        .expect(/request token not found/i)
        .expect(200, done);
    });

    it('should reject previously used request tokens', function(done) {
      reqToken.verifier = 'blarg';
      reqToken.save(function(err) {
        if (err) return done(err);
        request(app)
          .get('/authorize?oauth_token=reqtoken')
          .expect(/request token already used/i)
          .expect(200, done);
      });
    });

    it('should show err when no request token present', function(done) {
      request(app)
        .get('/authorize')
        .expect(/request token not present/i)
        .expect(200, done);
    });

    it('should present form when given valid request token', function(done) {
      request(app)
        .get('/authorize?oauth_token=reqtoken')
        .expect(/<\/form>/i)
        .expect(/value="reqtoken"/i)
        .expect(200, done);
    });

    it('should redirect form submissions to callbackURL', function(done) {
      request(app)
        .post('/authorize')
        .send({oauth_token: 'reqtoken'})
        .expect('location', /^http:\/\/myapp.com\/cb\?oauth_token=reqtoken&oauth_verifier=.+/)
        .expect(302, done);
    });
  });
});
