require('when');

module.exports = require('../dist/es6-module-loader-dev.src');

var System = module.exports.System;

try {
  System.site.set('traceur', require.resolve('traceur/bin/traceur.js'));
}
catch(e) {}