require('traceur');

var System = require('../dist/es6-module-loader.src');

System.parser = 'traceur';

module.exports = {
  Loader: global.LoaderPolyfill,
  System: System
};
