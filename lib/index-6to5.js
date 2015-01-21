require('../dist/es6-module-loader-6to5.src');

module.exports = {
  Loader: global.LoaderPolyfill,
  System: global.System
};
