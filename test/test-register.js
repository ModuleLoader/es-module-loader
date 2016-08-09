var LoaderSystemRegister = require('../dist/loader-system-register.js');

var loader = new LoaderSystemRegister(__filename);

loader.import('./register.js').then(function(m) {
  console.log(m);
})
.catch(function(err) {
  console.error(err);
});