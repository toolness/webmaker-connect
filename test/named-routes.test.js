var should = require('should');

var NamedRoutes = require('../').NamedRoutes;

describe('NamedRoutes', function() {
  it('should work w/ routes that have no parameters', function() {
    var routes = new NamedRoutes();
    routes.add('/foo', 'foo');
    routes.reverse('foo').should.eql('/foo');
  });

  it('should work w/ routes that have parameters', function() {
    var routes = new NamedRoutes();
    routes.add('/foo/:id', 'foo');
    routes.reverse('foo', {id: 'bar'}).should.eql('/foo/bar');
    routes.reverse('foo', {id: 1}).should.eql('/foo/1');
  });

  it('should consult param handler first', function() {
    var routes = new NamedRoutes();
    routes.registerHandler('id', function(obj) { return obj.meh; });
    routes.add('/foo/:id', 'foo');
    routes.reverse('foo', {meh: 'bop', id: '1'}).should.eql('/foo/bop');
  });

  it('should fallback to property lookups after param handler', function() {
    var routes = new NamedRoutes();
    var consulted = 0;
    routes.registerHandler('id', function() { consulted++; });
    routes.add('/foo/:id', 'foo');
    routes.reverse('foo', {id: '50'}).should.eql('/foo/50');
    consulted.should.eql(1);
  });

  it('should raise errors on nonexistent routes', function() {
    var routes = new NamedRoutes();
    (function() {
      routes.reverse('foo');
    }).should.throw('Unknown route name "foo"');
  });

  it('should raise errors on insufficient params', function() {
    var routes = new NamedRoutes();
    routes.add('/foo/:id', 'foo');

    (function() {
      routes.reverse('foo', {});
    }).should.throw('Missing param "id" for route "foo"');
  });
});
