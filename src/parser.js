/*
 * Traceur and 6to5 Parsing Code for Loader
 */
(function(Loader) {
  // parse function is used to parse a load record
  // Returns an array of ModuleSpecifiers
  var parser, parserModule, parserName, parserOptionsName;

  // use Traceur by default
  Loader.prototype.parser = 'traceur';

  Loader.prototype.parse = function(load) {
    if (!parser) {
      parserName = this.parser == '6to5' ? 'to5' : this.parser;

      // try to pick up parser from global or require
      if (typeof window == 'undefined' && typeof WorkerGlobalScope == 'undefined')
        parserModule = require(this.parser);
      else
        parserModule = __global[parserName];
      
      if (!parserModule)
        throw new TypeError('Include Traceur or 6to5 for module syntax support');

      parser = this.parser == '6to5' ? to5Parse : traceurParse;
    }

    var source = parser.call(this, load);

    source = 'var __moduleAddress = "' + load.address + '";' + source;

    __eval(source, __global, load);
  }

  function traceurParse(load) {
    var options = this.traceurOptions || {};
    options.modules = 'instantiate';
    options.script = false;
    options.sourceMaps = 'inline';
    options.filename = load.address;

    var compiler = new parserModule.Compiler(options);
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

  function to5Parse(load) {
    var options = this.to5Options || {};
    options.modules = 'system';
    options.sourceMap = 'inline';
    options.filename = load.address;
    options.code = true;
    options.ast = false;

    var source = parserModule.transform(load.source, options).code;

    // add "!eval" to end of 6to5 sourceURL
    // I believe this does something?
    return source + '\n//# sourceURL=' + load.address + '!eval';
  }


})(__global.LoaderPolyfill);