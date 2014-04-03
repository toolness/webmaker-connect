var Schema = require('mongoose').Schema;

var db = require('../db');
var modelUtil = require('./util');

var TOKEN_BYTE_SIZE = 18;
var SECRET_BYTE_SIZE = 33;

// TODO: Add expiry information to all this and have mongo auto-remove
// expired tokens.

var nonceSchema = new Schema({
  nonce: String,
  timestamp: Number,
  consumerKey: String
});

var requestTokenSchema = new Schema({
  token: String,
  tokenSecret: String,
  verifier: String,
  userInfo: Schema.Types.Mixed,
  callbackURL: {type: String, validate: modelUtil.safeURL},
  application: {type: Schema.Types.ObjectId, ref: 'Application'}
});

var accessTokenSchema = new Schema({
  token: String,
  tokenSecret: String,
  userInfo: Schema.Types.Mixed,
  application: {type: Schema.Types.ObjectId, ref: 'Application'}
});

modelUtil.pseudoRandomKey(requestTokenSchema, 'token', TOKEN_BYTE_SIZE);
modelUtil.randomSecret(requestTokenSchema, 'tokenSecret', SECRET_BYTE_SIZE);
modelUtil.pseudoRandomKey(
  requestTokenSchema,
  'verifier',
  TOKEN_BYTE_SIZE,
  function needsToBeGenerated() {
    return !!this.userInfo;
  }
);

modelUtil.pseudoRandomKey(accessTokenSchema, 'token', TOKEN_BYTE_SIZE);
modelUtil.randomSecret(accessTokenSchema, 'tokenSecret', SECRET_BYTE_SIZE);

var Nonce = db.model('Nonce', nonceSchema);
var RequestToken = db.model('RequestToken', requestTokenSchema);
var AccessToken = db.model('AccessToken', accessTokenSchema);

exports.Nonce = Nonce;
exports.RequestToken = RequestToken;
exports.AccessToken = AccessToken;
