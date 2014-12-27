/*
 * 6to5-specific Parsing Code for Loader
 */
(function(Loader) {
  // parse function is used to parse a load record
  // Returns an array of ModuleSpecifiers
  var to5;

  Loader.prototype.parse = function(load) {
    if (!to5) {
      if (typeof window == 'undefined' &&
         typeof WorkerGlobalScope == 'undefined')
        to5 = require('6to5');
      else if (__global.to5)
        to5 = __global.to5;
      else
        throw new TypeError('Include 6to5 for module syntax support');
    }

    load.isDeclarative = true;

    var options = this.parseOptions || {};
    options.modules = 'system';
    options.sourceMap = 'inline';
    options.filename = load.address;
    options.code = true;
    options.ast = false;
    options.runtime = true;

    var source = to5.transform(load.source, options).code;

    if (!source)
      throw new Error('Error evaluating module ' + load.address);

    // add "!eval" to end of 6to5 sourceURL
    // I believe this does something?
    source = 'var __moduleAddress = "' + load.address + '";' + source + '!eval';

    __eval(source, __global, load);
  }
})(__global.LoaderPolyfill);