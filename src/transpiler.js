  // ---------- Transpiler Hooks ----------

  // use Traceur by default
  Loader.prototype.transpiler = 'traceur';

  var transpilerName, transpilerModule, transpilerResolved;

  var firstTranspile = true;
  function checkTranspilerGlobals(loader) {
    try {
      if (__global.traceur)
        loader.install('traceur', new Module({ 'default': __global.traceur }));
      else if (__global.babel)
        loader.install('babel', new Module({ 'default': __global.babel }));
    }
    catch(e) {}
  }

  function loadTranspiler(loader) {
    if (firstTranspile) {
      checkTranspilerGlobals(loader);
      firstTranspile = false;
    }

    var transpiler = loader.transpiler;

    if (transpiler === transpilerName && transpilerModule)
      return;

    transpilerName = transpiler;
    transpilerModule = transpilerResolved = null;
    
    return loader['import'](transpiler).then(function(transpiler) {
      transpilerModule = transpiler['default'];
    });
  }

  function transpile(loader, key, source, metadata) {
    // transpile to System register and evaluate out the { deps, declare } form
    // set the __moduleURL temporary meta for contextual imports
    return evaluateSystemRegister(key, 
        (transpilerModule.Compiler ? traceurTranspile : babelTranspile)(transpilerModule, key, source, metadata));
  }

  // transpiler instantiate to ensure transpiler is loaded as a global
  function systemInstantiate(key, source, metadata) {
    var loader = this;

    return Promise.resolve(transpilerName === loader.transpiler && transpilerResolved 
        || loader.resolve(transpilerName = loader.transpiler))
    .then(function(resolved) {
      transpilerResolved = resolved;
      if (transpilerResolved === key)
        return function() {
          // avoid Traceur System clobbering
          var curSystem = __global.System;
          var curLoader = __global.Reflect.Loader;
          // load transpiler as a global, not detected as CommonJS
          doEval(key, '~function(require,exports,module){' + source + '}()');
          __global.System = curSystem;
          __global.Reflect.Loader = curLoader;
          return new Module({ 'default': __global[loader.transpiler] });
        };
    });
  };

  function traceurTranspile(traceur, key, source, metadata) {
    var options = this.traceurOptions || {};
    options.modules = 'instantiate';
    options.script = false;
    options.sourceMaps = 'inline';
    options.inputSourceMap = metadata.sourceMap;
    options.filename = key;
    options.inputSourceMap = metadata.sourceMap;
    options.moduleName = false;

    var compiler = new traceur.Compiler(options);
    var source = doTraceurCompile(source, compiler, options.filename);

    // add "!eval" to end of Traceur sourceURL
    // this way the source map can use the original name
    return source + '!eval';
  }
  function doTraceurCompile(source, compiler, filename) {
    try {
      return compiler.compile(source, filename);
    }
    catch(e) {
      // traceur throws an error array
      throw e[0] || e;
    }
  }

  function babelTranspile(babel, key, source, metadata) {
    var options = this.babelOptions || {};
    options.modules = 'system';
    options.sourceMap = 'inline';
    options.filename = key;
    options.code = true;
    options.ast = false;

    // encourage a sensible baseline
    if (!options.blacklist)
      options.blacklist = ['react'];

    var source = babel.transform(source, options).code;

    // add "!eval" to end of Babel sourceURL
    return source + '\n//# sourceURL=' + key + '!eval';
  }

  function evaluateSystemRegister(key, source) {
    var curSystem = __global.System = __global.System || System;

    var registration;

    // Hijack System .register to set declare function
    var curRegister = curSystem .register;
    curSystem .register = function(deps, declare) {
      registration = {
        deps: deps,
        declare: declare
      };
    }

    doEval(key, 'var __moduleURL = "' + key + '";' + source, {});

    curSystem .register = curRegister;
    // console.assert(registration);
    return registration;
  }

  function doEval(key, source, self) {
    try {
      // self = {} closest we get to undefined this
      new Function(source).call(self);
    }
    catch(e) {
      if (e.name == 'SyntaxError' || e.name == 'TypeError')
        e.message = 'Evaluating ' + key + '\n\t' + e.message;
      throw e;
    }
  }

