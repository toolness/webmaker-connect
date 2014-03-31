var should = require('should');

var db = require('./db');
var Application = require('../').module('./model/application');

describe('Application', function() {
  beforeEach(db.wipe);

  it('should be saved when required fields are valid', function(done) {
    (new Application({
      name: 'my cool app',
      description: 'this is my cool app yo',
      website: 'http://coolapp.com',
      apiKey: 'resgsergserg',
      apiSecret: 'awpgonegpoanweg'
    })).save(done);
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
