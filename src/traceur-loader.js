/*
 * Traceur-specific Parsing Code for Loader
 */
(function(Loader) {
  // parse function is used to parse a load record
  // Returns an array of ModuleSpecifiers
  var traceur;

  function doCompile(source, compiler, filename) {
    try {
      return compiler.compile(source, filename);
    }
    catch(e) {
      // traceur throws an error array
      throw e[0];
    }
  }
  Loader.prototype.parse = function(load) {
    if (!traceur) {
      if (typeof window == 'undefined' &&
         typeof WorkerGlobalScope == 'undefined')
        traceur = require('traceur');
      else if (__global.traceur)
        traceur = __global.traceur;
      else
        throw new TypeError('Include Traceur for module syntax support');
    }

    console.assert(load.source, 'Non-empty source');

    load.isDeclarative = true;

    var options = this.parseOptions || {};
    options.modules = 'instantiate';
    options.script = false;
    options.sourceMaps = 'inline';
    options.filename = load.address;

    var compiler = new traceur.Compiler(options);

    var source = doCompile(load.source, compiler, options.filename);

    if (!source)
      throw new Error('Error evaluating module ' + load.address);

    var sourceMap = compiler.getSourceMap();

    if (__global.btoa && sourceMap) {
      // add "!eval" to end of Traceur sourceURL
      // I believe this does something?
      source += '!eval';
    }

    source = 'var __moduleAddress = "' + load.address + '";' + source;

    __eval(source, __global, load);
  }
})(__global.LoaderPolyfill);