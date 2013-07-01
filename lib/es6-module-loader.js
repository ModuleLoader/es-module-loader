/*
 * es6-module-loader
 * https://github.com/addyosmani/es6-module-loader
 *
 * Copyright (c) 2013 Guy Bedford, Luke Hoban, Addy Osmani
 * Licensed under the MIT license.
 */

(function (global) {


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

    // the global prototype chain is:
    // global instance (this._global) -> intrinsics (this._intrinsics) -> initial global (options.global = window)
    // global instance is created fresh to have this chain
    // also sets global.window = global for full global encapsulation
    
    // Object.create(window) doesn't work...
    var Global = function () {}
    Global.prototype = options.global || window;
    this._intrinsics = new Global();

    // some standard intrinsics can't work through this prototype
    // structure so we need to wrap them to allow this global
    // abstraction layer
    var wrapped = {};
    var wrap = ['addEventListener', 'removeEventListener', 'getComputedStyle', 'setTimeout', 'setInterval'];
    for (var i = 0; i < wrap.length; i++) (function (name) {
      wrapped[name] = function () {
        return window[name].apply(window, arguments);
      }
    })(wrap[i]);

    this.defineBuiltins(wrapped);
    this.defineBuiltins(options.intrinsics && options.intrinsics._intrinsics || {});

    Global = function () {}
    Global.prototype = this._intrinsics;
    this._global = new Global();

    Object.defineProperty(this._global, 'window', { value: this._global });

    this._strict = !!options.strict;
    this.normalize = options.normalize || global.System.normalize;
    this.resolve = options.resolve || global.System.resolve;
    this.fetch = options.fetch || global.System.fetch;
    this.translate = options.translate || global.System.translate;
    this.link = options.link || global.System.link;

    // The internal table of module instance objects
    this._mios = {};
    
    // modules currently loading
    // key is normalized name, value is an array of callback functions to be queued (optional)
    this._mloads = {};
    // scripts 
    this._sloads = {};
  }


  Object.defineProperty(Loader.prototype, "global", {
    configurable: true,
    enumerable: true,
    get: function () {
      return this._global;
    }
  });

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

    if (this._mios[url]) {
      callback(this._mios[url]);
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
    var _errback = function() {
      for (var i = 0; i < self._sloads[url].length; i++)
        self._sloads[url][i].errback && self._sloads[url][i].errback();
      delete self._sloads[url];
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
  Loader.prototype.import = function (name, callback, errback, referer) {
    var self = this;
    if (name instanceof Array) {
      var modules = [];
      var moduleCnt = 0;
      var self = this;
      for (var i = 0; i < name.length; i++) (function(i) {
        self.import(name[i], function(m) {
          modules[i] = m;
          moduleCnt++;
          if (moduleCnt == name.length) {
            callback && callback.apply(null, modules);
          }
        }, errback);
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
      return callback(this._mios[name]);
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
    var _errback = function() {
      if (errback) {
        if (errback.called)
          return;
        errback.called = true;
      }
      for (var i = 0; i < self._mloads[name].length; i++)
        self._mloads[name][i].errback && self._mloads[name][i].errback();
      delete self._mloads[name];
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
  Loader.prototype._linkExecute = function (name, source, opt, callback, errback, isScript) {
    // when no name is given,
    // provide a unique name to cache the syntax tree parsing
    if (!name) {
      name = '__eval' + evalCnt++;
    }

    var link = this.link(source, opt);

    // 1. module
    if (link instanceof Module && !isScript) {
      return callback(link);
    }

    // preload esprima if necessary
    var self = this;
    ES6Parser.loadEsprima(name, source, function() {
      var imports, execute;
      // 2. specified imports and execute
      if (typeof link == 'object' && !isScript) {
        imports = link.imports;
        execute = link.execute;
      }
      // 3. undefined -> default
      else
        imports = ES6Parser.parseImports(name, source);

      // stops an unnecessary load cascade
      if (errback.called)
        return;

      var _source = source;
      var normalizeMap = {};
      execute = execute || function() {
        var exports;
        try {
          // parses export statements and evaluates in the correct context
          // returning the exports object
          exports = ES6Parser.parseEval(_source, self, name, normalizeMap, opt.address);
        }
        catch(e) {
          return errback(e);
        }
        // only return exports for a module when not doing script eval
        if (name && !isScript)
          return new Module(exports || {});
      }

      if (!imports.length)
        return callback(execute.call(self));

      var deps = [];
      var depCnt = 0;
      for (var i = 0; i < imports.length; i++) (function(i) {
        var referer = { name: name, address: opt.address };

        // run the normalization to get the canonical module name
        // to allow imports to be loaded
        var normalized = self.normalize(imports[i], referer);

        if (typeof normalized == 'object')
          normalized = normalized.normalized;

        imports[i] = normalizeMap[imports[i]] = normalized;

        self.import(imports[i], function (module) {
          depCnt++;
          deps[i] = module;
          if (depCnt == imports.length) {
            callback(execute.apply(self, deps));
          }
        }, errback, referer);
      })(i);

    }, errback);
  };


  // Loader.prototype.eval( source )
  // Synchronously executes a Script non-terminal. 
  // If the compilation process results in a fetch, a SyntaxError is thrown.
  // The compiled code is statically associated with this loader.
  Loader.prototype.eval = function (source) {
    ES6Parser.parseEval(source, this);
  };

  // Loader.prototype.parseEval( source )
  // Asynchronously executes a Script non-terminal.
  // The compiled code is statically associated with this loader.
  Loader.prototype.evalAsync = function (source, callback, errback) {
    // links and then evals
    this._linkExecute(null, source, {}, callback || function() {}, errback || function() {}, true);
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
    this._mios[name] = Module(mod);
  };

  Loader.prototype.has = function (name) {
    return !!this._mios[name];
  };

  Loader.prototype.delete = function (name) {
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
        this._intrinsics[p] = o[p];
      }
    }
  };


  function Module(o) {
    
    if (typeof o != 'object') throw new TypeError("Expected object");
    
    if (o instanceof Module) {
      return o;
    } else {
      var self = this;
      for (var key in o) {
        (function (key) {
          Object.defineProperty(self, key, {
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
  var absUrlRegEx = /^\/|([^\:\/]*:)/;
  var isUrl = function(name) {
    return name.substr(name.length - 3, 3) == '.js' || name.match(absUrlRegEx);
  }
  var defaultSystemLoader = new Loader({
    global: window,
    strict: false,
    normalize: function(name, referer) {
      if (isUrl(name))
          return name;
        var parentName = referer && referer.name;
        if (name.substr(0, 2) == './') {
          var parentParts = parentName.split('/');
          if (!parentParts.length)
            return name.substr(2);
          parentParts.pop();
          parentParts.push(name.substr(2));
          return parentParts.join('/');
        }
        if (name.substr(0, 3) == '../') {
          var parentParts = parentName.split('/');
          if (!parentParts.length)
            throw "Path below baseUrl";
          parentParts.pop();
          return this.normalize(name.substr(3), { name: parentParts.join('/') });
        }
        return name;
    },
    resolve: function (name, options) {
      for (var r in this.ondemandTable)
        if (this.ondemandTable[r].indexOf(name) != -1)
          return name;
      if (isUrl(name))
        return name;
      return this.baseURL + (this.baseURL.substr(this.baseURL.length - 1, 1) != '/' ? '/' : '') + name + (name.split('/').pop().indexOf('.') == -1 ? '.js' : '');
    },
    fetch: function (url, fulfill, reject, options) {
      var xhr = new XMLHttpRequest();
      xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) {
          if (xhr.status === 200 || (xhr.status == 0 && xhr.responseText)) {
            fulfill(xhr.responseText);
          } else {
            reject(xhr.statusText);
          }
        }
      };
      xhr.open("GET", url, true);
      xhr.send(null);
    },
    translate: function (source, options) {
      return source;
    },
    link: function (source, options) {}
  });
  defaultSystemLoader.baseURL = document.URL.substring(0, window.location.href.lastIndexOf('\/') + 1);
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
  var scripts = document.getElementsByTagName('script');
  var curPath = scripts[scripts.length - 1].src;
  var basePath = curPath.substr(0, curPath.lastIndexOf('/') + 1);
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
    importRegEx: /^\s*import\s+./m,
    exportRegEx: /^\s*export\s+(\{|\*|var|class|function|default)/m,
    moduleRegEx: /^\s*module\s+("[^"]+"|'[^']+')\s*\{/m,
    checkModuleSyntax: function(name, source) {
      if (name == null || this.parseNames[name] === undefined)
        this.parseNames[name] = source && !!(source.match(this.importRegEx) || source.match(this.exportRegEx) || source.match(this.moduleRegEx));
      return this.parseNames[name];
    },
    loadEsprima: function(name, source, callback, errback) {
      // use a regex to check if the source contains 'import', 'export' or 'module' statements
      // may incorrectly fire, but the damage is only an http request to do better parsing shortly
      if (!this.checkModuleSyntax(name, source))
        return callback();

      var self = this;
      System.load(basePath + 'esprima-es6.min.js', function() {
        self.esprima = System.global.esprima;
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

      var tree = this.treeCache[name] || (this.treeCache[name] = this.esprima.parse(source, { range: true }));
      var imports = [];
      this.traverse(tree, function(node) {
        if (node.type == 'ImportDeclaration') {
          var moduleName;
          // import 'jquery' as $;
          if (node.from.type == 'Literal')
            moduleName = node.from.value;
          // import * from foo;
          else if (node.from.type == 'Path')
            moduleName = node.from.body[0].name;
          imports.push(moduleName);
        }
        else if (node.type == 'ExportDeclaration') {
          // export ... from blah
          // export ... from 'blah'
          if (node.specifiers && node.specifiers[0] && node.specifiers[0].from) {
            if (node.specifiers[0].from.body == 'Path')
              imports.push(node.specifiers[0].from.body[0].name);
            else
              imports.push(node.specifiers[0].from.value);
          }
        }
      });
      return imports;
    },
    // allow custom polyfills to be added in the form of syntax functions
    addPolyfill: function(polyfill, callback, errback) {
      // by virtue of adding a polyfill, we now load esprima by default
      this.loadEsprima(null, null, callback, errback);
      this.polyfills.push(polyfill);
    },
    polyfills: [],
    applyPolyfill: function(node, tSource) {
      for (var i = 0; i < this.polyfills.length; i++)
        this.polyfills[i](node, tSource);
    },

    // runs an eval of code with module syntax
    // name, normalizeMap, sourceURL optional
    // return value is any exports as a plain object
    parseEval: function(source, loader, name, normalizeMap, sourceURL) {

      // regex showed no need for esprima - normal eval
      if (!this.checkModuleSyntax(name, source)) {
        var __Loader = loader;
        eval('(function(window) { with(__Loader.global) { ' + (loader._strict ? '"use strict";\n' : '') + source + ' } }).call(__Loader.global, __Loader.global); ' + (sourceURL ? '\n//# sourceURL=' + sourceURL : ''));
        return;
      }

      var tree = this.treeCache[name] || this.esprima.parse(source, { range: true });

      normalizeMap = normalizeMap || {};

      var tSource = new SourceModifier(source);

      var self = this;
      this.traverse(tree, function(node) {
        
        // --- Imports ---
        // replaces imports with Loader.get
        // https://github.com/ariya/esprima/blob/harmony/test/harmonytest.js#L4067

        if (node.type == 'ImportDeclaration') {
          // import 'jquery' as $;
          if (node.from.type == 'Literal' && node.specifiers[0].type != 'ImportSpecifier') {
            tSource.replace(node.range[0], node.range[1], 
              "var " + node.as.name + " = __Loader.get('" + (normalizeMap[node.from.value] || node.from.value) + "');");
          }
          
          // import ... from foo
          else {
            var moduleName;
            if (node.from.body)
              moduleName = node.from.body[0].name;
            else if (node.from.type == 'Literal')
              moduleName = node.from.value;

            moduleName = normalizeMap[moduleName] || moduleName;
            
            // import * from foo;
            if (node.specifiers[0].type == 'Glob')
              tSource.replace(node.range[0], node.range[1], 
                "var __module = __Loader.get('" + moduleName + "');" + 
                "for (var m in __module)" + 
                "  __global[m] = __module[m];");

            // import { a } from foo;
            // import { a: mapping, of: imports } from foo
            else if (node.specifiers[0].type == 'ImportSpecifier') {
              var replaceSource = "var __module = __Loader.get('" + moduleName + "');";
              for (var i = 0; i < node.specifiers.length; i++ ) {
                replaceSource += "var " + node.specifiers[i].id.name + " = " + 
                  "__module['" + (node.specifiers[i].from ? node.specifiers[i].from.body[0].name : node.specifiers[i].id.name) + "'];";
              }
              tSource.replace(node.range[0], node.range[1], replaceSource);
            }
          }
        }

        // --- Exports ---
        // NB throw an error for exports being present when (name && name.substr(0, 6) != '__eval')
        // replace exports with __exports.export = ...
        // https://github.com/ariya/esprima/blob/harmony/test/harmonytest.js#L3288

        // exports = ...
        else if (node.type == 'AssignmentExpression' && node.left.name && node.left.name == 'exports')
          tSource.replace(node.left.range[0], node.left.range[1], '__exports');
        
        else if (node.type == 'ExportDeclaration') {
          var fromModule;
          var exports;
          // export ... from blah
          // export ... from 'blah'
          if (node.specifiers && node.specifiers[0] && node.specifiers[0].from) {
            if (node.specifiers[0].from.body == 'Path')
              fromModule = node.specifiers[0].from.body[0].name;
            else
              fromModule = node.specifiers[0].from.value;
          }
          if (!node.declaration && node.specifiers) {
            // export *
            if (node.specifiers[0].id.type == 'Glob')
              exports = true;

            // export { A: some.thing, B: another.thing, C }
            else if (node.specifiers[0].type == 'ExportSpecifierSet') {
              exports = {};
              for (var i = 0; i < node.specifiers[0].specifiers.length; i++) {
                if (node.specifiers[0].specifiers[i].from)
                  exports[node.specifiers[0].specifiers[i].id.name] = tSource.getRange.apply(tSource, node.specifiers[0].specifiers[i].from.range);
                else
                  exports[node.specifiers[0].specifiers[i].id.name] = node.specifiers[0].specifiers[i].id.name;
              }
            }
            // export varA, varB, varC
            else if (node.specifiers[0].type = 'ExportSpecifier') {
              exports = {};
              for (var i = 0; i < node.specifiers.length; i++)
                exports[node.specifiers[i].id.name] = node.specifiers[i].id.name;
            }
          }
          // export var p
          else if (node.declaration.type == 'VariableDeclaration')
            exports = node.declaration.declarations[0].id.name;
          // export function p() {}
          else if (node.declaration.type == 'FunctionDeclaration')
            exports = node.declaration.id.name;

          // export module p {}
          // export class p {}
          else if (node.declaration.type == 'ModuleDeclaration' || node.declaration.type == 'ClassDeclaration')
            exports = node.declaration.declarations[0].id.name;

          if (fromModule) {
            fromModule = normalize(fromModule);
            // export * from someModule
            if (exports === true)
              tSource.replace(node.range[0], node.range[1], "__exports = __Loader.get('" + fromModule + "');");
            // export { some: var } from someModule
            else {
              var replaceSource = "";
              for (var e in exports)
                replaceSource += "__exports['" + e + "'] = __Loader.get('" + fromModule + "')['" + exports[e] + "'];";
              tSource.replace(node.range[0], node.range[1], replaceSource);
            }
          }
          else if (typeof exports == 'object') {
            // export { a, b, c: d }
            var replaceSource = "";
            for (var e in exports)
              replaceSource += "__exports['" + e + "'] = " + exports[e] + "; ";
            tSource.replace(node.range[0], node.range[1], replaceSource);
          }
          else if (typeof exports == 'string') {
            // export var p = 5 etc
            if (node.declaration.declarations)
              tSource.replace(node.range[0], node.declaration.declarations[0].id.range[0] - 1, "__exports['" + exports + "'] = ");
            // export function q() { ... }
            else if (node.declaration.type == 'FunctionDeclaration')
              tSource.replace(node.range[0], node.declaration.range[0] - 1, "__exports['" + exports + "'] = ");
            
            else
              tSource.replace(node.range[0], node.declaration.id.range[0] - 1, "__exports['" + exports + "'] = ");
          }
        }

        // --- Modules ---
        // replaces modules with Loader.set

        else if (node.type == 'ModuleDeclaration') {
          var moduleName = node.id.name;
          // module foo { ..code.. }
          // -> (function() { var __exports = {}; ..code.. __Loader.set("foo", new Module(__exports)); })();
          if (node.body.type == 'BlockStatement') {
            tSource.replace(node.range[0], node.body.range[0] + 1, "(function() { var __exports = {}; ");
            tSource.replace(node.body.range[1], node.range[1], " __Loader.set('" + moduleName + "', new Module(__exports)); })();");
          }
          // module names are assumed to be normalized already
          // so nested modules not currently supported
        }

        // --- Polyfills ---

        else if (self.polyfills.length)
          self.applyPolyfill(node, tSource);
      });

      delete this.treeCache[name];

      var __Loader = loader;
      var __exports = {};
      var evalSource = '(function(window) { with(__Loader.global) { ' + (loader._strict ? '"use strict";\n' : '') + tSource.toString() + ' } }).call(__Loader.global, __Loader.global);' + (sourceURL ? '\n//# sourceURL=' + sourceURL : '');
      eval(evalSource);

      return __exports;
    }
  };

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


})(window);
