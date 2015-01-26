var System = require('../dist/es6-module-loader.src');

System.parser = '6to5';

module.exports = {
  Loader: global.LoaderPolyfill,
  System: System
};
