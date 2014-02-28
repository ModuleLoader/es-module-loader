/*
*********************************************************************************************

  System Loader Implementation

    - Implemented to https://github.com/jorendorff/js-loaders/blob/master/browser-loader.js,
      except for Instantiate function

    - Instantiate function determines if ES6 module syntax is being used, if so parses with 
      Traceur and returns a dynamic InstantiateResult for loading ES6 module syntax in ES5.

    - Custom loaders thus can be implemented by using this System.instantiate function as 
      the fallback loading scenario, after other module format detections.

    - Traceur is loaded dynamically when module syntax is detected by a regex (with over-
      classification), either from require('traceur') on the server, or the 
      'data-traceur-src' property on the current script in the browser, or if not set, 
      'traceur.js' in the same URL path as the current script in the browser.

    - <script type="module"> supported, but <module> tag not

*********************************************************************************************
*/

(function (global) {
  var isBrowser = typeof window != 'undefined';
  var Module = global.Module || require('./module.js');
  var Loader = global.Loader || require('./loader.js');
  var Promise = global.Promise || require('./promise.js');

  // Helpers
  // Absolute URL parsing, from https://gist.github.com/Yaffle/1088850
  function parseURI(url) {
    var m = String(url).replace(/^\s+|\s+$/g, '').match(/^([^:\/?#]+:)?(\/\/(?:[^:@]*(?::[^:@]*)?@)?(([^:\/?#]*)(?::(\d*))?))?([^?#]*)(\?[^#]*)?(#[\s\S]*)?/);
    // authority = '//' + user + ':' + pass '@' + hostname + ':' port
    return (m ? {
      href     : m[0] || '',
      protocol : m[1] || '',
      authority: m[2] || '',
      host     : m[3] || '',
      hostname : m[4] || '',
      port     : m[5] || '',
      pathname : m[6] || '',
      search   : m[7] || '',
      hash     : m[8] || ''
    } : null);
  }
  function toAbsoluteURL(base, href) {
    function removeDotSegments(input) {
      var output = [];
      input.replace(/^(\.\.?(\/|$))+/, '')
        .replace(/\/(\.(\/|$))+/g, '/')
        .replace(/\/\.\.$/, '/../')
        .replace(/\/?[^\/]*/g, function (p) {
          if (p === '/..')
            output.pop();
          else
            output.push(p);
      });
      return output.join('').replace(/^\//, input.charAt(0) === '/' ? '/' : '');
    }

    href = parseURI(href || '');
    base = parseURI(base || '');

    return !href || !base ? null : (href.protocol || base.protocol) +
      (href.protocol || href.authority ? href.authority : base.authority) +
      removeDotSegments(href.protocol || href.authority || href.pathname.charAt(0) === '/' ? href.pathname : (href.pathname ? ((base.authority && !base.pathname ? '/' : '') + base.pathname.slice(0, base.pathname.lastIndexOf('/') + 1) + href.pathname) : base.pathname)) +
      (href.protocol || href.authority || href.pathname ? href.search : (href.search || base.search)) +
      href.hash;
  }
  // Define an IE-friendly shim good-enough for purposes
  var indexOf = Array.prototype.indexOf || function (item) { 
    for (var i = 0, thisLen = this.length; i < thisLen; i++) {
      if (this[i] === item) {
        return i;
      }
    }
    return -1;
  };

  var fetchTextFromURL;
  if (isBrowser) {
    fetchTextFromURL = function(url, fulfill, reject) {
      var xhr = new XMLHttpRequest();
      var sameDomain = true;
      if (!('withCredentials' in xhr)) {
        // check if same domain
        var domainCheck = /^(\w+:)?\/\/([^\/]+)/.exec(url);
        if (domainCheck) {
          sameDomain = domainCheck[2] === window.location.host;
          if (domainCheck[1])
            sameDomain &= domainCheck[1] === window.location.protocol;
        }
      }
      if (!sameDomain) {
        xhr = new XDomainRequest();
        xhr.onload = load;
        xhr.onerror = error;
        xhr.ontimeout = error;
      }
      function load() {
        fulfill(xhr.responseText);
      }
      function error() {
        reject(xhr.statusText + ': ' + url || 'XHR error');
      }

      xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) {
          if (xhr.status === 200 || (xhr.status == 0 && xhr.responseText)) {
            load();
          } else {
            error();
          }
        }
      };
      xhr.open("GET", url, true);
      xhr.send(null);
    }
  }
  else {
    var fs = require('fs');
    fetchTextFromURL = function(url, fulfill, reject) {
      return fs.readFile(url, function(err, data) {
        if (err)
          return reject(err);
        else
          fulfill(data + '');
      });
    }
  }

  var System = new Loader({
    global: isBrowser ? window : global,
    strict: true,
    normalize: function(name, parentName, parentAddress) {
      if (typeof name != 'string')
        throw new TypeError('Module name must be a string');

      var segments = name.split('/');

      if (segments.length == 0)
        throw new TypeError('No module name provided');

      // current segment
      var i = 0;
      // is the module name relative
      var rel = false;
      // number of backtracking segments
      var dotdots = 0;
      if (segments[0] == '.') {
        i++;
        if (i == segments.length)
          throw new TypeError('Illegal module name "' + name + '"');
        rel = true;
      }
      else {
        while (segments[i] == '..') {
          i++;
          if (i == segments.length)
            throw new TypeError('Illegal module name "' + name + '"');
        }
        if (i)
          rel = true;
        dotdots = i;
      }

      for (var j = i; j < segments.length; j++) {
        var segment = segments[j];
        if (segment == '' || segment == '.' || segment == '..')
          throw new TypeError('Illegal module name"' + name + '"');
      }

      if (!rel)
        return name;

      // build the full module name
      var normalizedParts = [];
      var parentParts = (parentName || '').split('/');
      var normalizedLen = parentParts.length - 1 - dotdots;

      normalizedParts = normalizedParts.concat(parentParts.splice(0, parentParts.length - 1 - dotdots));
      normalizedParts = normalizedParts.concat(segments.splice(i));

      return normalizedParts.join('/');
    },
    locate: function(load) {
      var name = load.name;

      // NB no specification provided for System.paths, used ideas discussed in https://github.com/jorendorff/js-loaders/issues/25

      // most specific (longest) match wins
      var pathMatch = '', wildcard;

      // check to see if we have a paths entry
      for (var p in this.paths) {
        var pathParts = p.split('*');
        if (pathParts.length > 2)
          throw new TypeError('Only one wildcard in a path is permitted');

        // exact path match
        if (pathParts.length == 1) {
          if (name == p && p.length > pathMatch.length)
            pathMatch = p;
        }

        // wildcard path match
        else {
          if (name.substr(0, pathParts[0].length) == pathParts[0] && name.substr(name.length - pathParts[1].length) == pathParts[1]) {
            pathMatch = p;
            wildcard = name.substr(pathParts[0].length, name.length - pathParts[1].length - pathParts[0].length);
          }
        }
      }

      var outPath = this.paths[pathMatch];
      if (wildcard)
        outPath = outPath.replace('*', wildcard);

      return toAbsoluteURL(this.baseURL, outPath);
    },
    fetch: function(load) {
      var resolve, reject, promise = new Promise(function(_resolve, _reject) { resolve = _resolve; reject = _reject; });
      fetchTextFromURL(toAbsoluteURL(this.baseURL, load.address), function(source) {
        resolve(source);
      }, reject);
      return promise;
    },
    instantiate: function(load) {

      // allow empty source
      if (!load.source) {
        return {
          deps: [],
          execute: function() {
            return new Module({});
          }
        };
      }

      // normal eval (non-module code)
      // note that anonymous modules (load.name == undefined) are always 
      // anonymous <module> tags, so we use Traceur for these
      if (!load.metadata.es6 && load.name && (load.metadata.es6 === false || !load.source.match(es6RegEx))) {
        return {
          deps: [],
          execute: function() {
            __eval(load.source, global, load.address, load.name);

            // when loading traceur, it overwrites the System
            // global. The only way to synchronously ensure it is
            // reverted in time not to cause issue is here
            if (load.name == 'traceur' && isBrowser) {
              global.traceur = global.System.get('../src/traceur.js');
              global.System = System;
            }

            // return an empty module
            return new Module({});
          }
        };
      }

      var match;
      var loader = this;
      // alias check is based on a "simple form" only
      // eg import * from 'jquery';
      if (match = load.source.match(aliasRegEx)) {
        return {
          deps: [match[1] || match[2]],
          execute: function(dep) {
            return loader._modules[dep];
          }
        };
      }

      // ES6 -> ES5 conversion
      load.address = load.address || 'anonymous-module-' + anonCnt++;
      // load traceur and the module transformer
      return getTraceur()
      .then(function(traceur) {

        traceur.options.sourceMaps = true;
        traceur.options.modules = 'parse';
        // traceur.options.blockBinding = true;

        var reporter = new traceur.util.ErrorReporter();

        reporter.reportMessageInternal = function(location, kind, format, args) {
          throw kind + '\n' + location;
        }

        var parser = new traceur.syntax.Parser(reporter, new traceur.syntax.SourceFile(load.address, load.source));

        var tree = parser.parseModule();


        var imports = getImports(tree);

        return {
          deps: imports,
          execute: function() {

            // write dependencies as unique globals
            // creating a map from the unnormalized import name to the unique global name
            var globalMap = {};
            for (var i = 0; i < arguments.length; i++) {
              var name = '__moduleDependency' + i;
              global[name] = System.get(arguments[i]);
              globalMap[imports[i]] = name;
            }

            // transform
            var transformer = new traceur.codegeneration.FromOptionsTransformer(reporter);
            transformer.append(function(tree) {
              return new traceur.codegeneration.ModuleLoaderTransformer(globalMap, '__exports').transformAny(tree);
            });
            tree = transformer.transform(tree);

            // convert back to a source string
            var sourceMapGenerator = new traceur.outputgeneration.SourceMapGenerator({ file: load.address });
            var options = { sourceMapGenerator: sourceMapGenerator };

            source = traceur.outputgeneration.TreeWriter.write(tree, options);
            if (isBrowser && window.btoa)
              source += '\n//# sourceMappingURL=data:application/json;base64,' + btoa(unescape(encodeURIComponent(options.sourceMap))) + '\n';

            global.__exports = {};

            __eval(source, global, load.address, load.name);

            var exports = global.__exports;

            delete global.__exports;
            for (var i = 0; i < arguments.length; i++)
              delete global['__moduleDependency' + i];

            return new Module(exports);
          }
        };
      });
    }
  });

  // count anonymous evals to have unique name
  var anonCnt = 1;

  if (isBrowser) {
    var href = window.location.href.split('#')[0].split('?')[0];
    System.baseURL = href.substring(0, href.lastIndexOf('\/') + 1);
  }
  else {
    System.baseURL = './';
  }
  System.paths = { '*': '*.js' };


  // ES6 to ES5 parsing functions

  // comprehensively overclassifying regex detectection for es6 module syntax
  var es6RegEx = /(?:^\s*|[}{\(\);,\n]\s*)(import\s+['"]|(import|module)\s+[^"'\(\)\n;]+\s+from\s+['"]|export\s+(\*|\{|default|function|var|const|let|[_$a-zA-Z\xA0-\uFFFF][_$a-zA-Z0-9\xA0-\uFFFF]*))/;

  // es6 module forwarding - allow detecting without Traceur
  var aliasRegEx = /^\s*export\s*\*\s*from\s*(?:'([^']+)'|"([^"]+)")/;

  // dynamically load traceur when needed
  // populates the traceur, reporter and moduleLoaderTransfomer variables

  // NB we need to queue getTraceur callbacks due to https://github.com/jorendorff/js-loaders/issues/60
  var traceur, traceurPromise;
  function getTraceur() {
    if (traceur)
      return Promise.resolve(traceur || (traceur = global.traceur));

    if (traceurPromise)
      return traceurPromise;

    return traceurPromise = (isBrowser ? System.import : function(name, src, callback) {
      return Promise.resolve(require('traceur'));
    }).call(System, 'traceur', { address: traceurSrc }).then(function(_traceur) {
      traceurPromise = null;

      if (isBrowser)
        _traceur = global.traceur;

      traceur = _traceur;

      traceur.codegeneration.ModuleLoaderTransformer = createModuleLoaderTransformer(
        traceur.codegeneration.ParseTreeFactory,
        traceur.codegeneration.ParseTreeTransformer
      );

      return traceur;
    });
  }

  // NB update to new transformation system
  function createModuleLoaderTransformer(ParseTreeFactory, ParseTreeTransformer) {
    var createAssignmentExpression = ParseTreeFactory.createAssignmentExpression;
    var createVariableDeclaration = ParseTreeFactory.createVariableDeclaration;

    var createCallExpression = ParseTreeFactory.createCallExpression;

    var createVariableDeclarationList = ParseTreeFactory.createVariableDeclarationList;
    var createStringLiteral = ParseTreeFactory.createStringLiteral;
    var createIdentifierExpression = ParseTreeFactory.createIdentifierExpression;

    var createMemberLookupExpression = ParseTreeFactory.createMemberLookupExpression;

    var createCommaExpression = ParseTreeFactory.createCommaExpression;
    var createVariableStatement = ParseTreeFactory.createVariableStatement;

    var createAssignmentStatement = ParseTreeFactory.createAssignmentStatement;
    var createExpressionStatement = ParseTreeFactory.createExpressionStatement;


    var self = this;
    var ModuleLoaderTransformer = function(globalMap, exportGlobal) {
      this.depMap = globalMap;
      this.exportGlobal = exportGlobal;
    }
    ModuleLoaderTransformer.prototype = Object.create(ParseTreeTransformer.prototype);

    // var VARIABLE = __moduleDependencyX['VALUE'], ...
    // var VARIABLE = __moduleDependencyX, ...
    ModuleLoaderTransformer.prototype.createModuleVariableDeclaration = function(moduleName, variables, values, location) {
      var self = this;
      var variableDeclarations = variables.map(function(variable, i) {
        return createVariableDeclaration(variable, self.createImportExpression(moduleName, values[i]));
      });
      var varList = createVariableDeclarationList('var', variableDeclarations);
      varList.location = location;
      return createVariableStatement(varList);
    }

    // __moduleDependencyX['VALUE']
    ModuleLoaderTransformer.prototype.createImportExpression = function(moduleName, value) {
      var expression = createIdentifierExpression(this.depMap[moduleName]);
      return value ? createMemberLookupExpression(expression, createStringLiteral(value)) : expression;
    }

    // __exports['EXPORT_NAME']
    ModuleLoaderTransformer.prototype.createExportExpression = function(exportName) {
      return createMemberLookupExpression(createIdentifierExpression(this.exportGlobal), createStringLiteral(exportName));
    }

    ModuleLoaderTransformer.prototype.transformImportDeclaration = function(tree) {
      var moduleName = tree.moduleSpecifier.token.processedValue;

      var variables = [];
      var values = [];

      // import 'jquery';
      if (!tree.importClause) {
        return;
      }
      // import $ from 'jquery';
      else if (tree.importClause && tree.importClause.binding) {
        variables.push(tree.importClause.binding.identifierToken);
        values.push('default');
      }
      // import { ... } from 'jquery';
      else if (tree.importClause) {
        var specifiers = tree.importClause.specifiers;
        for (var i = 0; i < specifiers.length; i++) {
          var specifier = specifiers[i];
          variables.push(specifier.rhs ? specifier.rhs.value : specifier.lhs.value);
          values.push(specifier.lhs.value);
        }
      }
      return this.createModuleVariableDeclaration(moduleName, variables, values, tree.location);
    }
    ModuleLoaderTransformer.prototype.transformModuleDeclaration = function(tree) {
      var moduleName = tree.expression.token.processedValue;
      return this.createModuleVariableDeclaration(moduleName, [tree.identifier], [null], tree.location);
    }
    ModuleLoaderTransformer.prototype.transformExportDeclaration = function(tree) {
      var declaration = tree.declaration;

      if (declaration.type == 'NAMED_EXPORT') {
        var moduleName = declaration.moduleSpecifier && declaration.moduleSpecifier.token.processedValue;
        // export {a as b, c as d}
        // export {a as b, c as d} from 'module'
        if (declaration.specifierSet.type != 'EXPORT_STAR') {
          var expressions = [];
          var specifiers = declaration.specifierSet.specifiers;
          for (var i = 0; i < specifiers.length; i++) {
            var specifier = specifiers[i];
            expressions.push(createAssignmentExpression(
              this.createExportExpression(specifier.rhs ? specifier.rhs.value : specifier.lhs.value),
              moduleName
                ? this.createImportExpression(moduleName, specifier.lhs.value)
                : createIdentifierExpression(specifier.lhs.value)
            ));
          }
          var commaExpression = createExpressionStatement(createCommaExpression(expressions));
          commaExpression.location = tree.location;
          return commaExpression;
        }
        else {
          var exportStarStatement = createAssignmentStatement(createIdentifierExpression(this.exportGlobal), this.createImportExpression(moduleName));
          exportStarStatement.location = tree.location;
          return exportStarStatement;
        }
      }

      // export var p = 4;
      else if (declaration.type == 'VARIABLE_STATEMENT') {
        // export var p = ...
        var varDeclaration = declaration.declarations.declarations[0];
        varDeclaration.initialiser = createAssignmentExpression(
          this.createExportExpression(varDeclaration.lvalue.identifierToken.value), 
          this.transformAny(varDeclaration.initialiser)
        );
        return declaration;
      }
      // export function q() {}
      else if (declaration.type == 'FUNCTION_DECLARATION') {
        var varDeclaration = createVariableDeclaration(
          declaration.name.identifierToken.value, 
          createAssignmentStatement(
            this.createExportExpression(declaration.name.identifierToken.value), 
            this.transformAny(declaration)
          )
        );
        varDeclaration.location = tree.location;
        return createVariableDeclarationList('var', [varDeclaration]);
      }
      // export default ...
      else if (declaration.type == 'EXPORT_DEFAULT') {
        return createAssignmentStatement(
          this.createExportExpression('default'), 
          this.transformAny(declaration.expression)
        );
      }

      return tree;
    }
    return ModuleLoaderTransformer;
  }

  // tree traversal, NB should use visitor pattern here
  function traverse(object, iterator, parent, parentProperty) {
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
        traverse(child, iterator, object, key);
    }
  }

  // given a syntax tree, return the import list
  function getImports(moduleTree) {
    var imports = [];

    function addImport(name) {
      if (indexOf.call(imports, name) == -1)
        imports.push(name);
    }

    traverse(moduleTree, function(node) {
      // import {} from 'foo';
      // export * from 'foo';
      // export { ... } from 'foo';
      // module x from 'foo';
      if (node.type == 'EXPORT_DECLARATION') {
        if (node.declaration.moduleSpecifier)
          addImport(node.declaration.moduleSpecifier.token.processedValue);
      }
      else if (node.type == 'IMPORT_DECLARATION')
        addImport(node.moduleSpecifier.token.processedValue);
      else if (node.type == 'MODULE_DECLARATION')
        addImport(node.expression.token.processedValue);
    });
    return imports;
  }

  // Export the System object
  global.System || (global.System = System);

  var traceurSrc;

  // <script type="module"> support
  // allow a data-init function callback once loaded
  if (isBrowser) {
    var curScript = document.getElementsByTagName('script');
    curScript = curScript[curScript.length - 1];

    // set the path to traceur
    traceurSrc = curScript.getAttribute('data-traceur-src')
      || curScript.src.substr(0, curScript.src.lastIndexOf('/') + 1) + 'traceur.js';

    document.onreadystatechange = function() {
      if (document.readyState == 'interactive') {
        var scripts = document.getElementsByTagName('script');

        for (var i = 0; i < scripts.length; i++) {
          var script = scripts[i];
          if (script.type == 'module') {
            // <script type="module" name="" src=""> support
            var name = script.getAttribute('name');
            var address = script.getAttribute('src');
            var source = script.innerHTML;

            (name
              ? System.define(name, source, { address: address })
              : System.module(source, { address: address })
            ).then(function() {}, function(err) { nextTick(function() { throw err; }); });
          }
        }
      }
    }

    // run the data-init function on the script tag
    if (curScript.getAttribute('data-init'))
      window[curScript.getAttribute('data-init')]();
  }

  function __eval(__source, global, __sourceURL, __moduleName) {
    try {
      Function('global', 'var __moduleName = "' + (__moduleName || '').replace('"', '\"') + '"; with(global) { ' + __source + ' \n }'
        + (__sourceURL && !__source.match(/\/\/[@#] ?(sourceURL|sourceMappingURL)=([^\n]+)/)
        ? '\n//# sourceURL=' + __sourceURL : '')).call(global, global);
    }
    catch(e) {
      if (e.name == 'SyntaxError')
        e.message = 'Evaluating ' + __sourceURL + '\n\t' + e.message;
      throw e;
    }
  }

  if (typeof exports === 'object') {
    module.exports = System;
  }

  global.System || (global.System = System);
  global.SystemPolyfill = System;

})(typeof global !== 'undefined' ? global : this);
