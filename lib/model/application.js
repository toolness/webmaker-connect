var crypto = require('crypto');
var Schema = require('mongoose').Schema;

var db = require('../db');

var API_KEY_BYTE_SIZE = 18;
var API_SECRET_BYTE_SIZE = 33;

var safeURL = [function(str) {
  return /^http?:\/\//.test(str);
}, "Valid URLs must be http or https."];

var schema = new Schema({
  name: {type: String, required: true},
  description: {type: String, required: true},
  website: {type: String, required: true, validate: safeURL},
  callbackURL: {type: String, validate: safeURL},
  apiKey: {type: String, unique: true},
  apiSecret: {type: String}
});

function alphanumeric(buffer) {
  return buffer.toString('base64')
    .replace(/\+/g, 'A')
    .replace(/\//g, 'B');
}

schema.pre('save', function setApiKey(next) {
  if (this.apiKey) return next();

  // TODO: Deal with the extremely unlikely case that the
  // key we get isn't unique.
  this.apiKey = alphanumeric(crypto.pseudoRandomBytes(API_KEY_BYTE_SIZE));
  next();
});

schema.pre('save', function setApiSecret(next) {
  if (this.apiSecret) return next();
  crypto.randomBytes(API_SECRET_BYTE_SIZE, function(err, buff) {
    if (err) return next(err);
    this.apiSecret = alphanumeric(buff);
    next();
  }.bind(this));
});

var Application = db.model('Application', schema);

module.exports = Application;
