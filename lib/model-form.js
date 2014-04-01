var FIELD_CONSTRUCTORS = {
  'String': Field
};

function quote(name) {
  return '"' + name + '"';
}

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
  get type() {
    return this.schema.instance;
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

  this._fieldMap = {};
  this.fields = options.fields.map(function(field) {
    var basename = typeof(field) == 'string' ? field : field.basename;
    var schema = this.model.schema.paths[basename];

    if (!schema)
      throw new Error('unknown field ' + quote(basename));

    if (typeof(field) == 'string') {
      var fieldConstructor = FIELD_CONSTRUCTORS[schema.instance];

      if (!fieldConstructor)
        throw new Error("no field for data type " +
                        quote(schema.instance) + " for field " +
                        quote(basename));
      field = new fieldConstructor(field);
    }

    field.form = this;
    this._fieldMap[basename] = field;
    return field;
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
