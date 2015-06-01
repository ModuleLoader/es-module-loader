/*
 * Traceur, Babel and TypeScript transpile hook for Loader
 */
var transpile = (function() {

  // use Traceur by default
  Loader.prototype.transpiler = 'traceur';

  function transpile(load) {
    var self = this;

    return Promise.resolve(__global[self.transpiler == 'typescript' ? 'ts' : self.transpiler]
        || (self.pluginLoader || self)['import'](self.transpiler))
    .then(function(transpiler) {
      if (transpiler.__useDefault)
        transpiler = transpiler['default'];

      var transpileFunction;
      if (transpiler.Compiler)
        transpileFunction = traceurTranspile;
      else if (transpiler.createLanguageService)
        transpileFunction = typescriptTranspile;
      else
        transpileFunction = babelTranspile;

      return '(function(__moduleName, __moduleAddress) {'
          + transpileFunction.call(self, load, transpiler)
          + '\n}).call({}, "' + load.name + '", "' + load.address + '");'
          + '\n//# sourceURL=' + load.address + '!transpiled';

      // sourceURL and sourceMappingURL:
      //   Ideally we wouldn't need a sourceURL and would just use the sourceMap.
      //   But without the sourceURL as well, line-by-line debugging doesn't work.
      //   We thus need to ensure the sourceURL is a different name to the original
      //   source, and hence the !transpiled suffix.
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

  function typescriptTranspile(load, ts) {
    var options = this.typescriptOptions || {};
    if (options.target === undefined) {
      options.target = ts.ScriptTarget.ES5;
    }
    options.module = ts.ModuleKind.System;
    options.inlineSourceMap = true;

    var source = ts.transpile(load.source, options, load.address);
    return source + '\n//# sourceURL=' + load.address + '!eval';;
  }

  return transpile;
})();
