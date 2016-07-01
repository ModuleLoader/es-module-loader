importScripts("../../node_modules/when/es6-shim/Promise.js",
             "../../dist/es6-module-loader-declarative.src.js");

System.transpiler = 'babel';
System.loader.site.set('babel', '../../node_modules/babel-core/browser.js');

System.loader['import']('es6.js').then(function(m) {
  postMessage(m.p);
}, function(err) {
  console.error(err, err.stack);
});
