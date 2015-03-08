/*
 * Traceur and Babel transpile hook for Loader
 */
(function(Loader) {
  // use Traceur by default
  Loader.prototype.transpiler = 'traceur';

  Loader.prototype.transpile = function(load) {
    return this['import'](this.transpiler).then(function(transpiler) {
      if (transpiler.__useDefault)
        transpiler = transpiler['default'];
      return 'var __moduleAddress = "' + load.address + '";' + (transpiler.Compiler ? traceurTranspile : babelTranspile).call(this, load, transpiler);
    });
  }

  var g = __global;

  Loader.prototype.instantiate = function(load) {
    // load transpiler as a global (avoiding System clobbering)
    if (load.name === this.transpiler)
      return {
        deps: [],
        execute: function() {
          var curSystem = g.System;
          var curLoader = g.Reflect.Loader;
          __eval('(function(require,exports,module){' + load.source + '})();', g, load);
          g.System = curSystem;
          g.Reflect.Loader = curLoader;
          return System.newModule({ 'default': g[load.name], __useDefault: true });
        }
      };
  }

  function traceurTranspile(load, traceur) {
    var options = this.traceurOptions || {};
    options.modules = 'instantiate';
    options.script = false;
    options.sourceMaps = 'inline';
    options.filename = load.address;
    options.inputSourceMap = load.metadata.sourceMap;

    var compiler = new traceur.Compiler(options);
    var source = doTraceurCompile(load.source, compiler, options.filename);

    // add "!eval" to end of Traceur sourceURL
    // I believe this does something?
    source += '!eval';

    return source;
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
    
    if (!options.blacklist)
      options.blacklist = ['react'];

    var source = babel.transform(load.source, options).code;

    // add "!eval" to end of Babel sourceURL
    // I believe this does something?
    return source + '\n//# sourceURL=' + load.address + '!eval';
  }


})(__global.LoaderPolyfill);