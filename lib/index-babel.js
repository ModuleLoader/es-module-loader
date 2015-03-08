var System = require('../dist/es6-module-loader.src');

System.transpiler = 'babel';
System.paths['babel'] = require.resolve('babel-core/browser.js');

module.exports = {
  Loader: global.LoaderPolyfill,
  System: System
};
