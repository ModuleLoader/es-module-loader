/*
 * Traceur and Babel transpile hook for Loader
 */
(function(Loader) {
  // Returns an array of ModuleSpecifiers
  var transpiler, transpilerModule;

  // use Traceur by default
  Loader.prototype.transpiler = 'traceur';

  Loader.prototype.transpile = function(load) {
    if (!transpiler) {
      transpilerModule = this.get('@' + this.transpiler);

      if (transpilerModule) {
        transpilerModule = transpilerModule['default'];
      }
      else {
        transpilerModule = __global[this.transpiler];
        if (!transpilerModule && typeof require != 'undefined') {
          var curSystem = __global.System;
          transpilerModule = require(this.transpiler == 'babel' ? 'babel-core' : 'traceur');
          __global.System = curSystem;
        }
        if (!transpilerModule)
          throw new TypeError('Include Traceur or Babel for module syntax support.');
        this.set('@' + this.transpiler, this.newModule({ 'default': transpilerModule, __useDefault: true }));
      }

      if (this.transpiler == 'babel')
        transpiler = babelTranspile;
      else if (this.transpiler == 'traceur')
        transpiler = traceurTranspile;
    }

    return 'var __moduleAddress = "' + load.address + '";' + transpiler.call(this, load);
  }

  function traceurTranspile(load) {
    var options = this.traceurOptions || {};
    options.modules = 'instantiate';
    options.script = false;
    options.sourceMaps = 'inline';
    options.filename = load.address;
    options.inputSourceMap = load.metadata.sourceMap;

    var compiler = new transpilerModule.Compiler(options);
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

  function babelTranspile(load) {
    var options = this.babelOptions || {};
    options.modules = 'system';
    options.sourceMap = 'inline';
    options.filename = load.address;
    options.code = true;
    options.ast = false;
    options.blacklist = options.blacklist || [];
    options.blacklist.push('react');

    var source = transpilerModule.transform(load.source, options).code;

    // add "!eval" to end of Babel sourceURL
    // I believe this does something?
    return source + '\n//# sourceURL=' + load.address + '!eval';
  }


})(__global.LoaderPolyfill);