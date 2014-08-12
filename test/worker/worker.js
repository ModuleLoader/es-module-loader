importScripts("../../node_modules/traceur/bin/traceur.js",
             "../../node_modules/when/es6-shim/Promise.js",
             "../../lib/loader.js",
             "../../lib/system.js");

System['import']('es6').then(function(m) {
  postMessage(m.p);
}, function(err) {
  console.error(err, err.stack);
});
