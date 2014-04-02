var _ = require('underscore');
var nunjucks = require('nunjucks');
var flash = require('connect-flash');

var paths = require('./paths');
var WidgetExtension = require('./model-field-widget');

function flashList(req) {
  var flash = req.flash();
  var messages = [];
  Object.keys(flash).forEach(function(category) {
    messages.push.apply(messages, flash[category].map(function(content) {
      return {category: category, content: content};
    }));
  });
  return messages;
}

// Nunjucks has a bug where its standard watch-for-updates algorithm
// doesn't recurse into subdirectories, so when debugging, we'll just
// recompile templates on every request.
function fullyReloadAllTemplates(loader) {
  return function(req, res, next) {
    Object.keys(loader.pathsToNames).forEach(function(fullname) {
      loader.emit('update', loader.pathsToNames[fullname]);
    });
    return next();
  };
}

exports.express = function(app, options) {
  var mainLoader = new nunjucks.FileSystemLoader(paths.templateDir, true);
  var loaders = [mainLoader];
  var nunjucksEnv;

  if (options.extraTemplateLoaders)
    loaders.push.apply(loaders, options.extraTemplateLoaders);

  nunjucksEnv = new nunjucks.Environment(loaders, {autoescape: true});

  WidgetExtension.initialize(nunjucksEnv);

  _.extend(app.locals, {
    DOT_MIN: options.debug ? '' : '.min',
    STATIC_ROOT: options.staticRoot || ''
  });
  if (options.debug) app.use(fullyReloadAllTemplates(mainLoader));
  app.use(flash());
  app.nunjucksEnv = nunjucksEnv;
  nunjucksEnv.express(app);
  app.response.render.SafeString = nunjucks.runtime.SafeString;
  app.use(function setResponseLocals(req, res, next) {
    res.locals.csrfToken = req.csrfToken();
    res.locals.email = req.session.email || '';
    res.locals.fetchAndClearFlashMessages = flashList.bind(null, req);
    next();
  });
};
