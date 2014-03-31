function Field(basename) {
  this.form = null;
  this.basename = basename;
}

Field.prototype = {
  defaultValue: '',
  updateWidget: function($el) {

  },
  get name() {
    return this.form.prefix + this.basename;
  },
  get id() {
    return this.form.prefix + this.basename;
  },
  get value() {
    if (this.name in this.form.formData)
      return this.form.formData[this.name];
    if (this.form.instance)
      return this.form.instance[this.basename];
    var defaulter = new this.form.model();
    if (typeof(defaulter[this.basename]) != 'undefined')
      return defaulter[this.basename];
    return this.defaultValue;
  },
  get schema() {
    return form.model.schema.paths[this.basename];
  },
  get isRequired() {
    return !!this.schema.isRequired;
  }
};

function ModelForm(options) {
  this.formData = options.formData || {};
  this.instance = options.instance || null;
  this.fields = options.fields;
  this.model = options.model;
  this.prefix = options.prefix || (this.model.modelName + '_');
  this._fieldMap = {};
  this.fields.forEach(function(field) {
    var name = field.basename;
    if (!(name in this.form.model.schema.paths))
      throw new Error('unknown field ' + JSON.stringify(name));

    this._fieldMap[name] = field;
    field.form = this;
  }, this);
}

ModelForm.prototype = {
  save: function(cb) {
    // TODO:
    // * if instance does not exist, make a new one
    // * copy values from form to instance
    // * if there are errors, save them to this.errors, otherwise
    //   set this.errors to null
  },
  field: function(name) {
    var field = this._fieldMap[name];
    if (!field)
      throw new Error('unknown field ' + JSON.stringify(name));
    return field;
  }
};
