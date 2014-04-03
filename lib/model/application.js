var Schema = require('mongoose').Schema;

var db = require('../db');
var modelUtil = require('./util');

var API_KEY_BYTE_SIZE = 18;
var API_SECRET_BYTE_SIZE = 33;

var schema = new Schema({
  name: {type: String, required: true},
  description: {type: String, required: true},
  website: {type: String, required: true, validate: modelUtil.safeURL},
  callbackURL: {type: String, validate: modelUtil.safeURL},
  owner: {type: String, required: true},
  apiKey: {type: String, unique: true},
  apiSecret: {type: String}
});

modelUtil.pseudoRandomKey(schema, 'apiKey', API_KEY_BYTE_SIZE);
modelUtil.randomSecret(schema, 'apiSecret', API_SECRET_BYTE_SIZE);

var Application = db.model('Application', schema);

module.exports = Application;
