exports.express = function(app) {
  if (app.apiPrefix != '/api/')
    throw new Error('expected apiPrefix to be /api/');

  app.namedRoutes.add('/api/oauth/request_token', 'oauth:request_token');
  app.all('/api/oauth/request_token', function(req, res, next) {
    return next(501);
  });

  app.namedRoutes.add('/api/oauth/access_token', 'oauth:access_token');
  app.all('/api/oauth/access_token', function(req, res, next) {
    return next(501);
  });
};
