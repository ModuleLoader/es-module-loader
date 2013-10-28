/*
 * es6-module-loader
 * https://github.com/addyosmani/es6-module-loader
 *
 * Copyright (c) 2013 Guy Bedford, Luke Hoban, Addy Osmani
 * Licensed under the MIT license.
 */
(function () {

  (function() {

    var isBrowser = typeof window != 'undefined';
    var global = isBrowser ? window : exports;

    var defineProperty = function(obj, prop, opt) {
      if (Object.defineProperty)
        Object.defineProperty(obj, prop, opt);
      else
        obj[prop] = opt.value || opt.get.call(obj);
    };

    var indexOf = Array.prototype.indexOf || function (item) { // Define an IE-friendly shim good-enough for purposes
      for (var i = 0, thisLen = this.length; i < thisLen; i++) {
        if (this[i] === item) {
            return i;
        }
      }
      return -1;
    };

    // new Loader( options ) - Module loader constructor
    // The Loader constructor creates a new loader. The argument is the
    // options object
    //
    // options.global - The loader's global object
    // options.intrinsics - The loader's intrinsic methods
    // options.strict -  should code evaluated in the loader be in strict mode?
    // options.normalize( request [, referer] ) - normalize hook
    // options.resolve( normalized, { referer, metadata } ) - The URL resolution hook
    // options.fetch( resolved, fulfill, reject, { normalized, referer, metadata } ) - The module loading hook
    // options.translate( source, { normalized, address, metadata, type } ) - source translation hook
    // options.link( source, { normalized, address, metadata, type } ) - the link hook
    function Loader(options) {

      // Initialization of loader state from options

      this.global = options.global || window;
      this.strict = !!options.strict;
      this.normalize = options.normalize || global.System.normalize;
      this.resolve = options.resolve || global.System.resolve;
      this.fetch = options.fetch || global.System.fetch;
      this.translate = options.translate || global.System.translate;
      this.link = options.link || global.System.link;

      // The internal table of module instance objects
      this._mios = {};

      // the internal table of loaded scripts
      this._sloaded = {};
      
      // modules currently loading
      // key is normalized name, value is an array of callback functions to be queued (optional)
      this._mloads = {};
      // scripts 
      this._sloads = {};
    }


    // Loader.prototype.load( address, callback, errback [, referer = null] )
    //
    // The load method takes a string representing a module URL and a
    // callback that receives the result of loading, compiling, and
    // executing the module at that URL. The compiled code is statically
    // associated with this loader, and its URL is the given URL. The
    // additional callback is used if an error occurs.
    //
    // load will handle import statements, but export statements are a
    // syntax error
    Loader.prototype.load = function (url, callback, errback) {
      var self = this;
      if (url instanceof Array) {
        var scriptCnt = 0;
        for (var i = 0; i < url.length; i++) (function (i) {
          self.load(url[i], function () {
            scriptCnt++;
            if (scriptCnt == url.length) {
              callback && callback();
            }
          }, errback)
        })(i);
        return;
      }

      if (this._sloaded[url]) {
        callback && callback();
        return;
      }

      // store the callbacks in a load queue for multiple requests
      if (this._sloads[url]) {
        this._sloads[url].push({
          callback: callback,
          errback: errback
        });
        return;
      }
      else {
        this._sloads[url] = [{
          callback: callback, 
          errback: errback
        }];
      }
      var _callback = function() {
        for (var i = 0; i < self._sloads[url].length; i++)
          self._sloads[url][i].callback && self._sloads[url][i].callback();
        delete self._sloads[url];
      }
      var _errback = function(err) {
        var allCalled = true;
        for (var i = 0; i < self._sloads[url].length; i++) {
          if (self._sloads[url][i].errback) {
            self._sloads[url][i].errback(err);
          }
          else {
            allCalled = false;
          }
        }
        delete self._sloads[url];
        // if any didn't have an error handler, throw
        if (!allCalled)
          throw err;
      }

      this.fetch(url, function (source) {
        var opt = {
          address: url,
          type: 'script'
        };
        source = self.translate(source, opt);

        self._linkExecute(url, source, opt, _callback, _errback, true);
      }, _errback);
    };

    // Loader.prototype.import( name, callback, errback, referer = null )
    // Asynchronously load a module or sequence of modules by name.
    Loader.prototype['import'] = function (name, callback, errback, referer) {
      var self = this;
      if (name instanceof Array) {
        var modules = [];
        var moduleCnt = 0;
        var self = this;
        for (var i = 0; i < name.length; i++) (function(i) {
          Loader.prototype['import'].call(self, name[i], function(m) {
            modules[i] = m;
            moduleCnt++;
            if (moduleCnt == name.length) {
              callback && callback.apply(null, modules);
            }
          }, errback, referer);
        })(i);
        return;
      }

      name = this.normalize(name, referer);

      var opt = {
        referer: referer,
        metadata: typeof name == 'object' ? name.metadata : null
      };
      // name is now the normalized name in this function
      if (typeof name != 'string') {
        name = name.normalized;
      }

      if (this._mios[name]) {
        return callback && callback(this._mios[name]);
      }

      // store the callbacks in a load queue for multiple requests
      if (this._mloads[name]) {
        this._mloads[name].push({
          callback: callback,
          errback: errback
        });
        return;
      }
      else {
        this._mloads[name] = [{
          callback: callback, 
          errback: errback
        }];
      }
      var _callback = function(module) {
        self._mios[name] = module;
        for (var i = 0; i < self._mloads[name].length; i++)
          self._mloads[name][i].callback && self._mloads[name][i].callback(module);
        delete self._mloads[name];
      }
      var _errback = function(err) {
        var allCalled = true;
        if (!self._mloads[name])
          throw err;
        for (var i = 0; i < self._mloads[name].length; i++) {
          if (self._mloads[name][i].errback) {
            self._mloads[name][i].errback(err);
          }
          else {
            allCalled = false;
          }
        }
        delete self._mloads[name];
        // if any didn't have an error handler, throw
        if (!allCalled)
          throw err;
      }

      var url = this.resolve(name, opt);

      if (typeof url != 'string') {
        url = url.address;
        // NB what to do with 'extra'?
      }

      opt.normalized = name;

      this.fetch(url, function(source) {
        opt.address = url;
        opt.type = 'module';
        source = self.translate(source, opt);
        self._linkExecute(name, source, opt, _callback, _errback);
      }, _errback, opt);
    };

    // Loader.prototype.fetch
    // NB spec issue here - this clashes with the instance fetch function!?

    // _linkExecute - private function
    // given a normalized module name, the source, and the options metadata
    // run the link and execute hooks, with the callback returning the 
    // defined module object
    // isScript = true implies loading a script so don't define exports
    var evalCnt = 0;
    Loader.prototype._linkExecute = function (name, source, opt, callback, errback) {
      // when no name is given,
      // provide a unique name to cache the syntax tree parsing
      if (!name) {
        name = '__eval' + evalCnt++;
      }

      var isScript = opt.type == 'script';

      var link = this.link(source, opt);

      // 1. module
      if (link instanceof Module && !isScript) {
        return callback(link);
      }

      // preload esprima if necessary
      var self = this;
      var linkSpecified = typeof link == 'object' && !isScript;
      (!linkSpecified ? ES6Parser.loadEsprima : function(name, source, callback) { callback(); }).call(ES6Parser, name, source, function() {
        var imports, execute;
        // 2. specified imports and execute
        if (linkSpecified) {
          imports = link.imports;
          execute = link.execute;
        }
        // 3. undefined -> default
        else {
          var defaultLink = self._link(source, opt);
          imports = defaultLink.imports;
          execute = defaultLink.execute;
        }

        // stops an unnecessary load cascade
        if (errback.called)
          return;

        if (!imports.length)
          return callback(execute.call(self));

        opt.normalizeMap = {};

        var deps = [];
        var depCnt = 0;
        for (var i = 0; i < imports.length; i++) (function(i) {
          var referer = { name: name, address: opt.address };

          // run the normalization to get the canonical module name
          // to allow imports to be loaded
          var normalized = self.normalize(imports[i], referer);

          if (typeof normalized == 'object')
            normalized = normalized.normalized;

          opt.normalizeMap[imports[i]] = normalized;

          Loader.prototype['import'].call(self, imports[i], function (module) {
            depCnt++;
            deps[i] = module;
            if (depCnt == imports.length) {
              try {
                var output = execute.apply(self, deps);
              }
              catch(e) {
                errback('Error executing ' + name + '.\n' + e);
                return;
              }
              callback(output);
            }
          }, errback, referer);
        })(i);

      }, errback);
    };

    Loader.prototype._link = function(source, opt) {
      var self = this;
      return {
        imports: ES6Parser.parseImports(opt.normalized, source),
        execute: function() {
          var exports;
          // parses export statements and evaluates in the correct context
          // returning the exports object
          exports = ES6Parser.parseEval(source, self, {
            name: opt.normalized,
            sourceURL: opt.address, 
            isEval: opt.type == 'script',
            normalizeMap: opt.normalizeMap
          });
          // only return exports for a module when not doing script eval
          if (opt.normalized && opt.type != 'script')
            return new Module(exports || {});
        }
      };
    }


    // Loader.prototype.eval( source )
    // Synchronously executes a Script non-terminal. 
    // If the compilation process results in a fetch, a SyntaxError is thrown.
    // The compiled code is statically associated with this loader.
    Loader.prototype.eval = function (source) {
      ES6Parser.parseEval(source, this, {
        isEval: true
      });
    };

    // Loader.prototype.parseEval( source )
    // Asynchronously executes a Script non-terminal.
    // The compiled code is statically associated with this loader.
    Loader.prototype.evalAsync = function (source, callback, errback) {
      // links and then evals
      this._linkExecute(null, source, { type: 'script' }, callback || function() {}, errback || function() {});
    }

    // Loader.prototype.get ( name )
    //
    // Look up a module in the loader’s registry, using a name that is assumed 
    // to be normalized.
    Loader.prototype.get = function (name) {
      return this._mios[name] || null;
    };


    // Loader.prototype.set( name, mod )
    //
    // Stores (possibly overwriting) a module instance object 
    // in the loader’s registry, using a name that is assumed to be normalized.
    Loader.prototype.set = function (name, mod) {
      this._mios[name] = new Module(mod);
    };

    Loader.prototype.has = function (name) {
      return !!this._mios[name];
    };

    Loader.prototype['delete'] = function (name) {
      delete this._mios[name];
    };

    // Loader.prototype.defineBuiltins( [ obj ] )
    //
    // The defineBuiltins method takes an object and defines all the built-in
    // objects and functions of the ES6 standard library associated with this
    // loader's intrinsics as properties on the object.
    Loader.prototype.defineBuiltins = function (o) {
      for (var p in o) {
        if (o.hasOwnProperty(p)) {
          this.global[p] = o[p];
        }
      }
    };


    function Module (o) {
      
      if (typeof o != 'object') throw new TypeError("Expected object");
      
      if (o instanceof Module) {
        return o;
      } else {
        var self = this;
        for (var key in o) {
          (function (key) {
            defineProperty(self, key, {
              configurable: false,
              enumerable: true,
              get: function () {
                return o[key];
              }
            });
          })(key);
        }
      }
    };


    // Pre-configured Loader instance for easier use
    var absUrlRegEx = /^\/|([^\:\/]*:\/\/)/;
    var isAbsoluteUrl = function(name) {
      return name.match(absUrlRegEx);
    }
    var fetch;
    if (isBrowser) {
      fetch = function(url, fulfill, reject) {
        if (window.ActiveXObject) {
          var xhr = new ActiveXObject('Microsoft.XMLHTTP');
        }
        else {
          var xhr = new XMLHttpRequest();
        }
        xhr.onreadystatechange = function () {
          if (xhr.readyState === 4) {
            if (xhr.status === 200 || (xhr.status == 0 && xhr.responseText)) {
              fulfill(xhr.responseText);
            } else {
              reject(xhr.statusText + ': ' + url || 'XHR error');
            }
          }
        };
        xhr.open("GET", url, true);
        xhr.send(null);
      }
    }
    else {
      var fs = require('fs');
      fetch = function(url, fulfill, reject) {
        return fs.readFile(url, function(err, data) {
          if (err)
            return reject(err);
          else
            fulfill(data + '');
        });
      }
    }

    // '../a/b', '../c/d/e' -> '../c/a/b'
    var resolvePath = function(name, parentName) {
      if (!parentName)
        return name;

      // all resolutions in this function are relative
      if (name.substr(0, 2) == './')
        name = name.substr(2);

      // anything after the last slash is assumed a file name
      var lastSlash = parentName.lastIndexOf('/');
      if (lastSlash == -1)
        return name;
      if (lastSlash != parentName.length - 1)
        parentName = parentName.substr(0, lastSlash + 1);

      // simple additive resolution (most cases)
      if (name.substr(0, 1) != '.')
        return parentName + name;

      // begin backtracking
      var parentParts = parentName.split('/');
      var nameParts = name.split('/');

      parentParts.pop();

      var curPart;
      while (nameParts[0] == '..') {
        curPart = nameParts.shift();
        if (!parentParts.length || parentParts[parentParts.length - 1] == '..')
          parentParts.push('..');
        else
          parentParts.pop();
      }

      return parentParts.join('/') + (parentParts.length ? '/' : '') + nameParts.join('/');
    }

    var defaultSystemLoader = new Loader({
      global: isBrowser ? window : global,
      strict: true,
      normalize: function(name, referer) {
        if (isAbsoluteUrl(name))
          return name;
        if (name.substr(0, 1) == '.')
          return resolvePath(name, referer && referer.name);
        else
          return name;
      },
      resolve: function (name, options) {
        for (var r in this.ondemandTable) {
          if (indexOf.call(this.ondemandTable[r], name) != -1) {
            return r;
          }
        }
        if (isAbsoluteUrl(name))
          return name;

        return resolvePath(name + '.js', this.baseURL + (this.baseURL.charAt(this.baseURL.length - 1) != '/' ? '/' : ''));
      },
      fetch: fetch,
      translate: function (source, options) {
				if (!global.traceur || options.address == esprimaSrc)
					return source;
					
				var traceur = global.traceur;

        var project = new traceur.semantics.symbols.Project(options.address);
        traceur.options.sourceMaps = true;
				traceur.options.modules = 'parse';

        var reporter = new traceur.util.ErrorReporter();
        reporter.reportMessageInternal = function(location, kind, format, args) {
          throw kind + '\n' + location;
        }

        var sourceFile = new traceur.syntax.SourceFile(options.address, source);
        project.addFile(sourceFile);
        var res = traceur.codegeneration.Compiler.compile(reporter, project, false);

        var sourceMapGenerator = new traceur.outputgeneration.SourceMapGenerator({ file: options.address });
        var opt = { sourceMapGenerator: sourceMapGenerator };

        source = traceur.outputgeneration.ProjectWriter.write(res, opt);
        if (isBrowser)
          source += '\n//# sourceMappingURL=data:application/json;base64,' + btoa(opt.sourceMap) + '\n';

        return source;
      },
      link: function (source, options) {}
    });

    defaultSystemLoader.baseURL = isBrowser ? window.location.href.substring(0, window.location.href.lastIndexOf('\/') + 1) : './';
    defaultSystemLoader.ondemandTable = {};
    defaultSystemLoader.ondemand = function (ondemandTable) {
      for (var r in ondemandTable) {
        this.ondemandTable[r] = this.ondemandTable[r] || [];
        if (ondemandTable[r] instanceof Array)
          this.ondemandTable[r] = this.ondemandTable[r].concat(ondemandTable[r]);
        else
          this.ondemandTable[r].push(ondemandTable[r]);
      }
    }




    // Syntax Parsing and Source Modifying Polyfills
    // esprima-based parser for module syntax, with pluggable polyfill support
    var esprimaSrc;
    var ES6Parser = {
      // iterate the entire syntax tree node object with the given iterator function
      traverse: function(object, iterator) {
        var key, child;
        if (iterator(object) === false)
          return;
        for (key in object) {
          child = object[key];
          if (typeof child == 'object' && child !== null)
            this.traverse(child, iterator);
        }
      },
      // module syntax regexs - may over-classify but not under-classify
      // simply designed as a first level check to catch any use of
      // module syntax, before loading esprima for deeper analysis
      importRegEx: /(?:^\s*|[}{\(\);,\n]\s*)import\s+./,
      exportRegEx: /(?:^\s*|[}{\(\);,\n]\s*)export\s+(\{|\*|var|class|function|default)/,
      moduleRegEx: /(?:^\s*|[}{\(\);,\n]\s*)module\s+("[^"]+"|'[^']+')\s*\{/,
      checkModuleSyntax: function(name, source) {
        if (name == null || this.parseNames[name] === undefined)
          this.parseNames[name] = source && !!(source.match(this.importRegEx) || source.match(this.exportRegEx) || source.match(this.moduleRegEx));
        return this.parseNames[name];
      },
      loadEsprima: function(name, source, callback, errback) {
        if (this.esprima)
          return callback();

        // use a regex to check if the source contains 'import', 'export' or 'module' statements
        // may incorrectly fire, but the damage is only an http request to do better parsing shortly
        if (!this.polyfills.length && !this.checkModuleSyntax(name, source))
          return callback();

        // current script tags used to produce the esprima src (converting collection to array)
        var scripts = document.getElementsByTagName('script');

        var curScript;
        for (var i = 0; i < scripts.length; i++) {
          curScript = scripts[i];
          if (curScript.src.match(/es6-module-loader(\.min)?\.js/))
            esprimaSrc = curScript.src.substr(0, curScript.src.lastIndexOf('/') + 1) + 'esprima-es6.min.js';
          else
            esprimaSrc = curScript.getAttribute('data-esprima-src');
          
          if (esprimaSrc)
            break;
        }
        var self = this;
        global.System.load(esprimaSrc, function() {
          self.esprima = global.System.global.esprima;
          callback();
        });
      },
      // store the names of modules which needed to be parsed by esprima
      parseNames: {},
      // store the syntax trees for modules parsed by esprima
      treeCache: {},
      // parse the list of import module names for a given source
      parseImports: function(name, source) {
        // regex showed no need for esprima -> return empty
        if (!this.checkModuleSyntax(name, source))
          return [];

        try {
          var tree = this.treeCache[name] || (this.treeCache[name] = this.esprima.parse(source, { range: true }));
        }
        catch(e) {
          e.message = 'Esprima parser error in "' + name + '"\n ' + e.message;
          throw e;
        }
        var imports = [];
        this.traverse(tree, function(node) {

          if (node.type == 'ImportDeclaration') {
            imports.push(node.source.value);
          }
          // export * from 'foo';
          // export { ... } from 'foo';
          else if (node.type == 'ExportDeclaration' && node.source) {
            imports.push(node.source.value);
          }
        });
        return imports;
      },
      // allow custom polyfills to be added in the form of syntax functions
      addPolyfill: function(polyfill) {
        // by virtue of adding a polyfill, we now load esprima by default
        this.loadEsprima(null, null, function(){}, function(){});
        this.polyfills.push(polyfill);
      },
      polyfills: [],
      applyPolyfill: function(node, tSource) {
        for (var i = 0; i < this.polyfills.length; i++)
          this.polyfills[i](node, tSource);
      },

      // runs an eval of code with module syntax
      // opt = {
      //   name: name, // normalized module name, used to load cached syntax tree
      //   normalizeMap: normalizeMap, // normalization map to save having to renormalize again
      //   sourceURL: opt.address, // used for source map
      //   isEval: isScript // indicate if exports should be parsed
      // }
      // return value is any exports as a plain object
      parseEval: function(source, loader, opt) {
        // NB if no normalizeMap, run normalization function

        // regex showed no need for esprima - normal eval
        if (!this.polyfills.length && !this.checkModuleSyntax(opt.name, source)) {
          loader.global.__Loader = loader;
          __scopedEval((loader.strict ? '"use strict";\n' : '') + source, loader.global, opt.sourceURL);
          delete loader.global.__Loader;
          return;
        }

        var tree = this.treeCache[opt.name] || this.esprima.parse(source, { range: true });

        var normalizeMap = opt.normalizeMap || {};

        var tSource = new SourceModifier(source);

        var self = this;
        this.traverse(tree, function(node) {
          
          // --- Imports ---
          if (node.type == 'ImportDeclaration') {
            var moduleName = normalizeMap[node.source.value] || node.source.value;

            // import $ from 'jquery';
            if (node.kind == 'default') {
              tSource.replace(node.range[0], node.range[1], "var " + node.specifiers[0].id.name + " = __Loader.get('" + moduleName + "')['default'];");
            }

            // import { ... } from 'jquery';
            else {
              var replaceSource = "var __module = __Loader.get('" + moduleName + "');";
              for (var i = 0; i < node.specifiers.length; i++) {
                var specifier = node.specifiers[i];
                replaceSource += "var " + (specifier.name ? specifier.name.name : specifier.id.name) + " = __module['" + specifier.id.name + "'];";
              }
              tSource.replace(node.range[0], node.range[1], replaceSource);
            }
          }

          // --- Exports ---
          else if (node.type == 'ExportDeclaration') {

            if (node.declaration) {

              var exportName;
              var declarationIndex = node.declaration.range[0] - 1;

              if (node.declaration.type == 'VariableDeclaration') {
                var declaration = node.declaration.declarations[0];
                
                // export var p = ...
                if (declaration.init) {
                  exportName = declaration.id.name;
                  declarationIndex = declaration.init.range[0] - 1;
                }
              }

              // export function q() {}
              // export class q {}
              else if (node.declaration.type == 'FunctionDeclaration' || node.declaration.type == 'ClassDeclaration')
                exportName = node.declaration.id.name;
              
              // export default ... overrides any other name
              if (node['default'])
                exportName = 'default';

              tSource.replace(node.range[0], declarationIndex, "__exports['" + exportName + "'] = ");

            }

            else if (node.source) {
              var moduleName = normalizeMap[node.source.value] || node.source.value;

              // export * from 'jquery'
              if (node.specifiers[0].type == 'ExportBatchSpecifier') {
                tSource.replace(node.range[0], node.range[1], "var __module = __Loader.get('" + moduleName + "'); for (var m in __module) { __exports[m] = __module[m]; }; ");
              }

              // export { a as b, c as d } from 'jquery'
              else {
                var replaceSource = "var __module = __Loader.get('" + moduleName + "'); ";
                for (var i = 0; i < node.specifiers.length; i++) {
                  var specifier = node.specifiers[i];
                  replaceSource += "__exports['" + (specifier.name ? specifier.name.name : specifier.id.name) + "'] = __module['" + specifier.id.name + "']; ";
                }
                tSource.replace(node.range[0], node.range[1], replaceSource);
              }
            }

            else {

              // export {a as b, c as d}
              var replaceSource = "";
              for (var i = 0; i < node.specifiers.length; i++) {
                var specifier = node.specifiers[i];
                replaceSource += "__exports['" + specifier.id.name + "'] = " + (specifier.name ? specifier.name.name : specifier.id.name) + "; ";
              }
              tSource.replace(node.range[0], node.range[1], replaceSource);

            }
          }

          // --- Polyfills ---
          else if (self.polyfills.length)
            self.applyPolyfill(node, tSource);
        });

        delete this.treeCache[opt.name];

        loader.global.__Loader = loader;
        var exports = loader.global.__exports = {};

        __scopedEval((loader.strict ? '"use strict";\n' : '') + tSource.toString(), loader.global, opt.sourceURL);

        delete loader.global.__Loader;
        delete loader.global.__exports;

        // if exports are defined and it is an eval, throw
        if (opt.isEval) {
          for (var e in exports) {
            throw 'Exports only supported for modules, not script evaluation.'
          }
        }

        return exports;
      }
    };

    if (!isBrowser)
      ES6Parser.esprima = require('./esprima-es6.min.js');

    /*
     * SourceModifier
     *
     * Allows for partial modification of a source file based on successive
     * range adjustment operations consistent with the original source file
     *
     * Example:
     *                               012345678910
     *   var h = new SourceModifier('hello world');
     *   h.replace(2, 4, 'y');
     *   h.replace(6, 10, 'person');
     *   h.source == 'hey person';
     *   h.rangeOps == [{start: 2, end: 4, diff: -2}, {start: 4, end: 9, diff: 1}]
     *
     */
    var SourceModifier = function(source) {
      this.source = source;
      this.rangeOps = [];
    }
    SourceModifier.prototype = {
      mapIndex: function(index) {
        // apply the range operations in order to the index
        for (var i = 0; i < this.rangeOps.length; i++) {
          var curOp = this.rangeOps[i];
          if (curOp.start >= index)
            continue;
          if (curOp.end <= index) {
            index += curOp.diff;
            continue;
          }
          throw 'Source location ' + index + ' has already been transformed!';
        }
        return index;
      },
      replace: function(start, end, replacement) {
        var diff = replacement.length - (end - start + 1);

        start = this.mapIndex(start);
        end = this.mapIndex(end);
        
        this.source = this.source.substr(0, start) + replacement + this.source.substr(end + 1);

        this.rangeOps.push({
          start: start, 
          end: end, 
          diff: diff
        });
      },
      getRange: function(start, end) {
        return this.source.substr(this.mapIndex(start), this.mapIndex(end));
      },
      toString: function() {
        return this.source;
      }
    };

    // Export the Loader class
    global.Loader = Loader;
    // Export the Module class
    global.Module = Module;
    // Export the System object
    global.System = defaultSystemLoader;

  })();

  // carefully scoped eval with given global
  var __scopedEval = function(__source, global, __sourceURL) {
    eval('(function(window) { with(global) { ' + __source + ' } }).call(global, global);'
      + (__sourceURL && !__source.match(/\/\/[@#] ?(sourceURL|sourceMappingURL)=(.+)/)
      ? '\n//# sourceURL=' + __sourceURL : ''));
  }

})();
