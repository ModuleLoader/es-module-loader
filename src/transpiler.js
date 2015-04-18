/*
 * Traceur and Babel transpile hook for Loader
 */

function setupTranspilers(loader) {
  // pick up Transpiler modules from existing globals on first run if set
  if (__global.traceur && !loader.has('traceur'))
    loader.set('traceur', loader.newModule({ 'default': __global.traceur, __useDefault: true }));
  if (__global.babel && !loader.has('babel'))
    loader.set('babel', loader.newModule({ 'default': __global.babel, __useDefault: true }));
}

var transpile = (function() {

  // use Traceur by default
  Loader.prototype.transpiler = 'traceur';

  function transpile(load) {
    var self = this;
    
    return (self.pluginLoader || self)['import'](self.transpiler).then(function(transpiler) {
      if (transpiler.__useDefault)
        transpiler = transpiler['default'];

      return 'var __moduleName = "' + load.name + '", __moduleAddress = "' + load.address + '";'
          + (transpiler.Compiler ? traceurTranspile : babelTranspile).call(self, load, transpiler)
          + '\n//# sourceURL=' + load.address + '!eval';

      // sourceURL and sourceMappingURL:
      //   Ideally we wouldn't need a sourceURL and would just use the sourceMap.
      //   But without the sourceURL as well, line-by-line debugging doesn't work.
      //   We thus need to ensure the sourceURL is a different name to the original
      //   source, and hence the !eval suffix.
    });
  };

  Loader.prototype.instantiate = function(load) {
    var self = this;
    return Promise.resolve(self.normalize(self.transpiler))
    .then(function(transpilerNormalized) {
      // load transpiler as a global (avoiding System clobbering)
      if (load.name === transpilerNormalized) {
        return {
          deps: [],
          execute: function() {
            var curSystem = __global.System;
            var curLoader = __global.Reflect.Loader;
            // ensure not detected as CommonJS
            __eval('(function(require,exports,module){' + load.source + '})();', load.address, __global);
            __global.System = curSystem;
            __global.Reflect.Loader = curLoader;
            return self.newModule({ 'default': __global[load.name], __useDefault: true });
          }
        };
      }
    });
  };

  function traceurTranspile(load, traceur) {
    var options = this.traceurOptions || {};
    options.modules = 'instantiate';
    options.script = false;
    options.sourceMaps = 'inline';
    options.filename = load.address;
    options.inputSourceMap = load.metadata.sourceMap;
    options.moduleName = false;

    var compiler = new traceur.Compiler(options);

    return doTraceurCompile(load.source, compiler, options.filename);
  }
  function doTraceurCompile(source, compiler, filename) {
    try {
      return compiler.compile(source, filename);
    }
    catch(e) {
      // traceur throws an error array
      throw e[0];
    }
  }

  function babelTranspile(load, babel) {
    var options = this.babelOptions || {};
    options.modules = 'system';
    options.sourceMap = 'inline';
    options.filename = load.address;
    options.code = true;
    options.ast = false;

    return babel.transform(load.source, options).code;
  }

  return transpile;
})();