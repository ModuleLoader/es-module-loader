//

(function (__global) {

  var customLoader = new System.constructor();
  customLoader.hook('resolve', function(name, parentName, metadata) {
    return new Promise(function (resolve, reject) {
      if (name == 'asdfasdf')
        return setTimeout(function () {
          resolve('base/test/loader/async-norm.js');
        }, 10);

      if (name.substr(0, 5) == 'path/')
        name = 'base/test/loader/' + name.substr(5) + '.js';

      if (name == 'error1.js')
        return setTimeout(function () { reject('error1'); }, 100);

      if (name.substr(0, 5) == 'error')
        resolve(name);

      var normalized = System.resolve(name, parentName, metadata);
      resolve(normalized);
    });
  });

  customLoader.hook('fetch', function(url) {
    if (url == 'error2')
      throw 'error2';

    if (url == 'error3' || url == 'error4')
      return 'asdf';

    return System.hook('fetch').apply(this, arguments);
  });

  customLoader.hook('translate', function(url, source) {
    if (url == 'error3')
      return new Promise(function (resolve, reject) {
        setTimeout(function () { reject('error3'); }, 100);
      });

    return source;
  });

  customLoader.hook('instantiate', function(url, source, metadata) {
    if (url == 'error4')
      return new Promise(function (resolve, reject) {
        setTimeout(function () { reject('error4'); }, 100);
      });
    
    // very bad AMD support
    if (source.indexOf('define') == -1)
      return System.hook('instantiate').apply(this, arguments);

    var factory, deps;
    var define = function(_deps, _factory) {
      deps = _deps;
      factory = _factory;
    };

    eval(source);

    // normalize all dependencies now
    var importPromises = [];
    for (var i = 0; i < deps.length; i++)
      importPromises.push(Promise.resolve(customLoader.import(deps[i] + '.js', url)));

    return Promise.all(importPromises).then(function(resolvedDeps) {
      var module = factory.apply(null, resolvedDeps);
      return new Reflect.Module(module);
    });
  });

  if (typeof exports === 'object')
    module.exports = customLoader;

  __global.customLoader = customLoader;
}(typeof window != 'undefined' ? window : global));
