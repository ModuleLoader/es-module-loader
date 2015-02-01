importScripts("../../node_modules/6to5-core/browser.js",
             "../../node_modules/when/es6-shim/Promise.js",
             "../../dist/es6-module-loader.src.js"
             );

System.transpiler = '6to5';

System['import']('es6').then(function(m) {
  postMessage(m.p);
}, function(err) {
  console.error(err, err.stack);
});