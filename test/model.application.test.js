var should = require('should');

var db = require('./db');
var Application = require('../').module('./model/application');

describe('Application', function() {
  beforeEach(db.wipe);

  it('should auto-generate api key and secret on save', function(done) {
    (new Application({
      name: 'my cool app',
      description: 'this is my cool app yo',
      website: 'http://coolapp.com',
    })).save(function(err, model) {
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
});
