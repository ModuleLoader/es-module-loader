importScripts("../../node_modules/when/es6-shim/Promise.js",
             "../../dist/es6-module-loader-declarative.src.js");

System.loader.site.set('traceur', '../../node_modules/traceur/bin/traceur.js');

System.loader['import']('es6.js').then(function(m) {
  postMessage(m.p);
}, function(err) {
  console.error(err, err.stack);
});
