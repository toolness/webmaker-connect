function NamedRoutes() {
  this._routes = {};
  this._paramHandlers = {};
}

NamedRoutes.prototype = {
  add: function(route, name) {
    this._routes[name] = route;
  },
  express: function(app) {
    app.namedRoutes = this;
    app.locals.reverse = this.reverse.bind(this);
  },
  registerHandler: function(param, handler) {
    if (param in this._paramHandlers)
      throw new Error('handler for param ' + param + ' already exists');
    this._paramHandlers[param] = handler;
  },
  reverse: function(name, params) {
    var route = this._routes[name];
    params = params || {};
    if (!route)
      throw new Error('Unknown route name ' + JSON.stringify(name));
    return route.replace(/:([A-Za-z0-9_]+)/, function(_, param) {
      var paramValue;

      if (param in this._paramHandlers)
        paramValue = this._paramHandlers[param](params);

      if (paramValue === undefined)
        paramValue = params[param];

      if (paramValue === undefined)
        throw new Error('Missing param ' + JSON.stringify(param) +
                        ' for route ' + JSON.stringify(name));

      return paramValue;
    }.bind(this));
  }
};

module.exports = NamedRoutes;
module.exports.express = function(app) {
  var routes = new NamedRoutes();

  routes.express(app);
};
