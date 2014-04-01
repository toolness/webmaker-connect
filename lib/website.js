var url = require('url');

var Application = require('./model/application');
var ModelForm = require('./model-form');

var WEBMAKER_URL = process.env.WEBMAKER_URL || 'https://webmaker.org';
var WEBMAKER_DOMAIN = url.parse(WEBMAKER_URL).hostname;

function requireLogin(req, res, next) {
  if (req.session.email && req.session.username) return next();
  return res.status(401).render('401.html');
}

function requireAppOwner(req, res, next) {
  if (req.session.username != req.application.owner)
    return next(403);
  return next();
}

function createOrEditApp(options) {
  return function(req, res, next) {
    function render() {
      res.render(options.template, {
        app: application,
        form: form
      });
    }

    var application = options.getApplication(req);
    var form = new ModelForm({
      model: Application,
      instance: application,
      formData: req.body,
      fields: ['name', 'description', 'website', 'callbackURL']
    });

    if (req.method != 'POST') return render();

    form.validateAndSave(function(err) {
      if (err) return next(err);
      if (form.errors) {
        req.flash('danger', 'Your submission had some problems.');
        return render();
      }
      req.flash('success', options.successMessage);
      return res.redirect(options.routes.reverse('app:detail', {
        appId: application._id
      }));
    });
  }
}

exports.express = function(app, options) {
  app.locals.WEBMAKER_URL = WEBMAKER_URL;
  app.locals.WEBMAKER_DOMAIN = WEBMAKER_DOMAIN;

  app.param('appId', function(req, res, next, id) {
    Application.findOne({_id: id}, function(err, app) {
      if (err) return next(err);
      if (!app) return next(404);
      req.application = app;
      next();
    });
  });

  app.namedRoutes.add('/', 'home');
  app.get('/', function(req, res, next) {
    return res.render('index.html');
  });

  app.namedRoutes.add('/app', 'app:list');
  app.get('/app', requireLogin, function(req, res, next) {
    Application.find({owner: req.session.username}, function(err, apps) {
      if (err) return next(err);
      return res.render('app_list.html', {apps: apps});
    });
  });

  app.namedRoutes.add('/app/new', 'app:new');
  app.all('/app/new', requireLogin, createOrEditApp({
    template: 'app_new.html',
    successMessage: 'Application created!',
    getApplication: function(req) {
      return new Application({owner: req.session.username});
    },
    routes: app.namedRoutes
  }));

  app.namedRoutes.add('/app/:appId', 'app:detail');
  app.all('/app/:appId', function(req, res, next) {
    return res.render('app_detail.html', {
      app: req.application,
      isOwner: req.session.username == req.application.owner
    });
  });

  app.namedRoutes.add('/app/:appId/edit', 'app:edit');
  app.all('/app/:appId/edit', [
    requireLogin,
    requireAppOwner
  ], createOrEditApp({
    template: 'app_edit.html',
    successMessage: 'Application updated!',
    getApplication: function(req) {
      return req.application;
    },
    routes: app.namedRoutes
  }));
};
