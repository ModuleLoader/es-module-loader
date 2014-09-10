if (!global.traceur)
  require('traceur');
require('../dist/es6-module-loader');

module.exports = {
  Loader: global.Reflect.Loader,
  System: global.System
};
