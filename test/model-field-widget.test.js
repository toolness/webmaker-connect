var should = require('should');
var nunjucks = require('nunjucks');

var WidgetExtension = require('../').module('./model-field-widget');

function buildEnv() {
  var env = new nunjucks.Environment();

  WidgetExtension.initialize(env);
  return env;
}

describe('model field widget', function() {
  it('should throw error when field data type is unsupported', function() {
    (function() {
      buildEnv().renderString('{% fieldwidget f %}{% endfieldwidget %}', {
        f: {basename: 'funk', type: 'Funky'}
      });
    }).should.throw(/no widget for data type "Funky" for field "funk"/);
  });
});

describe('model field widget for String', function() {
  var env, ctx;

  function testTransform(start, end) {
    if (Array.isArray(start)) start = start.join('');
    if (Array.isArray(end)) end = end.join('');
    env.renderString(start, ctx).should.eql(end);
  }

  beforeEach(function() {
    env = buildEnv();
    ctx = {
      myfield: {
        type: 'String',
        name: 'myname',
        id: 'myid',
        value: 'myvalue'
      }
    };
  });

  it('should show error if present', function() {
    ctx.myfield.error = 'ALAS';
    testTransform([
      '{% fieldwidget myfield %}',
      '<label>hi</label>',
      '<input type="text">',
      '{% endfieldwidget %}'
    ], [
      '<div class="alert alert-danger">ALAS</div>',
      '<label for="myid">hi</label>',
      '<input type="text" id="myid" name="myname" value="myvalue">'
    ]);
  });

  it('should work with <input>', function() {
    testTransform([
      '{% fieldwidget myfield %}',
      '<label>this is {{field.name}}</label>',
      '<input type="text">',
      '{% endfieldwidget %}',
      '{{field.name}}' // Also ensure 'field' is unset after block tag end.
    ], [
      '<label for="myid">this is myname</label>',
      '<input type="text" id="myid" name="myname" value="myvalue">'
    ]);
  });

  it('should work with <textarea>', function() {
    testTransform([
      '{% fieldwidget myfield %}',
      '<label>this is {{field.name}}</label>',
      '<textarea></textarea>',
      '{% endfieldwidget %}',
    ], [
      '<label for="myid">this is myname</label>',
      '<textarea id="myid" name="myname">myvalue</textarea>'
    ]);
  });
});
