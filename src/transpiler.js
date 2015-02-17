/*
 * Traceur and 6to5 transpile hook for Loader
 */
(function(Loader) {
  // Returns an array of ModuleSpecifiers
  var transpiler, transpilerModule;
  var isNode = typeof window == 'undefined' && typeof WorkerGlobalScope == 'undefined';

  // use Traceur by default
  Loader.prototype.transpiler = 'traceur';

  Loader.prototype.transpile = function(load) {
    if (!transpiler) {
      if (this.transpiler == '6to5') {
        transpiler = to5Transpile;
        transpilerModule = isNode ? require('6to5-core') : __global.to5;
      }
      else {
        transpiler = traceurTranspile;
        transpilerModule = isNode ? require('traceur') : __global.traceur;
      }
      
      if (!transpilerModule)
        throw new TypeError('Include Traceur or 6to5 for module syntax support.');
    }

    return 'var __moduleAddress = "' + load.address + '";' + transpiler.call(this, load);
  }

  function traceurTranspile(load) {
    var options = this.traceurOptions || {};
    options.modules = 'instantiate';
    options.script = false;
    options.sourceMaps = 'inline';
    options.filename = load.address;

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

  function to5Transpile(load) {
    var options = this.to5Options || {};
    options.modules = 'system';
    options.sourceMap = 'inline';
    options.filename = load.address;
    options.code = true;
    options.ast = false;
    options.blacklist = options.blacklist || [];
    options.blacklist.push('react');

    var source = transpilerModule.transform(load.source, options).code;

    // add "!eval" to end of 6to5 sourceURL
    // I believe this does something?
    return source + '\n//# sourceURL=' + load.address + '!eval';
  }


})(__global.LoaderPolyfill);