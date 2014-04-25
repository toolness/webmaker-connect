var should = require('should');
var nock = require('nock');

var email = require('../').email;

var SIMPLE_MESSAGE = {
  subject: 'hi',
  text: 'hello there.',
  to: [{
    email: 'recipient@example.com',
    name: 'Somebody',
    type: 'to'
  }],
  from_email: 'no-reply@example.com',
  from_name: 'Our Website'
};

describe('email.createBackend()', function() {
  it('should convert "from" to "from_email" and "from_name"', function() {
    var backend = email.createBackend('fake:');

    backend.send({from: 'Person <foo@bar.org>'});
    backend.inbox.should.eql([{
      from_name: 'Person',
      from_email: 'foo@bar.org'
    }]);
  });

  it('should convert "to" strings to objects', function() {
    var backend = email.createBackend('fake:');

    backend.send({to: ['Person <foo@bar.org>']});
    backend.inbox.should.eql([{
      to: [{
        name: 'Person',
        email: 'foo@bar.org',
        type: 'to'
      }]
    }]);
  });

  it('should apply defaults to sent messages', function() {
    var backend = email.createBackend('fake:', {from_email: 'foo@bar.org'});

    backend.send({subject: 'hi'});
    backend.inbox.should.eql([{subject: 'hi', from_email: 'foo@bar.org'}]);
  });
});

describe('email.parse', function() {
  it('should work w/ "Foo Bar <foo@bar.org>"', function() {
    email.parse('Foo Bar <foo@bar.org>').should.eql({
      email: 'foo@bar.org',
      name: 'Foo Bar'
    });
  });

  it('should work w/ foo@bar.org"', function() {
    email.parse('foo@bar.org').should.eql({
      email: 'foo@bar.org',
      name: ''
    });
  });
});

describe('MandrillBackend', function() {
  var mandrill, backend;

  beforeEach(function() {
    mandrill = nock('https://api.mandrill.com');
    backend = email.createBackend('mandrill://foo');
  });
  afterEach(function() { mandrill.done(); });

  it('should work', function(done) {
    mandrill.post('/messages/send.json', {
      key: 'foo',
      message: SIMPLE_MESSAGE
    })
    .reply(200);

    backend.send(SIMPLE_MESSAGE, done);
  });

  it('should propagate non-200 responses as errors', function(done) {
    mandrill.post('/messages/send.json', {
      key: 'foo',
      message: SIMPLE_MESSAGE
    })
    .reply(500);

    backend.send(SIMPLE_MESSAGE, function(err) {
      err.message.should.eql('mandrill returned status code 500');
      done();
    });
  });
});
