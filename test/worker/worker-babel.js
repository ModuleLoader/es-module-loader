importScripts("../../node_modules/babel-core/browser.js",
             "../../node_modules/when/es6-shim/Promise.js",
             "../../dist/es6-module-loader.src.js"
             );

System.transpiler = 'babel';

System['import']('es6').then(function(m) {
  postMessage(m.p);
}, function(err) {
  console.error(err, err.stack);
});