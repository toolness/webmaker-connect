function Field(basename) {
  this.form = null;
  this.basename = basename;
}

Field.prototype = {
  defaultValue: '',
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
    if (typeof(this.form.defaultModel[this.basename]) != 'undefined')
      return this.form.defaultModel[this.basename];
    return this.defaultValue;
  },
  get error() {
    var error = this.form.errors && this.form.errors[this.basename];

    if (!error) return null;
    if (error.type == 'required') return "This field is required.";
    return error.message;
  },
  get schema() {
    return this.form.model.schema.paths[this.basename];
  },
  get isRequired() {
    return !!this.schema.isRequired;
  }
};

function ModelForm(options) {
  this.formData = options.formData || {};
  this.instance = options.instance || null;
  this.model = options.model;
  this.prefix = options.prefix || (this.model.modelName + '_');
  this.fields = options.fields.map(function(field) {
    if (typeof(field) == 'string')
      field = new Field(field);
    return field;
  });

  this._fieldMap = {};
  this.fields.forEach(function(field) {
    var name = field.basename;
    if (!(name in this.model.schema.paths))
      throw new Error('unknown field ' + JSON.stringify(name));

    this._fieldMap[name] = field;
    field.form = this;
  }, this);

  this.defaultModel = new this.model();
  this.errors = null;
}

ModelForm.prototype = {
  validate: function(cb) {
    if (!this.instance)
      this.instance = new this.model();
    this.fields.forEach(function(field) {
      this.instance[field.basename] = field.value;
    }, this);
    this.instance.validate(function(err) {
      if (err)
        this.errors = err.errors;
      cb();
    }.bind(this));
  },
  validateAndSave: function(cb) {
    this.validate(function() {
      return this.errors ? cb(null) : this.instance.save(cb);
    }.bind(this));
  },
  field: function(name) {
    var field = this._fieldMap[name];
    if (!field)
      throw new Error('unknown field ' + JSON.stringify(name));
    return field;
  }
};

module.exports = ModelForm;
