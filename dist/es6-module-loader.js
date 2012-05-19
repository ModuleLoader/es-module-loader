/*! es6-module-loader - v0.1.0 - 5/19/2012
* https://github.com/addyosmani/es6-module-loader
* Copyright (c) 2012 Luke Hogan, Addy Osmani; Licensed MIT */

(function (global) {

  /// Module loader constructor
  function Loader(parent, options) {

    // Initialization of loader state from options
    this._global = options.global || Object.create(null);
    this._baseURL = options.baseURL || this.global && this.global.baseURL;
    if (options.intrinsics === null || options.intrinsics) {
      throw new Error("Setting 'intrinsics' not yet supported.");
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
  Loader.prototype.load = function (url, callback, errback) {
    var key = this._resolve(url, this._baseURL);
    if (this._mios[key]) {
      callback(this._mios[key]);
    } else {
      var self = this;
      this._fetch(url, this._baseURL, {
        fulfill: function (src) {
          var actualSrc = self._translate(src, url, self._baseURL, key);
          if (self._strict) {
            actualSrc = "'use strict';\n" + actualSrc;
          }
          eval(actualSrc);
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
  Loader.prototype.eval = function (sourceText) {
  	console.log('this gets called sometime');
    with(this._global) {
      eval(sourceText);
    }
  }
  Loader.prototype.evalAsync = function () {
    throw new Error("'evalAsync' not yet implemented.  Not needed until module syntax is available.");
  }
  Loader.prototype.get = function (url) {
    var key = this._resolve(url, this._baseURL);
    return this._mios[key];
  }
  Loader.prototype.set = function (url, mio) {
    var key = this._resolve(url, this._baseURL);
    if (typeof url == "string") {
      this._mios[key] = Module(mio);
    } else {
      for (var p in key) {
        this._mios[p] = Module(key[p]);
      }
    }
  }
  Loader.prototype.defineBuiltins = function (o) {
    if (typeof o != "object") throw new Error("Expected object");
    for (var globalProp in global) {
      o[globalProp] = global;
    }
    return o;
  }

  function Module(o) {
    if (o == null) throw new TypeError("Expected object");
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
  }
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