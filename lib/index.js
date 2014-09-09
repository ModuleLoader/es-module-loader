if (!global.traceur)
  require('traceur');
module.exports = {
  Loader: require('../dist/loader'),
  System: require('../dist/system')
};
