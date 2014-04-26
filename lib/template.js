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

function createEnvironment(extraTemplateLoaders) {
  var mainLoader = new nunjucks.FileSystemLoader(paths.templateDir, true);
  var loaders = [mainLoader];
  var nunjucksEnv;

  if (extraTemplateLoaders)
    loaders.push.apply(loaders, extraTemplateLoaders);

  nunjucksEnv = new nunjucks.Environment(loaders, {autoescape: true});

  if (nunjucksEnv.mainLoader) throw new Error("mainLoader exists");
  nunjucksEnv.mainLoader = mainLoader;

  return nunjucksEnv;
}

exports.safeContext = function(ctx) {
  var newCtx = {};
  Object.keys(ctx).forEach(function(name) {
    newCtx[name] = new nunjucks.runtime.SafeString(ctx[name]);
  });
  return newCtx;
};

exports.createEnvironment = createEnvironment;

exports.express = function(app, options) {
  var nunjucksEnv = createEnvironment(options.extraTemplateLoaders);

  WidgetExtension.initialize(nunjucksEnv);

  _.extend(app.locals, {
    DOT_MIN: options.debug ? '' : '.min',
    STATIC_ROOT: options.staticRoot || ''
  });
  if (options.debug) app.use(fullyReloadAllTemplates(nunjucksEnv.mainLoader));
  app.use(flash());
  app.nunjucksEnv = nunjucksEnv;
  nunjucksEnv.express(app);
  app.response.render.SafeString = nunjucks.runtime.SafeString;
  app.use(function setResponseLocals(req, res, next) {
    if (req.isApiCall) return next();
    res.locals.csrfToken = req.csrfToken();
    res.locals.email = req.session.email || '';
    res.locals.fetchAndClearFlashMessages = flashList.bind(null, req);
    next();
  });
};
