var System = require('../dist/es6-module-loader.src');

System.transpiler = 'traceur';
try {
  System.paths['traceur'] = require.resolve('traceur/bin/traceur.js');
}
catch(e) {}

module.exports = {
  Loader: global.LoaderPolyfill,
  System: System
};
