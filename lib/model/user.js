var crypto = require('crypto');
var _ = require('underscore');

var fields = {
  userId: String,
  username: String,
  email: String
};

function md5(str) {
  var md5sum = crypto.createHash('md5');
  md5sum.update(str);
  return md5sum.digest('hex')
}

function fromSession(session) {
  return _.pick(session, 'email', 'username', 'userId');
}

exports.fields = fields;
exports.fromSession = fromSession;
exports.publicInfo = function(user) {
  return {
    userId: user.userId,
    username: user.username,
    emailHash: md5(user.email.toLowerCase().trim())
  };
};
