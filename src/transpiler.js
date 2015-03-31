  // ---------- Transpiler Hooks ----------

  // Returns an array of ModuleSpecifiers
  var transpiler, transpilerModule;

  // use Traceur by default
  Loader.prototype.transpiler = 'traceur';

  Loader.prototype.transpile = function(key, source, metadata) {
    if (!transpiler) {
      if (this.transpiler == 'babel') {
        transpilerModule = cjsMode ? require('babel-core') : __global.babel;
        if (!transpilerModule)
          throw new TypeError('Unable to find the Babel transpiler.');
        transpiler = babelTranspile;
      }
      else {
        transpilerModule = cjsMode ? require('traceur') : __global.traceur;
        if (!transpilerModule)
          throw new TypeError('Unable to find the Traceur transpiler.');
        transpiler = traceurTranspile;
      }
    }

    // transpile to System register and evaluate out the { deps, declare } form
    return evaluateSystemRegister(key, transpiler.call(this, key, source, metadata));
  }

  function traceurTranspile(key, source, metadata) {
    var options = this.traceurOptions || {};
    options.modules = 'instantiate';
    options.script = false;
    options.sourceMaps = 'inline';
    options.inputSourceMap = metadata.sourceMap;
    options.filename = key;

    var compiler = new transpilerModule.Compiler(options);
    var source = doTraceurCompile(source, compiler, options.filename);

    // add "!eval" to end of Traceur sourceURL
    source += '!eval';

    return source;
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

  function babelTranspile(key, source, metadata) {
    var options = this.babelOptions || {};
    options.modules = 'system';
    options.sourceMap = 'inline';
    options.filename = key;
    options.code = true;
    options.ast = false;

    // We blacklist JSX because transpiling needs to take us only as far as
    // the baseline ES features that exist when loaders are widely natively
    // supported. This allows experimental features, but features certainly
    // not in ES* won't make sense here so we try to encourage good habits.
    options.blacklist = options.blacklist || [];
    options.blacklist.push('react');

    var source = transpilerModule.transform(source, options).code;

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

    doEval(source);

    curSystem .register = curRegister;
    // console.assert(registration);
    return registration;
  }

  function doEval(source) {
    try {
      // closest we can get to undefined 'this'
      // we use eval over new Function because of source maps support
      // NB retry Function again here
      eval.call(null, source);
    }
    catch(e) {
      if (e.name == 'SyntaxError' || e.name == 'TypeError')
        e.message = 'Evaluating ' + key + '\n\t' + e.message;
      throw e;
    }
  }

