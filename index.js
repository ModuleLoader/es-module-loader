if (typeof Promise === 'undefined')
  require('when/es6-shim/Promise');

module.exports = require('./dist/es6-module-loader-dev.src');

var System = module.exports.System;

var filePrefix = 'file:' + (process.platform.match(/^win/) ? '///' : '//');
try {
  var traceurPath = filePrefix + require.resolve('traceur/bin/traceur.js');
  System.site.set('traceur', traceurPath);
}
catch(e) {}

try {
  var babelPath = filePrefix + require.resolve('babel/browser.js');
  System.site.set('babel', babelPath);
}
catch(e) {}

try {
  var babelCorePath = filePrefix + require.resolve('babel-core/browser.js');
  System.site.set('babel', babelCorePath);
}
catch(e) {}
