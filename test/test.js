var SystemRegisterLoader = require('../dist/system-register-only.js');

var loader = new SystemRegisterLoader(__filename);

loader.import('./register.js').then(function(m) {
  console.log(m);
})
.catch(function(err) {
  console.error(err);
});