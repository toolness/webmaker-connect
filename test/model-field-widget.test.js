var should = require('should');
var nunjucks = require('nunjucks');

var WidgetExtension = require('../').module('./model-field-widget');

describe('model field widget', function() {
  it('should work', function() {
    var env = new nunjucks.Environment();

    WidgetExtension.initialize(env);

    var html = env.renderString([
      '{% fieldwidget myfield %}',
      'hi {{field.name}}',
      '{% endfieldwidget %}',
      '{{field.name}}'
    ].join(''), {
      myfield: {
        name: 'NAME',
        transformHTML: function(html) {
          return 'begin ' + html + ' end';
        }
      }
    });

    html.should.eql('begin hi NAME end');
  });
});
