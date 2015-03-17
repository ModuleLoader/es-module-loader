var System = require('../dist/es6-module-loader.src');

System.transpiler = 'babel';

try {
  System.paths['babel'] = require.resolve('babel-core/browser.js');
}
catch(e) {}

module.exports = {
  Loader: global.LoaderPolyfill,
  System: System
};
