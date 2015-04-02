require('when');

module.exports = require('../dist/es6-module-loader-dev.src');

var System = module.exports.System;

System.transpiler = 'babel';

try {
  System.site.set('babel', require.resolve('babel-core/browser.js'));
}
catch(e) {}

try {
  System.site.set('babel', require.resolve('babel/browser.js'));
}
catch(e) {}