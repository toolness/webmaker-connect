var url = require('url');

function NamedRoutes(baseURL) {
  this.baseURL = baseURL;
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
    app.locals.reverseAbsolute = this.reverseAbsolute.bind(this);
  },
  registerHandler: function(param, handler) {
    if (param in this._paramHandlers)
      throw new Error('handler for param ' + param + ' already exists');
    this._paramHandlers[param] = handler;
  },
  reverseAbsolute: function(name, params) {
    if (!this.baseURL) throw new Error('Base URL is not defined');
    return url.resolve(this.baseURL, this.reverse(name, params));
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
module.exports.express = function(app, baseURL) {
  var routes = new NamedRoutes(baseURL);

  routes.express(app);
};
