var request = require('request');

function getUsernameForEmail(email, cb) {
  var baseURL = process.env.LOGINAPI_URL || 'https://login.webmaker.org';

  if (baseURL == ':fake:') return fakeUsernameForEmail(email, cb);

  var auth = process.env.LOGINAPI_AUTH.split(':');

  request({
    url: baseURL + '/user/email/' + email,
    auth: {
      user: auth[0],
      pass: auth[1],
      sendImmediately: true
    }
  }, function(err, res, body) {
    if (err) return cb(err);
    if (res.statusCode == 404) {
      return cb(null, null);
    } else if (res.statusCode == 200) {
      body = JSON.parse(body);
      return cb(null, body.user.username, body.user.id.toString(),
                body.user.avatar);
    }
    return cb(new Error('unexpected status code: ' +
                        res.statusCode));
  });
}

function fakeUsernameForEmail(email, cb) {
  process.nextTick(function() {
    if (/nonwebmaker/.test(email)) return cb(null, null);
    var username = email.split('@')[0];
    cb(null, username, 'id$' + username);
  });
}

function getUsernameMiddleware(req, res, next) {
  function ready() {
    res.locals.username = req.session.username;
    res.locals.userId = req.session.userId;
    next();
  }

  var session = req.session;
  if (session.email) {
    if (!session.username)
      return getUsernameForEmail(session.email, function(err, username, id,
                                                         avatar) {
        if (err) return next(new Error('login api read failure'));
        session.username = username;
        session.userId = id;
        session.avatar = avatar;
        ready();
      });
  } else session.username = session.userId = session.avatar = null;
  ready();
}

module.exports = getUsernameForEmail;
module.exports.middleware = getUsernameMiddleware;

if (!module.parent) {
  var email = process.argv[2];
  getUsernameForEmail(email, function(err, username) {
    if (err) throw err;
    console.log('username for', email, 'is', username);
  });
}
