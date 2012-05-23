/*
 * es6-module-loader
 * https://github.com/addyosmani/es6-module-loader
 *
 * Copyright (c) 2012 Luke Hogan, Addy Osmani
 * Licensed under the MIT license.
 */

(function (global) {


  // new Loader( parent [, options ] ) - Module loader constructor
  // The Loader constructor creates a new loader. The first argument is the
  // parent loader. The second is an options object
  //
  // options.global - The loader's global object
  // options.baseURL - The loader's base URL
  // options.linkedTo - The source of the loader's intrinsics (not impl)
  // options.strict -  should code evaluated in the loader be in strict mode?
  // options.resolve( relURL, baseURL ) - The URL resolution hook
  // options.fetch( relURL, baseURL, request, resolved ) - The module loading hook
  // options.translate( src, relURL, baseURL, resolved ) - source translation hook
  function Loader(parent, options) {

    // Initialization of loader state from options
    this._global = options.global || Object.create(null);
    this._baseURL = options.baseURL || this.global && this.global.baseURL;
    if (options.linkedTo === null || options.linkedTo) {
      throw new Error("Setting 'linkedTo' not yet supported.");
    }
    this._strict = options.string === undefined ? false : !! options.string;
    this._resolve = options.resolve || parent.resolve;
    this._fetch = options.fetch || parent.fetch;
    this._translate = options.translate || parent.translate;

    // The internal table of module instance objects
    this._mios = {};
  }


  Object.defineProperty(Loader.prototype, "global", {
    configurable: true,
    enumerable: true,
    get: function () {
      return this._global;
    }
  });

  Object.defineProperty(Loader.prototype, "baseURL", {
    configurable: true,
    enumerable: true,
    get: function () {
      return this._baseURL;
    }
  });


  // Loader.prototype.load( url, callback, errback )
  //
  // The load method takes a string representing a module URL and a
  // callback that receives the result of loading, compiling, and
  // executing the module at that URL. The compiled code is statically
  // associated with this loader, and its URL is the given URL. The
  // additional callback is used if an error occurs.
  Loader.prototype.load = function (url, callback, errback) {
    var key = this._resolve(url, this._baseURL);
    if (this._mios[key]) {
      callback(this._mios[key]);
    } else {
      var self = this;
      this._fetch(url, this._baseURL, {
        fulfill: function (src) {

          var actualSrc, evalSrc;

          actualSrc = self._translate(src, url, self._baseURL, key);
          if (self._strict) {
            actualSrc = "'use strict';\n" + actualSrc;
          }

          evalSrc = eval(actualSrc);
          self.set(url, evalSrc);
          callback(self._mios[key]);
        },
        redirect: function (url, baseURL) {
          throw new Error("'redirect' not yet implemented");
        },
        reject: function (msg) {
          errback(msg);
        }
      }, key);
    }
  };

  // Loader.prototype.eval( src )
  // The eval method takes a string representing a Program and returns
  // the result of compiling and executing the program.
  Loader.prototype.eval = function (sourceText) {
    with(this._global) {
      eval(sourceText);
    }
  };


  // Loader.prototype.evalAsync( src, callback, errback )
  //
  // The evalAsync method takes a string representing a Program and a
  // callback that receives the result of compiling and executing the
  // program. The compiled code is statically associated with this loader,
  // and its URL is the base URL of this loader. The additional callback
  // is used if an error occurs.

  Loader.prototype.evalAsync = function () {
    throw new Error("'evalAsync' is not yet implemented. Its not required until module syntax is natively available.");
  };


  // Loader.prototype.get( url )
  //
  // The get method looks up a module in the loader's module instance table.
  // The URL is resolved to a key by calling the loader's resolve operation.
  Loader.prototype.get = function (url) {
    var key = this._resolve(url, this._baseURL);
    return this._mios[key];
  };


  // Loader.prototype.set( urlOrMods[, mod ] )
  //
  // The set method stores a module or set of modules in the loader's
  // module instance table. Each URL is resolved to a key by calling
  // the loader's resolve operation.
  Loader.prototype.set = function (url, mio) {
    var key = this._resolve(url, this._baseURL);
    if (typeof url === "string") {
      this._mios[key] = Module(mio);
    } else {
      for (var p in key) {
        this._mios[p] = Module(key[p]);
      }
    }
  };

  // Loader.prototype.defineBuiltins( [ obj ] )
  //
  // The defineBuiltins method takes an object and defines all the built-in
  // objects and functions of the ES6 standard library associated with this
  // loader's intrinsics as properties on the object.
  Loader.prototype.defineBuiltins = function (o) {
    if (typeof o != "object") throw new Error("Expected object");
    for (var globalProp in global) {
      o[globalProp] = global;
    }
    return o;
  };


  function Module(o) {

    if (o === null) throw new TypeError("Expected object");
    var obj = Object(o);
    if (obj instanceof Module) {
      return obj;
    } else {

      var mio = Object.create(null);

      for (var key in obj) {
        (function (key) {
          Object.defineProperty(mio, key, {
            configurable: false,
            enumerable: true,
            get: function () {
              return obj[key];
            }
          });
        })(key);
      }

      return mio;
    }
  };


  // Pre-configured Loader instance for easier use
  var defaultSystemLoader = new Loader(null, {
    global: window,
    baseURL: document.URL.substring(0, document.URL.lastIndexOf('\/') + 1),
    strict: false,
    resolve: function (relURL, baseURL) {
      var url = baseURL + relURL;
      return url;
    },
    fetch: function (relURL, baseURL, request, resolved) {
      var url = baseURL + relURL;
      var xhr = new XMLHttpRequest();
      xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) {
          if (xhr.status === 200) {
            request.fulfill(xhr.responseText);
          } else {
            request.reject(xhr.statusText);
          }
        }
      };
      xhr.open("GET", url, true);
      xhr.send(null);
    },
    translate: function (src, relURL, baseURL, resolved) {
      return src;
    }
  });


  // Export the Loader class
  global.Loader = Loader;
  // Export the Module class
  global.Module = Module;
  // Export the System object
  global.System = defaultSystemLoader;


})(window);
