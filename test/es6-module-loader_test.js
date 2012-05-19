/*global require:true */
var es6_module_loader = require('../lib/es6-module-loader.js');

exports['awesome'] = {
  setUp: function(done) {
    // setup here
    done();
  },
  'no args': function(test) {
    test.expect(1);
    // tests here
    test.equal(es6_module_loader.awesome(), 'awesome', 'should be awesome.');
    test.done();
  }
};
