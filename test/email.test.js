var should = require('should');
var nock = require('nock');

var email = require('../').module('./email');

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
