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
