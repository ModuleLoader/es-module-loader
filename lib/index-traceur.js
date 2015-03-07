var System = require('../dist/es6-module-loader.src');

System.transpiler = 'traceur';

module.exports = {
  Loader: global.LoaderPolyfill,
  System: System
};
