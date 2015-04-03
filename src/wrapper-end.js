  // -- exporting --

  if (typeof exports === 'object')
    module.exports = Loader;

  __global.Reflect = __global.Reflect || {};
  __global.Reflect.Loader = __global.Reflect.Loader || Loader;
  __global.Reflect.global = __global.Reflect.global || __global;
  __global.LoaderPolyfill = Loader;

  if (typeof exports === 'object')
    module.exports = System;

  __global.System = System;

})(typeof window != 'undefined' ? window : (typeof WorkerGlobalScope != 'undefined' ? self : global));