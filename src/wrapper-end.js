
  // ---------- Export Definitions ----------  
    
  var Reflect;

  System = new SystemLoader();
  System.constructor = SystemLoader;

  (function(exports) {

    Reflect = exports.Reflect || {};

    Reflect.Loader = Reflect.Loader || Loader;
    Reflect.Module = Reflect.Module || Module;
    Reflect.global = Reflect.global || __global;

    exports.LoaderPolyfill = Loader;
    exports.ModulePolyfill = Module;
    exports.Reflect = Reflect;
    exports.System = System;

  })(cjsMode ? exports : __global);

  //module.exports = exports;

})(typeof window != 'undefined' ? window : (typeof WorkerGlobalScope != 'undefined' ? self : global));
