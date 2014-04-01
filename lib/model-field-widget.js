var cheerio = require('cheerio');

var quote = require('./util').quote;
var TransformExtension = require('./nunjucks-transform-extension');

var WIDGET_CONSTRUCTORS = {
  'String': Widget
};

function Widget(field) {
  this.field = field;
}

Widget.prototype = {
  updateDOM: function($) {
    var field = this.field;

    $('label').attr('for', field.id);
    $('input, textarea')
      .attr('id', field.id)
      .attr('name', field.name);
    $('input').attr('value', field.value);
    $('textarea').text(field.value);
  }
};

module.exports = TransformExtension({
  tag: 'fieldwidget',
  mapArgs: function(args) { return {field: args}; },
  transform: function(body, ctx) {
    var widgetConstructor = WIDGET_CONSTRUCTORS[ctx.field.type];
    if (!widgetConstructor)
      throw new Error("no widget for data type " +
                      quote(ctx.field.type) + " for field " +
                      quote(ctx.field.basename));
    var widget = new widgetConstructor(ctx.field);
    var $ = cheerio.load(body);

    widget.updateDOM($);

    return $.html();
  }
});
