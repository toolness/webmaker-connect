var parseUrl = require('url').parse;
var util = require('util');
var request = require('request');

var BACKENDS = {
  'mandrill:': MandrillBackend,
  'console:': ConsoleBackend
};

function ConsoleBackend() {
  return {
    send: function(options, cb) {
      console.log('Email send:', util.inspect(options));
      process.nextTick(cb);
    }
  };
}

function MandrillBackend(urlInfo) {
  this._key = urlInfo.host;
}

MandrillBackend.prototype.send = function(options, cb) {
  request({
    url: 'https://api.mandrill.com/messages/send.json',
    method: 'POST',
    json: {
      key: this._key,
      message: {
        text: options.text,
        subject: options.subject,
        to: options.to,
        from_email: options.from_email,
        from_name: options.from_name
      }
    }
  }, function(err, res, body) {
    if (err) return cb(err);
    if (res.statusCode != 200)
      return cb(new Error('mandrill returned status code ' + res.statusCode));
    cb();
  });
};

exports.createBackend = function(url) {
  var info = parseUrl(url);
  var backendConstructor = BACKENDS[info.protocol];

  if (!backendConstructor)
    throw new Error('unsupported backend: ' + url);

  return new backendConstructor(info);
};
