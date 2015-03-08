var System = require('../dist/es6-module-loader.src');

System.transpiler = 'traceur';
System.paths['traceur'] = require.resolve('traceur/bin/traceur.js');

module.exports = {
  Loader: global.LoaderPolyfill,
  System: System
};
