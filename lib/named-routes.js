function NamedRoutes() {
  this._routes = {};
}

NamedRoutes.prototype = {
  add: function(route, name) {
    this._routes[name] = route;
  },
  express: function(app) {
    app.namedRoutes = this;
    app.locals.reverse = this.reverse.bind(this);
  },
  reverse: function(name, params) {
    var route = this._routes[name];
    params = params || {};
    if (!route)
      throw new Error('Unknown route name ' + JSON.stringify(name));
    return route.replace(/:([A-Za-z0-9_]+)/, function(_, param) {
      if (!(param in params))
        throw new Error('Missing param ' + JSON.stringify(param) +
                        ' for route ' + JSON.stringify(name));
      return params[param];
    });
  }
};

module.exports = NamedRoutes;
module.exports.express = function(app) {
  var routes = new NamedRoutes();

  routes.express(app);
};
