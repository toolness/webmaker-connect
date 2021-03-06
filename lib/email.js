var parseUrl = require('url').parse;
var _ = require('underscore');
var request = require('request');

var template = require('./template');

var BACKENDS = {
  'mandrill:': MandrillBackend,
  'fake:': FakeBackend,
  'console:': ConsoleBackend
};

function noop() {}

function normalizeSendOptions(options) {
  if (options.from) {
    var fromParsed = parseEmail(options.from);
    delete options.from;
    options.from_email = fromParsed.email;
    options.from_name = fromParsed.name;
  }

  if (options.to)
    options.to = options.to.map(function(recipient) {
      if (typeof(recipient) == 'string')
        return _.extend(parseEmail(recipient), {type: 'to'});
      return recipient;
    });

  return options;
}

function parseEmail(str) {
  var match = str.match(/^(.+)<(.+)>$/);

  if (match) return {
    name: match[1].trim(),
    email: match[2].trim()
  };
  return {name: '', email: str.trim()};
}

function FakeBackend() {
  return {
    send: function(options, cb) {
      this.inbox.push(options);
      process.nextTick(cb);
    },
    inbox: []
  }
}

function ConsoleBackend() {
  return {
    send: function(options, cb) {
      console.log('--');
      console.log(sendOptionsToPlainText(options));
      process.nextTick(cb);
    }
  };
}

function MandrillBackend(urlInfo) {
  this._key = urlInfo.host;
}

MandrillBackend.prototype.send = function(options, cb) {
  request({
    url: 'https://mandrillapp.com/api/1.0/messages/send.json',
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

function sendOptionsToPlainText(options) {
  var nunjucksEnv = options.nunjucksEnv || template.createEnvironment();

  options = _.clone(options);
  if (options.from_name)
    options.from = options.from_name + ' <' + options.from_email + '>';
  else
    options.from = options.from_email;
  options.to = options.to.filter(function(item) {
    return item.type == 'to';
  }).map(function(t) {
    return t.name ? t.name + ' <' + t.email + '>' : t.email;
  }).join(', ');

  return nunjucksEnv.render('console-email.txt',
                            template.safeContext(options));
}

function wrapBackend(backend, defaults) {
  var self = Object.create(backend);

  self.send = function(options, cb) {
    options = _.clone(options);
    options = _.defaults(options, defaults);
    options = normalizeSendOptions(options);

    return backend.send.call(backend, options, cb || noop);
  };

  return self;
}

exports.createBackend = function(url, defaults) {
  var info = parseUrl(url);
  var backendConstructor = BACKENDS[info.protocol];

  if (!backendConstructor)
    throw new Error('unsupported backend: ' + url);

  return wrapBackend(new backendConstructor(info), defaults || {});
};

exports.parse = parseEmail;
exports.normalizeSendOptions = normalizeSendOptions;
exports.sendOptionsToPlainText = sendOptionsToPlainText;
