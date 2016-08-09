var LoaderNodeBabel = require('../dist/loader-node-babel.js');

var loader = new LoaderNodeBabel(__filename);

loader.import('../core/loader-polyfill.js').then(function(m) {
  console.log(m);
})
.catch(function(err) {
  console.error(err);
});