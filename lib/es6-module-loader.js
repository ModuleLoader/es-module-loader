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
      var isScript = opt.type == 'script';

      var link = this.link(source, opt);

      // 1. module
      if (link instanceof Module && !isScript) {
        return callback(link);
      }

      // preload esprima if necessary
      var self = this;
      var linkSpecified = typeof link == 'object' && !isScript;
      (!linkSpecified ? ES6Parser.loadTraceur : function(name, source, callback) { callback(); }).call(ES6Parser, name, source, function() {
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
              var output = execute.apply(self, deps);
              callback(output);
            }
          }, errback, referer);
        })(i);

      }, errback);
    };

    Loader.prototype._link = function(source, opt) {
      var self = this;
      return {
        imports: ES6Parser.parseImports(source, opt),
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
    Loader.prototype.evalAsync = function(source, callback, errback) {
      // links and then evals
      // when no name is given,
      // provide a unique name to cache the syntax tree parsing
      var name = '__eval' + evalCnt++;
      ES6Parser.parseNames[name] = true;
      var self = this;
      ES6Parser.loadTraceur(name, source, function() {
        self._linkExecute(null, source, { type: 'script', address: name, normalized: name  }, callback || function() {}, errback || function() {});
      }, errback);
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
        var xhr = new XMLHttpRequest();
        if (!('withCredentials' in xhr)) {
          // check if same domain
          var sameDomain = true,
          domainCheck = /^(\w+:)?\/\/([^\/]+)/.exec(url);
          if (domainCheck) {
            sameDomain = domainCheck[2] === window.location.host;
            if (domainCheck[1])
              sameDomain &= domainCheck[1] === window.location.protocol;
          }
          if (!sameDomain)
            xhr = new XDomainRequest();
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
    // Traceur-based parser for module syntax, with pluggable polyfill support
    var traceurSrc;
    var ES6Parser = {
      // iterate the entire syntax tree node object with the given iterator function
      traverse: function(object, iterator, parent, parentProperty) {
        var key, child;
        if (iterator(object, parent, parentProperty) === false)
          return;
        for (key in object) {
          if (!object.hasOwnProperty(key))
            continue;
          if (key == 'location' || key == 'type')
            continue;
          child = object[key];
          if (typeof child == 'object' && child !== null)
            this.traverse(child, iterator, object, key);
        }
      },
      // module syntax regexs - may over-classify but not under-classify
      // simply designed as a first level check to catch any use of
      // module syntax, before loading Traceur for deeper analysis
      importRegEx: /(?:^\s*|[}{\(\);,\n]\s*)import\s+./,
      exportRegEx: /(?:^\s*|[}{\(\);,\n]\s*)export\s+(\{|\*|var|class|function|default)/,
      moduleRegEx: /(?:^\s*|[}{\(\);,\n]\s*)module\s+("[^"]+"|'[^']+')\s*\{/,
      checkModuleSyntax: function(name, source) {
        if (name == null || this.parseNames[name] === undefined)
          this.parseNames[name] = source && !!(source.match(this.importRegEx) || source.match(this.exportRegEx) || source.match(this.moduleRegEx));
        return this.parseNames[name];
      },
      loadTraceur: function(name, source, callback, errback) {
        if (this.traceur)
          return callback();

        // use a regex to check if the source contains 'import', 'export' or 'module' statements
        // may incorrectly fire, but the damage is only an http request to do better parsing shortly
        if (!this.checkModuleSyntax(name, source))
          return callback();

        // current script tags used to produce the Traceur src (converting collection to array)
        if (isBrowser) {
          var scripts = document.getElementsByTagName('script');

          var curScript;
          for (var i = 0; i < scripts.length; i++) {
            curScript = scripts[i];
            if (curScript.src.match(/es6-module-loader(\.min)?\.js/))
              traceurSrc = curScript.src.substr(0, curScript.src.lastIndexOf('/') + 1) + 'traceur.js';
            else
              traceurSrc = curScript.getAttribute('data-traceur-src');
            
            if (traceurSrc)
              break;
          }
        }
        var self = this;
        var System = global.System;

        (isBrowser ? global.System.load : function(src, callback) {
          self.traceur = require('traceur');
          callback();
        })(traceurSrc, function() {
          if (isBrowser) {
            if (self.traceur)
              return callback();
            else
              self.traceur = global.System.get('../src/traceur.js');
          }

          self.traceur.options.sourceMaps = true;
          self.traceur.options.modules = 'parse';

          self.reporter = new self.traceur.util.ErrorReporter();
          self.reporter.reportMessageInternal = function(location, kind, format, args) {
            throw kind + '\n' + location;
          }

          self.createModuleLoaderTransformer(
            self.traceur.codegeneration.ParseTreeFactory,
            self.traceur.codegeneration.ParseTreeTransformer
          );

          global.System = System;
          callback();
        });
      },
      createModuleLoaderTransformer: function(ParseTreeFactory, ParseTreeTransformer) {
        var createAssignmentExpression = ParseTreeFactory.createAssignmentExpression;
        var createVariableDeclaration = ParseTreeFactory.createVariableDeclaration;
        
        var createMemberExpression = ParseTreeFactory.createMemberExpression;
        var createCallExpression = ParseTreeFactory.createCallExpression;

        var createVariableDeclarationList = ParseTreeFactory.createVariableDeclarationList;
        var createArgumentList = ParseTreeFactory.createArgumentList;
        var createStringLiteral = ParseTreeFactory.createStringLiteral;
        var createIdentifierExpression = ParseTreeFactory.createIdentifierExpression;

        var createMemberLookupExpression = ParseTreeFactory.createMemberLookupExpression;

        var createCommaExpression = ParseTreeFactory.createCommaExpression;
        var createVariableStatement = ParseTreeFactory.createVariableStatement;

        var createAssignmentStatement = ParseTreeFactory.createAssignmentStatement;
        var createExpressionStatement = ParseTreeFactory.createExpressionStatement;

        // var VARIABLE = __Loader.get('MODULE_NAME')['VALUE'], ...
        // var VARIABLE = __Loader.get('MODULE_NAME'), ...
        var createModuleVariableDeclaration = function(moduleName, variables, values, location) {
          var variableDeclarations = variables.map(function(variable, i) {
            return createVariableDeclaration(variable, createImportExpression(moduleName, values[i]));
          });
          var varList = createVariableDeclarationList('var', variableDeclarations);
          varList.location = location;
          return createVariableStatement(varList);
        }

        // __Loader.get('MODULE_NAME')['VALUE']
        var createImportExpression = function(moduleName, value) {
          var expression = createCallExpression(
            createMemberExpression('__Loader', 'get'),
            createArgumentList([createStringLiteral(moduleName)])
          );
          return value ? createMemberLookupExpression(expression, createStringLiteral(value)) : expression;
        }

        // __exports['EXPORT_NAME']
        var createExportExpression = function(exportName) {
          return createMemberLookupExpression(createIdentifierExpression('__exports'), createStringLiteral(exportName));
        }

        var self = this;
        var ModuleTransformer = function(normalizeMap) {
          this.nMap = normalizeMap;
        }
        ModuleTransformer.prototype = Object.create(ParseTreeTransformer.prototype);

        ModuleTransformer.prototype.transformImportDeclaration = function(tree) {
          var moduleName = tree.moduleSpecifier.token.processedValue;
          moduleName = this.nMap[moduleName] || moduleName;

          var variables = [];
          var values = [];

          // import $ from 'jquery';
          if (tree.importClause.binding) {
            variables.push(tree.importClause.binding.identifierToken);
            values.push('default');
          }

          // import { ... } from 'jquery';
          else {
            var specifiers = tree.importClause.specifiers;
            for (var i = 0; i < specifiers.length; i++) {
              var specifier = specifiers[i];
              variables.push(specifier.rhs ? specifier.rhs.value : specifier.lhs.value);
              values.push(specifier.lhs.value);
            }
          }
          return createModuleVariableDeclaration(moduleName, variables, values, tree.location);
        }
        ModuleTransformer.prototype.transformModuleDeclaration = function(tree) {
          var moduleName = tree.expression.token.processedValue;
          moduleName = this.nMap[moduleName] || moduleName;
          return createModuleVariableDeclaration(moduleName, [tree.identifier], [null], tree.location);
        }
        ModuleTransformer.prototype.transformExportDeclaration = function(tree) {
          var declaration = tree.declaration;

          if (declaration.type == 'NAMED_EXPORT') {
            var moduleName = declaration.moduleSpecifier && declaration.moduleSpecifier.token.processedValue;
            if (moduleName)
              moduleName = this.nMap[moduleName] || moduleName;
            // export {a as b, c as d}
            // export {a as b, c as d} from 'module'
            if (declaration.specifierSet.type != 'EXPORT_STAR') {
              var expressions = [];
              var specifiers = declaration.specifierSet.specifiers;
              for (var i = 0; i < specifiers.length; i++) {
                var specifier = specifiers[i];
                expressions.push(createAssignmentExpression(
                  createExportExpression(specifier.rhs ? specifier.rhs.value : specifier.lhs.value),
                  moduleName
                    ? createImportExpression(moduleName, specifier.lhs.value)
                    : createIdentifierExpression(specifier.lhs.value)
                ));
              }
              var commaExpression = createExpressionStatement(createCommaExpression(expressions));
              commaExpression.location = tree.location;
              return commaExpression;
            }
            else {
              var exportStarStatement = createAssignmentStatement(createIdentifierExpression('__exports'), createImportExpression(moduleName));
              exportStarStatement.location = tree.location;
              return exportStarStatement;
            }
          }
          
          // export var p = 4;
          else if (declaration.type == 'VARIABLE_STATEMENT') {
            // export var p = ...
            var varDeclaration = declaration.declarations.declarations[0];
            varDeclaration.initializer = createAssignmentExpression(
              createExportExpression(varDeclaration.lvalue.identifierToken.value), 
              this.transformAny(varDeclaration.initializer)
            );
            return declaration;
          }
          // export function q() {}
          else if (declaration.type == 'FUNCTION_DECLARATION') {
            var varDeclaration = createVariableDeclaration(
              declaration.name.identifierToken.value, 
              createAssignmentStatement(
                createExportExpression(declaration.name.identifierToken.value), 
                this.transformAny(declaration)
              )
            );
            varDeclaration.location = tree.location;
            return createVariableDeclarationList('var', [varDeclaration]);
          }
          // export default ...
          else if (declaration.type == 'EXPORT_DEFAULT') {
            return createAssignmentStatement(
              createExportExpression('default'), 
              this.transformAny(declaration.expression)
            );
          }
           
          return tree;
        }
        this.ModuleTransformer = ModuleTransformer;
      },
      // store the names of modules which needed to be parsed by esprima
      parseNames: {},
      // store the syntax trees for modules parsed by esprima
      treeCache: {},
      getSyntaxTree: function(source, options) {
        var name = options.normalized || options.address;
        if (this.treeCache[name])
          return this.treeCache[name];

        var parser = new this.traceur.syntax.Parser(this.reporter, new this.traceur.syntax.SourceFile(options.address, source));
        var tree = options.type == 'module' ? parser.parseModule() : parser.parseScript();

        return this.treeCache[name] = tree;
      },
      getTransformedSyntaxTree: function(source, options) {
        var tree = this.getSyntaxTree(source, options);

        if (options.es6) {
          var project = new this.traceur.semantics.symbols.Project(options.address);
          var transformer = new this.traceur.codegeneration.ProgramTransformer(this.reporter, project);
          tree = transformer.transform(tree);
        }

        return (new this.ModuleTransformer(options.normalizeMap || {})).transformAny(tree);
      },
      // parse the list of import module names for a given source
      parseImports: function(source, options) {
        if (!this.checkModuleSyntax(options.normalized || options.address, source))
          return [];

        var tree = this.getSyntaxTree(source, options);
        
        var imports = [];

        // NB switch this to a Visitor implementation
        this.traverse(tree, function(node) {
          // import {} from 'foo';
          // export * from 'foo';
          // export { ... } from 'foo';
          // module x from 'foo';
          if (node.type == 'EXPORT_DECLARATION') {
            if (node.declaration.moduleSpecifier)
              imports.push(node.declaration.moduleSpecifier.token.processedValue);
          }
          else if (node.type == 'IMPORT_DECLARATION')
            imports.push(node.moduleSpecifier.token.processedValue);
          else if (node.type == 'MODULE_DECLARATION')
            imports.push(node.expression.token.processedValue);
        });
        return imports;
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
        if (!this.checkModuleSyntax(opt.name, source)) {
          loader.global.__Loader = loader;
          __scopedEval((loader.strict ? '"use strict";\n' : '') + source, loader.global, opt.sourceURL);
          delete loader.global.__Loader;
          return;
        }

        var tree = this.getTransformedSyntaxTree(source, { es6: true, normalized: opt.name, address: opt.sourceURL, normalizeMap: opt.normalizeMap });
        delete this.treeCache[opt.name || opt.address];

        // generate source
        var sourceMapGenerator = new this.traceur.outputgeneration.SourceMapGenerator({ file: opt.sourceURL });
        var options = { sourceMapGenerator: sourceMapGenerator };

        source = this.traceur.outputgeneration.TreeWriter.write(tree, options);
        if (isBrowser)
          source += '\n//# sourceMappingURL=data:application/json;base64,' + btoa(options.sourceMap) + '\n'

        loader.global.__Loader = loader;
        loader.global.__exports = {};

        __scopedEval((loader.strict ? '"use strict";\n' : '') + source, loader.global, opt.sourceURL);

        delete loader.global.__Loader;
        var exports = loader.global.__exports;
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

(function() {
  // allow a data-init function callback once loaded
  if (typeof window != 'undefined') {
    var curScript = document.getElementsByTagName('script');
    curScript = curScript[curScript.length - 1];
    if (curScript.getAttribute('data-init'))
      window[curScript.getAttribute('data-init')]();

    document.onreadystatechange = function() {
      if (document.readyState == 'interactive') {
        var scripts = document.getElementsByTagName('script');
        for (var i = 0; i < scripts.length; i++) {
          if (scripts[i].type == 'module') {
            System.evalAsync(scripts[i].innerHTML);
          }
        }
      }
    }
  }
})();
