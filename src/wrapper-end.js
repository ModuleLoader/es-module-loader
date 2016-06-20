
  // ---------- Export Definitions ----------  
    
  var Reflect;

  var loader = new SystemLoader();
  loader.constructor = SystemLoader;

  if (cjsMode) {
    exports.Loader = Loader;
    exports.Module = Module;
    exports.SystemLoader = SystemLoader;
  }

  __global.LoaderPolyfill = Loader;
  __global.ModulePolyfill = Module;

  __global.Reflect = __global.Reflect || {};
  __global.Reflect.Module = __global.Reflect.Module || Module;
  __global.Reflect.Loader = __global.Reflect.Loader || Loader;

  __global.System = __global.System || {};
  __global.System.global = __global.System.global || __global;
  __global.System.loader = __global.System.loader || loader;

})(typeof window != 'undefined' ? window : (typeof WorkerGlobalScope != 'undefined' ? self : global));
