var TransformExtension = require('./nunjucks-transform-extension');

module.exports = TransformExtension({
  tag: 'fieldwidget',
  mapArgs: function(args) { return {field: args}; },
  transform: function(body, ctx) {
    return ctx.field.transformHTML(body);
  }
});
