var crypto = require('crypto');

function alphanumeric(buffer) {
  return buffer.toString('base64')
    .replace(/\+/g, 'A')
    .replace(/\//g, 'B');
}

function pseudoRandomKey(schema, name, size) {
  schema.pre('save', function setKey(next) {
    if (this[name]) return next();

    // TODO: Deal with the extremely unlikely case that the
    // key we get isn't unique.
    this[name] = alphanumeric(crypto.pseudoRandomBytes(size));
    next();
  });
}

function randomSecret(schema, name, size, test) {
  schema.pre('save', function setSecret(next) {
    if (this[name]) return next();
    if (test && !test.call(this)) return next();
    crypto.randomBytes(size, function(err, buff) {
      if (err) return next(err);
      this[name] = alphanumeric(buff);
      next();
    }.bind(this));
  });
}

var safeURL = [function(str) {
  if (!str) return true;
  return /^http?:\/\//.test(str);
}, "Valid URLs must be http or https."];

exports.pseudoRandomKey = pseudoRandomKey;
exports.randomSecret = randomSecret;
exports.safeURL = safeURL;
