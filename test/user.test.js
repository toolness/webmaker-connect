var should = require('should');

var user = require('../').module('./model/user');

describe('user.publicInfo()', function() {
  it('should work', function() {
    user.publicInfo({
      userId: '5',
      username: 'foo',
      email: ' fOO@bar.Org '
    }).should.eql({
      userId: '5',
      username: 'foo',
      emailHash: '24191827e60cdb49a3d17fb1befe951b'
    });
  });
});
