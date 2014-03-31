function ModelForm(options) {
  this.form = options.form || null;
  this.instance = options.instance || null;
  this.fields = options.fields;
  this.model = options.model;
  this.prefix = options.prefix || (this.model.modelName + '_');
}

ModelForm.prototype = {
  save: function(cb) {
    // TODO
  },
  fullClean: function(cb) {
    // TODO
  },
  _ensureValidFieldName: function(field) {
    if (!(field in this.fields))
      throw new Error('Unknown field name: ' + JSON.stringify(field));
  },
  id: function(field) {
    this._ensureValidFieldName(field);
    return this.prefix + this.fields[field];
  },
  name: function(field) {
    this._ensureValidFieldName(field);
    return this.prefix + this.fields[field];
  }
};
