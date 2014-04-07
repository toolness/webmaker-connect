var Application = require('../model/application');
var ModelForm = require('../model-form');
var userFromSession = require('../model/user').fromSession;

function isAppOwner(req) {
  return req.session.userId == req.application.owner.userId;
}

function requireAppOwner(req, res, next) {
  if (!isAppOwner(req))
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
      return res.redirect(options.routes.reverse('app:detail', application));
    });
  }
}

exports.express = function(app) {
  app.namedRoutes.registerHandler('appId', function(application) {
    if (!(application instanceof Application)) return;
    return application._id;
  });

  app.param('appId', function(req, res, next, id) {
    Application.findOne({_id: id}, function(err, app) {
      if (err) return next(err);
      if (!app) return next(404);
      req.application = app;
      next();
    });
  });

  app.namedRoutes.add('/app', 'app:list');
  app.get('/app', app.requireLogin, function(req, res, next) {
    Application.find({
      'owner.userId': req.session.userId
    }, function(err, apps) {
      if (err) return next(err);
      return res.render('application/list.html', {apps: apps});
    });
  });

  app.namedRoutes.add('/app/new', 'app:new');
  app.all('/app/new', app.requireLogin, createOrEditApp({
    template: 'application/new.html',
    successMessage: 'Application created!',
    getApplication: function(req) {
      return new Application({
        owner: userFromSession(req.session)
      });
    },
    routes: app.namedRoutes
  }));

  app.namedRoutes.add('/app/authorized', 'app:authorized');
  app.all('/app/authorized', [
    app.requireLogin
  ], function(req, res, next) {
    Application.findAuthorizedByUser(req.session.userId, function(err, apps) {
      if (err) return next(err);
      return res.render('application/authorized.html', {apps: apps});
    });
  });

  app.namedRoutes.add('/app/:appId', 'app:detail');
  app.all('/app/:appId', function(req, res, next) {
    return res.render('application/detail.html', {
      app: req.application,
      isOwner: isAppOwner(req)
    });
  });

  app.namedRoutes.add('/app/:appId/edit', 'app:edit');
  app.all('/app/:appId/edit', [
    app.requireLogin,
    requireAppOwner
  ], createOrEditApp({
    template: 'application/edit.html',
    successMessage: 'Application updated!',
    getApplication: function(req) {
      return req.application;
    },
    routes: app.namedRoutes
  }));

  app.namedRoutes.add('/app/:appId/revoke', 'app:revoke');
  app.post('/app/:appId/revoke', app.requireLogin, function(req, res, next) {
    req.application.revokeAccessToUser(req.session.userId, function(err) {
      if (err) return next(err);
      req.flash('success', 'Access to your account by the app "' +
                           req.application.name + '" has been revoked.');
      return res.redirect('back');
    });
  });

  app.namedRoutes.add('/app/:appId/delete', 'app:delete');
  app.all('/app/:appId/delete', [
    app.requireLogin,
    requireAppOwner
  ], function(req, res, next) {
    if (req.method != 'POST')
      return res.render('application/delete.html', {app: req.application});
    req.flash('info', 'The application "' + req.application.name +
                      '" has been deleted.');
    req.application.remove(function(err) {
      if (err) return next(err);
      return res.redirect(app.namedRoutes.reverse('app:list'));
    });
  });
};
