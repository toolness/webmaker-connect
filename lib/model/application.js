var Schema = require('mongoose').Schema;

var db = require('../db');

var safeURL = [function(str) {
  return /^http?:\/\//.test(str);
}, "Valid URLs must be http or https."];

var schema = new Schema({
  name: {type: String, required: true},
  description: {type: String, required: true},
  website: {type: String, required: true, validate: safeURL},
  callbackURL: {type: String, validate: safeURL},
  apiKey: {type: String, required: true},
  apiSecret: {type: String, required: true}
});

var Application = db.model('Application', schema);

module.exports = Application;
