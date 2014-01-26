/*
 * ES6 Module Loader Polyfill
 * https://github.com/ModuleLoader/es6-module-loader
 *
 * Based on the 2013-12-02 specification draft
 * System loader based on example implementation as of 2013-12-03
 *
 * Copyright (c) 2013 Guy Bedford, Luke Hoban, Addy Osmani
 * Licensed under the MIT license.
 *
 */

/*
  ToDo
  - Traceur ModuleTransformer update for new system
  - getImports to use visitor pattern
  - Loader Iterator support
  - Tracking these and spec issues with 'NB' comments in this code
*/
(function () {
  (function() {

    var isBrowser = typeof window != 'undefined';
    var global = isBrowser ? window : this;
    var exports = isBrowser ? window : module.exports;

    var nextTick = isBrowser ? function(fn) { setTimeout(fn, 1); } : process.nextTick;

    /*
    *********************************************************************************************

      Simple Promises A+ Implementation
      Adapted from https://github.com/RubenVerborgh/promiscuous
      Copyright 2013 Ruben Verborgh

    *********************************************************************************************
    */

    var Promise = global.Promise;
    if (Promise) {
      // check if native promises have what we need
      if (Promise.all && Promise.resolve && Promise.reject) {
        Promise = global.Promise;
        var p = new Promise(function(r) {
          if (typeof r != 'function')
            Promise = null;
        });
      }
      else
        Promise = null;
    }
    // export the promises polyfill
    if (!Promise)
    global.Promise = Promise = (function(setImmediate, func, obj) {
      // Type checking utility function
      function is(type, item) { return (typeof item)[0] == type; }

      // Creates a promise, calling callback(resolve, reject), ignoring other parameters.
      function Promise(callback, handler) {
        // The `handler` variable points to the function that will
        // 1) handle a .then(resolved, rejected) call
        // 2) handle a resolve or reject call (if the first argument === `is`)
        // Before 2), `handler` holds a queue of callbacks.
        // After 2), `handler` is a finalized .then handler.
        handler = function pendingHandler(resolved, rejected, value, queue, then, i) {
          queue = pendingHandler.q;

          // Case 1) handle a .then(resolved, rejected) call
          if (resolved != is) {
            return Promise(function(resolve, reject) {
              queue.push({ p: this, r: resolve, j: reject, 1: resolved, 0: rejected });
            });
          }

          // Case 2) handle a resolve or reject call
          // (`resolved` === `is` acts as a sentinel)
          // The actual function signature is
          // .re[ject|solve](<is>, success, value)

          // Check if the value is a promise and try to obtain its `then` method
          if (value && (is(func, value) | is(obj, value))) {
            try { then = value.then; }
            catch (reason) { rejected = 0; value = reason; }
          }
          // If the value is a promise, take over its state
          if (is(func, then)) {
            function valueHandler(resolved) {
              return function(value) { then && (then = 0, pendingHandler(is, resolved, value)); };
            }
            try { then.call(value, valueHandler(1), rejected = valueHandler(0)); }
            catch (reason) { rejected(reason); }
          }
          // The value is not a promise; handle resolve/reject
          else {
            // Replace this handler with a finalized resolved/rejected handler
            handler = createFinalizedThen(callback, value, rejected);
            // Resolve/reject pending callbacks
            i = 0;
            while (i < queue.length) {
              then = queue[i++];
              // If no callback, just resolve/reject the promise
              if (!is(func, resolved = then[rejected]))
                (rejected ? then.r : then.j)(value);
              // Otherwise, resolve/reject the promise with the result of the callback
              else
                finalize(then.p, then.r, then.j, value, resolved);
            }
          }
        };
        // The queue of pending callbacks; garbage-collected when handler is resolved/rejected
        handler.q = [];

        // Create and return the promise (reusing the callback variable)
        callback.call(callback = { then: function (resolved, rejected) { return handler(resolved, rejected); }, 
                                    catch: function (rejected)           { return handler(0,        rejected); } },
                      function(value)  { handler(is, 1,  value); },
                      function(reason) { handler(is, 0, reason); });
        return callback;
      }

      // Creates a resolved or rejected .then function
      function createFinalizedThen(promise, value, success) {
        return function(resolved, rejected) {
          // If the resolved or rejected parameter is not a function, return the original promise
          if (!is(func, (resolved = success ? resolved : rejected)))
            return promise;
          // Otherwise, return a finalized promise, transforming the value with the function
          return Promise(function(resolve, reject) { finalize(this, resolve, reject, value, resolved); });
        };
      }

      // Finalizes the promise by resolving/rejecting it with the transformed value
      function finalize(promise, resolve, reject, value, transform) {
        setImmediate(function() {
          try {
            // Transform the value through and check whether it's a promise
            value = transform(value);
            transform = value && (is(obj, value) | is(func, value)) && value.then;
            // Return the result if it's not a promise
            if (!is(func, transform))
              resolve(value);
            // If it's a promise, make sure it's not circular
            else if (value == promise)
              reject(new TypeError());
            // Take over the promise's state
            else
              transform.call(value, resolve, reject);
          }
          catch (error) { reject(error); }
        });
      }

      // Export the main module
      Promise.resolve = function (value) { return Promise(function (resolve)         { resolve(value) }); };
      Promise.reject = function (reason) { return Promise(function (resolve, reject) { reject(reason) }); };
      Promise.all = function(promises) {
        return new Promise(function(resolve, reject) {
          if (!promises.length)
            return setImmediate(resolve);

          var outputs = [];
          var resolved = 0;
          for (var i = 0, l = promises.length; i < l; i++) (function(i) {
            promises[i].then(function(resolvedVal) {
              outputs[i] = resolvedVal;
              resolved++;
              if (resolved == promises.length)
                resolve(outputs);
            }, reject);
          })(i);
        });
      }
      return Promise;
    })(nextTick, 'f', 'o');


    /*
    *********************************************************************************************
      
      Loader Polyfill

        - Implemented exactly to the 2013-12-02 Specification Draft -
          https://github.com/jorendorff/js-loaders/blob/e60d3651/specs/es6-modules-2013-12-02.pdf
          with the only exceptions as described here

        - Abstract functions have been combined where possible, and their associated functions 
          commented

        - Declarative Module Support is entirely disabled, and an error will be thrown if 
          the instantiate loader hook returns undefined

        - With this assumption, instead of Link, LinkDynamicModules is run directly

        - ES6 support is thus provided through the translate function of the System loader

        - EnsureEvaluated is removed, but may in future implement dynamic execution pending 
          issue - https://github.com/jorendorff/js-loaders/issues/63

        - Realm implementation is entirely omitted. As such, Loader.global and Loader.realm
          accessors will throw errors, as well as Loader.eval

        - Loader module table iteration currently not yet implemented

    *********************************************************************************************
    */

    // Some Helpers

    // logs a linkset snapshot for debugging
    /* function snapshot(loader) {
      console.log('\n');
      for (var i = 0; i < loader._loads.length; i++) {
        var load = loader._loads[i];
        var linkSetLog = load.name + ' (' + load.status + '): ';

        for (var j = 0; j < load.linkSets.length; j++) {
          linkSetLog += '{'
          linkSetLog += logloads(load.linkSets[j].loads);
          linkSetLog += '} ';
        }
        console.log(linkSetLog);
      }
      console.log('\n');
    }
    function logloads(loads) {
      var log = '';
      for (var k = 0; k < loads.length; k++)
        log += loads[k].name + (k != loads.length - 1 ? ' ' : '');
      return log;
    } */

    function assert(name, expression) {
      if (!expression)
        console.log('Assertion Failed - ' + name);
    }
    function defineProperty(obj, prop, opt) {
      if (Object.defineProperty)
        Object.defineProperty(obj, prop, opt);
      else
         obj[prop] = opt.value || opt.get.call(obj);
    };
    function preventExtensions(obj) {
      if (Object.preventExtensions)
        Object.preventExtensions(obj);
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

    // Load Abstract Functions

    function createLoad(name) {
      return {
        status: 'loading',
        name: name,
        metadata: {},
        linkSets: []
      };
    }

    // promise for a load record, can be in registry, already loading, or not
    function requestLoad(loader, request, refererName, refererAddress) {
      return new Promise(function(resolve, reject) {
        // CallNormalize
        resolve(loader.normalize(request, refererName, refererAddress));
      })

      // GetOrCreateLoad
      .then(function(name) {
        var load;
        if (loader._modules[name]) {
          load = createLoad(name);
          load.status = 'linked';
          return load;
        }

        for (var i = 0, l = loader._loads.length; i < l; i++) {
          load = loader._loads[i];
          if (load.name == name) {
            assert('loading or loaded', load.status == 'loading' || load.status == 'loaded');
            return load;
          }
        }

        // CreateLoad
        load = createLoad(name);
        loader._loads.push(load);

        proceedToLocate(loader, load);

        return load;
      });
    }
    function proceedToLocate(loader, load) {
      proceedToFetch(loader, load,
        Promise.resolve()
        // CallLocate
        .then(function() {
          return loader.locate({ name: load.name, metadata: load.metadata });
        })
      );
    }
    function proceedToFetch(loader, load, p) {
      proceedToTranslate(loader, load, 
        p
        // CallFetch
        .then(function(address) {
          if (load.status == 'failed') // NB https://github.com/jorendorff/js-loaders/issues/88
            return undefined;
          load.address = address;
          return loader.fetch({ name: load.name, metadata: load.metadata, address: address });
        })        
      );
    }
    function proceedToTranslate(loader, load, p) {
      p
      // CallTranslate
      .then(function(source) {
        if (load.status == 'failed')
          return undefined;
        return loader.translate({ name: load.name, metadata: load.metadata, address: load.address, source: source })
      })

      // CallInstantiate
      .then(function(source) {
        if (load.status == 'failed')
          return undefined;
        load.source = source;
        return loader.instantiate({ name: load.name, metadata: load.metadata, address: load.address, source: source });
      })

      // InstantiateSucceeded
      .then(function(instantiateResult) {
        if (load.status == 'failed')
          return undefined;

        var depsList;
        if (instantiateResult === undefined)
          throw 'Declarative parsing is not implemented by the polyfill.';

        else if (typeof instantiateResult == 'object') {
          depsList = instantiateResult.deps || [];
          load.execute = instantiateResult.execute;
          load.kind = 'dynamic';
        }
        else
          throw TypeError('Invalid instantiate return value');

        // ProcessLoadDependencies
        load.dependencies = {};
        var loadPromises = [];
        for (var i = 0, l = depsList.length; i < l; i++) (function(request) {
          var p = requestLoad(loader, request, load.name, load.address);

          // AddDependencyLoad (load is parentLoad)
          p.then(function(depLoad) {
            assert('not already a dependency', !load.dependencies[request]);
            load.dependencies[request] = depLoad.name;

            if (depLoad.status != 'linked') {
              var linkSets = load.linkSets.concat([]);
              for (var i = 0, l = linkSets.length; i < l; i++)
                addLoadToLinkSet(linkSets[i], depLoad);
            }
          });

          loadPromises.push(p);
        })(depsList[i]);

        return Promise.all(loadPromises);
      })

      // LoadSucceeded
      .then(function() {
        assert('is loading', load.status == 'loading');

        load.status = 'loaded';

        // console.log('load succeeeded ' + load.name);
        // snapshot(loader);

        var linkSets = load.linkSets.concat([]);
        for (var i = 0, l = linkSets.length; i < l; i++)
          updateLinkSetOnLoad(linkSets[i], load);
      }
      
      // LoadFailed
      , function(exc) {
        assert('is loading on fail', load.status == 'loading');
        load.status = 'failed';
        load.exception = exc;
        for (var i = 0, l = load.linkSets.length; i < l; i++)
          linkSetFailed(load.linkSets[i], exc);
        assert('fail linkSets removed', load.linkSets.length == 0);
      });
    }


    // LinkSet Abstract Functions
    function createLinkSet(loader, startingLoad) {
      var resolve, reject, promise = new Promise(function(_resolve, _reject) { resolve = _resolve; reject = _reject; });
      var linkSet = {
        loader: loader,
        loads: [],
        done: promise,
        resolve: resolve,
        reject: reject,
        loadingCount: 0
      };
      addLoadToLinkSet(linkSet, startingLoad);
      return linkSet;
    }
    function addLoadToLinkSet(linkSet, load) {
      assert('loading or loaded on link set', load.status == 'loading' || load.status == 'loaded');

      for (var i = 0, l = linkSet.loads.length; i < l; i++)
        if (linkSet.loads[i] == load)
          return;

      linkSet.loads.push(load);
      load.linkSets.push(linkSet);

      if (load.status != 'loaded')
        linkSet.loadingCount++;

      var loader = linkSet.loader;

      for (var dep in load.dependencies) {
        var name = load.dependencies[dep];

        if (loader._modules[name])
          continue;

        for (var i = 0, l = loader._loads.length; i < l; i++)
          if (loader._loads[i].name == name) {
            addLoadToLinkSet(linkSet, loader._loads[i]);
            break;
          }
      }
      // console.log('add to linkset ' + load.name);
      // snapshot(linkSet.loader);
    }
    function updateLinkSetOnLoad(linkSet, load) {
      // NB https://github.com/jorendorff/js-loaders/issues/85
      // assert('no load when updated ' + load.name, indexOf.call(linkSet.loads, load) != -1);
      assert('loaded or linked', load.status == 'loaded' || load.status == 'linked');

      // console.log('update linkset on load ' + load.name);
      // snapshot(linkSet.loader);

      // see https://github.com/jorendorff/js-loaders/issues/80
      linkSet.loadingCount--;
      /* for (var i = 0; i < linkSet.loads.length; i++) {
        if (linkSet.loads[i].status == 'loading') {
          return;
        }
      } */
      
      if (linkSet.loadingCount > 0)
        return;

      var startingLoad = linkSet.loads[0];
      try {
        link(linkSet.loads, linkSet.loader);
      }
      catch(exc) {
        return linkSetFailed(linkSet, exc);
      }

      assert('loads cleared', linkSet.loads.length == 0);
      linkSet.resolve(startingLoad);
    }
    function linkSetFailed(linkSet, exc) {
      var loads = linkSet.loads.concat([]);
      for (var i = 0, l = loads.length; i < l; i++) {
        var load = loads[i];
        var linkIndex = indexOf.call(load.linkSets, linkSet);
        assert('link not present', linkIndex != -1);
        load.linkSets.splice(linkIndex, 1);
        if (load.linkSets.length == 0) {
          var globalLoadsIndex = indexOf.call(linkSet.loader._loads, load);
          if (globalLoadsIndex != -1)
            linkSet.loader._loads.splice(globalLoadsIndex, 1);
        }
      }
      linkSet.reject(exc);
    }
    function finishLoad(loader, load) {
      // if not anonymous, add to the module table
      if (load.name) {
        assert('load not in module table', !loader._modules[load.name]);
        loader._modules[load.name] = load.module;
      }
      var loadIndex = indexOf.call(loader._loads, load);
      if (loadIndex != -1)
        loader._loads.splice(loadIndex, 1);
      for (var i = 0, l = load.linkSets.length; i < l; i++) {
        loadIndex = indexOf.call(load.linkSets[i].loads, load);
        load.linkSets[i].loads.splice(loadIndex, 1);
      }
      load.linkSets = [];
    }
    function loadModule(loader, name, options) {
      return new Promise(asyncStartLoadPartwayThrough(loader, name, options && options.address ? 'fetch' : 'locate', undefined, options && options.address, undefined)).then(function(load) {
        return load;
      });
    }
    function asyncStartLoadPartwayThrough(loader, name, step, meta, address, source) {
      return function(resolve, reject) {
        if (loader._modules[name])
          throw new TypeError('Module "' + name + '" already exists in the module table');
        for (var i = 0, l = loader._loads.length; i < l; i++)
          if (loader._loads[i].name == name)
            throw new TypeError('Module "' + name + '" is already loading');

        var load = createLoad(name);

        if (meta)
          load.metadata = meta;

        var linkSet = createLinkSet(loader, load);

        loader._loads.push(load);

        // NB spec change as in https://github.com/jorendorff/js-loaders/issues/79
        linkSet.done.then(resolve, reject);

        if (step == 'locate')
          proceedToLocate(loader, load);

        else if (step == 'fetch')
          proceedToFetch(loader, load, Promise.resolve(address));

        else {
          assert('translate step', step == 'translate');
          load.address = address;
          proceedToTranslate(loader, load, Promise.resolve(source));
        }
      }
    }
    function evaluateLoadedModule(loader, load) {
      assert('is linked ' + load.name, load.status == 'linked');

      assert('is a module', load.module instanceof Module);

      // ensureEvaluated(load.module, [], loader);

      return load.module;
    }

    // Module Object
    function Module(obj) {
      if (typeof obj != 'object')
        throw new TypeError('Expected object');

      if (!(this instanceof Module))
        return new Module(obj);

      var self = this;
      for (var key in obj) {
        (function (key, value) {
          defineProperty(self, key, {
            configurable: false,
            enumerable: true,
            get: function () {
              return value;
            }
          });
        })(key, obj[key]);
      }
      preventExtensions(this);
    }
    // Module.prototype = null;


    // Linking
    // Link is directly LinkDynamicModules assuming all modules are dynamic
    function link(loads, loader) {
      // console.log('linking {' + logloads(loads) + '}');

      // continue until all linked
      // NB circular dependencies will stall this loop
      var loopCnt = 0;
      while (loads.length) {
        loopCnt++;
        // search through to find a load with all its dependencies linked
        search: for (var i = 0; i < loads.length; i++) {
          var load = loads[i];
          var depNames = [];
          for (var d in load.dependencies) {
            var depName = load.dependencies[d];
            // being in the module table means it is linked
            if (!loader._modules[depName])
              continue search;
            depNames.push(depName);
          }

          // all dependencies linked now, so we can execute
          var module = load.execute.apply(null, depNames);
          if (!(module instanceof Module))
            throw new TypeError('Execution must define a Module instance');
          load.module = module;
          load.status = 'linked';
          finishLoad(loader, load);
        }
        if (loopCnt === 1000) {
          console.log('Circular Dependency Detected');
          return;
        }
      }
      // console.log('linked');
    }

    // Loader
    function Loader(options) {
      if (typeof options != 'object')
        throw new TypeError('Options must be an object');

      if (options.normalize)
        this.normalize = options.normalize;
      if (options.locate)
        this.locate = options.locate;
      if (options.fetch)
        this.fetch = options.fetch;
      if (options.translate)
        this.translate = options.translate;
      if (options.instantiate)
        this.instantiate = options.instantiate;

      defineProperty(this, 'global', {
        get: function() {
          throw new TypeError('global accessor not provided by polyfill');
        }
      });
      defineProperty(this, 'realm', {
        get: function() {
          throw new TypeError('Realms not implemented in polyfill');
        }
      });
      
      this._modules = {};
      this._loads = [];
    }

    // NB importPromises hacks ability to import a module twice without error - https://github.com/jorendorff/js-loaders/issues/60
    var importPromises = {};
    Loader.prototype = {
      define: function(name, source, options) {
        if (importPromises[name])
          throw new TypeError('Module is already loading.');
        importPromises[name] = new Promise(asyncStartLoadPartwayThrough(this, name, options && options.address ? 'fetch' : 'translate', options && options.meta || {}, options && options.address, source));
        return importPromises[name].then(function() { delete importPromises[name]; });
      },
      load: function(request, options) {
        if (this._modules[request])
          return Promise.resolve(this._modules[request]);
        if (importPromises[request])
          return importPromises[request];
        importPromises[request] = loadModule(this, request, options);
        return importPromises[request].then(function() { delete importPromises[request]; })
      },
      module: function(source, options) {
        var load = createLoad();
        load.address = options && options.address;
        var linkSet = createLinkSet(this, load);
        var sourcePromise = Promise.resolve(source);
        var p = linkSet.done.then(function() {
          evaluateLoadedModule(this, load);
        });
        proceedToTranslate(this, load, sourcePromise);
        return p;
      },
      import: function(name, options) {
        if (this._modules[name])
          return Promise.resolve(this._modules[name]);
        return (importPromises[name] || (importPromises[name] = loadModule(this, name, options)))
          .then(function(load) {
            delete importPromises[name];
            return evaluateLoadedModule(this, load);
          });
      },
      eval: function(source) {
        throw new TypeError('Eval not implemented in polyfill')
      },
      get: function(key) {
        // NB run ensure evaluted here when implemented
        return this._modules[key];
      },
      has: function(name) {
        return !!this._modules[name];
      },
      set: function(name, module) {
        if (!(module instanceof Module))
          throw new TypeError('Set must be a module');
        this._modules[name] = module;
      },
      delete: function(name) {
        return this._modules[name] ? delete this._modules[name] : false;
      },
      // NB implement iterations
      entries: function() {
        throw new TypeError('Iteration not yet implemented in the polyfill');
      },
      keys: function() {
        throw new TypeError('Iteration not yet implemented in the polyfill');
      },
      values: function() {
        throw new TypeError('Iteration not yet implemented in the polyfill');
      },
      normalize: function(name, refererName, refererAddress) {
        return name;
      },
      locate: function(load) {
        return load.name;
      },
      fetch: function(load) {
        throw new TypeError('Fetch not implemented');
      },
      translate: function(load) {
        return load.source;
      },
      instantiate: function(load) {
      }
    };



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

    var fetchTextFromURL;
    if (isBrowser) {
      fetchTextFromURL = function(url, fulfill, reject) {
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
              return new global.Module({});
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
              if (isBrowser)
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
        return Promise.resolve(traceur);

      if (traceurPromise)
        return traceurPromise;

      return traceurPromise = (isBrowser ? exports.System.import : function(name, src, callback) {
        return Promise.resolve(require('traceur'));
      }).call(exports.System, 'traceur', { address: traceurSrc }).then(function(_traceur) {
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


    // Export the Loader class
    exports.Loader = Loader;
    // Export the Module class
    exports.Module = Module;
    // Export the System object
    exports.System = System;

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

  })();

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

})();
