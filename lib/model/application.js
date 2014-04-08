var _ = require('underscore');
var assert = require('assert');
var Schema = require('mongoose').Schema;

var db = require('../db');
var Tokens = require('./tokens');
var userFields = require('./user').fields;
var modelUtil = require('./util');

var API_KEY_BYTE_SIZE = 18;
var API_SECRET_BYTE_SIZE = 33;

// TODO: Build appropriate indexes.

var schema = new Schema({
  name: {type: String, required: true},
  description: {type: String, required: true},
  website: {type: String, required: true, validate: modelUtil.safeURL},
  callbackURL: {type: String, validate: modelUtil.safeURL},
  owner: userFields,
  apiKey: {type: String, unique: true},
  apiSecret: {type: String}
});

schema.methods.revokeAccessToUser = function(userId, cb) {
  // Let's make a bold assertion to ensure we don't accidentally
  // destroy the whole database or something.
  assert(userId && this._id);

  Tokens.AccessToken.remove({
    'user.userId': userId,
    'application': this._id
  }, cb);
};

schema.pre('remove', function(next) {
  Tokens.RequestToken.remove({application: this._id}, next);
});
schema.pre('remove', function(next) {
  Tokens.AccessToken.remove({application: this._id}, next);
});

modelUtil.pseudoRandomKey(schema, 'apiKey', API_KEY_BYTE_SIZE);
modelUtil.randomSecret(schema, 'apiSecret', API_SECRET_BYTE_SIZE);

var Application = db.model('Application', schema);

function findAuthorizedByUser(userId, cb) {
  Tokens.AccessToken.find({
    'user.userId': userId
  }).populate('application').exec(function(err, tokens) {
    if (err) return cb(err);
    cb(null, _.uniq(tokens.map(function(token) {
      return token.application;
    })));
  });
}

Application.findAuthorizedByUser = findAuthorizedByUser;

module.exports = Application;
