var _ = require('underscore');
var Schema = require('mongoose').Schema;

var db = require('../db');
var userFields = require('./user').fields;
var modelUtil = require('./util');

var TOKEN_BYTE_SIZE = 18;
var SECRET_BYTE_SIZE = 33;

// TODO: Build appropriate indexes.

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
  user: userFields,
  callbackURL: {type: String, validate: modelUtil.safeURL},
  created: {type: Date, default: Date.now},
  application: {type: Schema.Types.ObjectId, ref: 'Application'}
});

var accessTokenSchema = new Schema({
  token: String,
  tokenSecret: String,
  user: userFields,
  created: {type: Date, default: Date.now},
  application: {type: Schema.Types.ObjectId, ref: 'Application'}
});

accessTokenSchema.statics.fromRequestToken = function(reqToken, cb) {
  var appId = reqToken.populated('application') || reqToken.application;

  function onAccessToken(token) {
    RequestToken.findByIdAndRemove(reqToken._id, function(err) {
      if (err) return cb(err);
      cb(null, token);
    });
  }

  if (!appId)
    return cb(new Error("application id isn't in request token"));
  if (!reqToken.user.userId)
    return cb(new Error("user id isn't in request token"));

  AccessToken.findOne({
    'user.userId': reqToken.user.userId,
    'application': appId
  }, function(err, token) {
    if (err) return cb(err);
    if (token) return onAccessToken(token);

    token = new AccessToken({
      user: _.clone(reqToken.user),
      application: appId
    });
    token.save(function(err) {
      if (err) return cb(err);
      onAccessToken(token);
    });
  });
};

modelUtil.pseudoRandomKey(requestTokenSchema, 'token', TOKEN_BYTE_SIZE);
modelUtil.randomSecret(requestTokenSchema, 'tokenSecret', SECRET_BYTE_SIZE);
modelUtil.randomSecret(
  requestTokenSchema,
  'verifier',
  TOKEN_BYTE_SIZE,
  function needsToBeGenerated() {
    return !!this.user.username;
  }
);

modelUtil.pseudoRandomKey(accessTokenSchema, 'token', TOKEN_BYTE_SIZE);
modelUtil.randomSecret(accessTokenSchema, 'tokenSecret', SECRET_BYTE_SIZE);

var Nonce = db.model('Nonce', nonceSchema);
var RequestToken = db.model('RequestToken', requestTokenSchema);
var AccessToken = db.model('AccessToken', accessTokenSchema);

function authorizeOAuthTokenMiddleware(req, res, next) {
  function authorizeErr(message) {
    req.oauthToken = {error: new Error(message)};
    return next();
  }

  var token = req.param('oauth_token');
  if (!token) return authorizeErr('Request token not present');

  RequestToken.findOne({
    token: token
  }).populate('application').exec(function(err, reqToken) {
    if (err) return next(err);
    if (!reqToken) return authorizeErr('Request token not found');
    if (reqToken.verifier)
      return authorizeErr('Request token already used');
    req.oauthToken = reqToken;
    next();
  });
}

exports.Nonce = Nonce;
exports.RequestToken = RequestToken;
exports.AccessToken = AccessToken;
exports.authorizeOAuthTokenMiddleware = authorizeOAuthTokenMiddleware;
