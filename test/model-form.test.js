var Schema = require('mongoose').Schema;
var should = require('should');

var db = require('./db');
var ModelForm = require('../').module('./model-form');

var fooSchema = new Schema({
  name: {type: String, required: true},
  funkyValidator: {type: String, validate: [function(val) {
    return val == 'funky';
  }, 'This is not funky.']},
  defaulted: {type: String, default: function() { return 'default!'; }},
  privateInfo: String
});
var Foo = db.model('Foo', fooSchema);

describe('ModelForm', function() {
  beforeEach(db.wipe);

  it('raises error when there is no field for a data type', function() {
    (function() {
      new ModelForm({model: {schema: {
        paths: {blah: {instance: 'Funky'}}
      }}, fields: ['blah']});
    }).should.throw('no field for data type "Funky" for field "blah"');
  });

  it('raises helpful exceptions for nonexistent fields', function() {
    (function() {
      new ModelForm({model: Foo, fields: ['nonexistent']});
    }).should.throw('unknown field "nonexistent"');

    (function() {
      var form = new ModelForm({model: Foo, fields: ['name']});
      form.field('privateInfo');
    }).should.throw('unknown field "privateInfo"');
  });

  it('ultimately falls back to a well-defined default', function() {
    var form = new ModelForm({model: Foo, fields: ['privateInfo']});
    form.field('privateInfo').value.should.equal('');
  });

  it('takes field values from schema defaults', function() {
    var form = new ModelForm({model: Foo, fields: ['defaulted']});
    form.field('defaulted').value.should.eql('default!');
  });

  it('has expected field properties', function() {
    var form = new ModelForm({model: Foo, fields: ['name']});
    var field = form.field('name');

    field.basename.should.eql('name');
    field.name.should.eql('Foo_name');
    field.id.should.eql('Foo_name');
    field.isRequired.should.be.true;
    field.type.should.eql('String');
  });

  it('takes whitelisted values from form data', function(done) {
    var foo = new Foo({name: 'u', privateInfo: 'unsullied'});
    var form = new ModelForm({
      model: Foo,
      instance: foo,
      formData: {Foo_name: 'blah', Foo_privateInfo: 'evil'},
      fields: ['name']
    });
    form.validateAndSave(function() {
      should.equal(form.errors, null);
      should.equal(form.field('name').error, null);
      Foo.find(function(err, foos) {
        if (err) return done(err);
        foos.length.should.eql(1);
        foos[0].name.should.eql('blah');
        foos[0].privateInfo.should.equal('unsullied');
        done();
      });
    });
  });

  it('reports errors for required fields', function(done) {
    var form = new ModelForm({model: Foo, fields: ['name']});
    form.validateAndSave(function() {
      form.field('name').error.should.eql('This field is required.');
      done();
    });
  });

  it('reports errors from custom validators', function(done) {
    var form = new ModelForm({model: Foo, fields: ['funkyValidator']});
    form.validateAndSave(function() {
      form.field('funkyValidator').error.should.eql('This is not funky.');
      done();
    });
  });

});
