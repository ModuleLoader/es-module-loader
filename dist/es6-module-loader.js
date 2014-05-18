(function() {
var define, requireModule, require, requirejs;

(function() {
  var registry = {}, seen = {};

  define = function(name, deps, callback) {
    registry[name] = { deps: deps, callback: callback };
  };

  requirejs = require = requireModule = function(name) {
  requirejs._eak_seen = registry;

    if (seen[name]) { return seen[name]; }
    seen[name] = {};

    if (!registry[name]) {
      throw new Error("Could not find module " + name);
    }

    var mod = registry[name],
        deps = mod.deps,
        callback = mod.callback,
        reified = [],
        exports;

    for (var i=0, l=deps.length; i<l; i++) {
      if (deps[i] === 'exports') {
        reified.push(exports = {});
      } else {
        reified.push(requireModule(resolve(deps[i])));
      }
    }

    var value = callback.apply(this, reified);
    return seen[name] = exports || value;

    function resolve(child) {
      if (child.charAt(0) !== '.') { return child; }
      var parts = child.split("/");
      var parentBase = name.split("/").slice(0, -1);

      for (var i=0, l=parts.length; i<l; i++) {
        var part = parts[i];

        if (part === '..') { parentBase.pop(); }
        else if (part === '.') { continue; }
        else { parentBase.push(part); }
      }

      return parentBase.join("/");
    }
  };
})();

define("promise/all", 
  ["./utils","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    /* global toString */

    var isArray = __dependency1__.isArray;
    var isFunction = __dependency1__.isFunction;

    /**
      Returns a promise that is fulfilled when all the given promises have been
      fulfilled, or rejected if any of them become rejected. The return promise
      is fulfilled with an array that gives all the values in the order they were
      passed in the `promises` array argument.

      Example:

      ```javascript
      var promise1 = RSVP.resolve(1);
      var promise2 = RSVP.resolve(2);
      var promise3 = RSVP.resolve(3);
      var promises = [ promise1, promise2, promise3 ];

      RSVP.all(promises).then(function(array){
        // The array here would be [ 1, 2, 3 ];
      });
      ```

      If any of the `promises` given to `RSVP.all` are rejected, the first promise
      that is rejected will be given as an argument to the returned promises's
      rejection handler. For example:

      Example:

      ```javascript
      var promise1 = RSVP.resolve(1);
      var promise2 = RSVP.reject(new Error("2"));
      var promise3 = RSVP.reject(new Error("3"));
      var promises = [ promise1, promise2, promise3 ];

      RSVP.all(promises).then(function(array){
        // Code here never runs because there are rejected promises!
      }, function(error) {
        // error.message === "2"
      });
      ```

      @method all
      @for RSVP
      @param {Array} promises
      @param {String} label
      @return {Promise} promise that is fulfilled when all `promises` have been
      fulfilled, or rejected if any of them become rejected.
    */
    function all(promises) {
      /*jshint validthis:true */
      var Promise = this;

      if (!isArray(promises)) {
        throw new TypeError('You must pass an array to all.');
      }

      return new Promise(function(resolve, reject) {
        var results = [], remaining = promises.length,
        promise;

        if (remaining === 0) {
          resolve([]);
        }

        function resolver(index) {
          return function(value) {
            resolveAll(index, value);
          };
        }

        function resolveAll(index, value) {
          results[index] = value;
          if (--remaining === 0) {
            resolve(results);
          }
        }

        for (var i = 0; i < promises.length; i++) {
          promise = promises[i];

          if (promise && isFunction(promise.then)) {
            promise.then(resolver(i), reject);
          } else {
            resolveAll(i, promise);
          }
        }
      });
    }

    __exports__.all = all;
  });
define("promise/asap", 
  ["exports"],
  function(__exports__) {
    "use strict";
    var browserGlobal = (typeof window !== 'undefined') ? window : {};
    var BrowserMutationObserver = browserGlobal.MutationObserver || browserGlobal.WebKitMutationObserver;
    var local = (typeof global !== 'undefined') ? global : (this === undefined? window:this);

    // node
    function useNextTick() {
      return function() {
        process.nextTick(flush);
      };
    }

    function useMutationObserver() {
      var iterations = 0;
      var observer = new BrowserMutationObserver(flush);
      var node = document.createTextNode('');
      observer.observe(node, { characterData: true });

      return function() {
        node.data = (iterations = ++iterations % 2);
      };
    }

    function useSetTimeout() {
      return function() {
        local.setTimeout(flush, 1);
      };
    }

    var queue = [];
    function flush() {
      for (var i = 0; i < queue.length; i++) {
        var tuple = queue[i];
        var callback = tuple[0], arg = tuple[1];
        callback(arg);
      }
      queue = [];
    }

    var scheduleFlush;

    // Decide what async method to use to triggering processing of queued callbacks:
    if (typeof process !== 'undefined' && {}.toString.call(process) === '[object process]') {
      scheduleFlush = useNextTick();
    } else if (BrowserMutationObserver) {
      scheduleFlush = useMutationObserver();
    } else {
      scheduleFlush = useSetTimeout();
    }

    function asap(callback, arg) {
      var length = queue.push([callback, arg]);
      if (length === 1) {
        // If length is 1, that means that we need to schedule an async flush.
        // If additional callbacks are queued before the queue is flushed, they
        // will be processed by this flush that we are scheduling.
        scheduleFlush();
      }
    }

    __exports__.asap = asap;
  });
define("promise/config", 
  ["exports"],
  function(__exports__) {
    "use strict";
    var config = {
      instrument: false
    };

    function configure(name, value) {
      if (arguments.length === 2) {
        config[name] = value;
      } else {
        return config[name];
      }
    }

    __exports__.config = config;
    __exports__.configure = configure;
  });
define("promise/polyfill", 
  ["./promise","./utils","exports"],
  function(__dependency1__, __dependency2__, __exports__) {
    "use strict";
    /*global self*/
    var RSVPPromise = __dependency1__.Promise;
    var isFunction = __dependency2__.isFunction;

    function polyfill() {
      var local;

      if (typeof global !== 'undefined') {
        local = global;
      } else if (typeof window !== 'undefined' && window.document) {
        local = window;
      } else {
        local = self;
      }

      var es6PromiseSupport = 
        "Promise" in local &&
        // Some of these methods are missing from
        // Firefox/Chrome experimental implementations
        "resolve" in local.Promise &&
        "reject" in local.Promise &&
        "all" in local.Promise &&
        "race" in local.Promise &&
        // Older version of the spec had a resolver object
        // as the arg rather than a function
        (function() {
          var resolve;
          new local.Promise(function(r) { resolve = r; });
          return isFunction(resolve);
        }());

      if (!es6PromiseSupport) {
        local.Promise = RSVPPromise;
      }
    }

    __exports__.polyfill = polyfill;
  });
define("promise/promise", 
  ["./config","./utils","./all","./race","./resolve","./reject","./asap","exports"],
  function(__dependency1__, __dependency2__, __dependency3__, __dependency4__, __dependency5__, __dependency6__, __dependency7__, __exports__) {
    "use strict";
    var config = __dependency1__.config;
    var configure = __dependency1__.configure;
    var objectOrFunction = __dependency2__.objectOrFunction;
    var isFunction = __dependency2__.isFunction;
    var now = __dependency2__.now;
    var all = __dependency3__.all;
    var race = __dependency4__.race;
    var staticResolve = __dependency5__.resolve;
    var staticReject = __dependency6__.reject;
    var asap = __dependency7__.asap;

    var counter = 0;

    config.async = asap; // default async is asap;

    function Promise(resolver) {
      if (!isFunction(resolver)) {
        throw new TypeError('You must pass a resolver function as the first argument to the promise constructor');
      }

      if (!(this instanceof Promise)) {
        throw new TypeError("Failed to construct 'Promise': Please use the 'new' operator, this object constructor cannot be called as a function.");
      }

      this._subscribers = [];

      invokeResolver(resolver, this);
    }

    function invokeResolver(resolver, promise) {
      function resolvePromise(value) {
        resolve(promise, value);
      }

      function rejectPromise(reason) {
        reject(promise, reason);
      }

      try {
        resolver(resolvePromise, rejectPromise);
      } catch(e) {
        rejectPromise(e);
      }
    }

    function invokeCallback(settled, promise, callback, detail) {
      var hasCallback = isFunction(callback),
          value, error, succeeded, failed;

      if (hasCallback) {
        try {
          value = callback(detail);
          succeeded = true;
        } catch(e) {
          failed = true;
          error = e;
        }
      } else {
        value = detail;
        succeeded = true;
      }

      if (handleThenable(promise, value)) {
        return;
      } else if (hasCallback && succeeded) {
        resolve(promise, value);
      } else if (failed) {
        reject(promise, error);
      } else if (settled === FULFILLED) {
        resolve(promise, value);
      } else if (settled === REJECTED) {
        reject(promise, value);
      }
    }

    var PENDING   = void 0;
    var SEALED    = 0;
    var FULFILLED = 1;
    var REJECTED  = 2;

    function subscribe(parent, child, onFulfillment, onRejection) {
      var subscribers = parent._subscribers;
      var length = subscribers.length;

      subscribers[length] = child;
      subscribers[length + FULFILLED] = onFulfillment;
      subscribers[length + REJECTED]  = onRejection;
    }

    function publish(promise, settled) {
      var child, callback, subscribers = promise._subscribers, detail = promise._detail;

      for (var i = 0; i < subscribers.length; i += 3) {
        child = subscribers[i];
        callback = subscribers[i + settled];

        invokeCallback(settled, child, callback, detail);
      }

      promise._subscribers = null;
    }

    Promise.prototype = {
      constructor: Promise,

      _state: undefined,
      _detail: undefined,
      _subscribers: undefined,

      then: function(onFulfillment, onRejection) {
        var promise = this;

        var thenPromise = new this.constructor(function() {});

        if (this._state) {
          var callbacks = arguments;
          config.async(function invokePromiseCallback() {
            invokeCallback(promise._state, thenPromise, callbacks[promise._state - 1], promise._detail);
          });
        } else {
          subscribe(this, thenPromise, onFulfillment, onRejection);
        }

        return thenPromise;
      },

      'catch': function(onRejection) {
        return this.then(null, onRejection);
      }
    };

    Promise.all = all;
    Promise.race = race;
    Promise.resolve = staticResolve;
    Promise.reject = staticReject;

    function handleThenable(promise, value) {
      var then = null,
      resolved;

      try {
        if (promise === value) {
          throw new TypeError("A promises callback cannot return that same promise.");
        }

        if (objectOrFunction(value)) {
          then = value.then;

          if (isFunction(then)) {
            then.call(value, function(val) {
              if (resolved) { return true; }
              resolved = true;

              if (value !== val) {
                resolve(promise, val);
              } else {
                fulfill(promise, val);
              }
            }, function(val) {
              if (resolved) { return true; }
              resolved = true;

              reject(promise, val);
            });

            return true;
          }
        }
      } catch (error) {
        if (resolved) { return true; }
        reject(promise, error);
        return true;
      }

      return false;
    }

    function resolve(promise, value) {
      if (promise === value) {
        fulfill(promise, value);
      } else if (!handleThenable(promise, value)) {
        fulfill(promise, value);
      }
    }

    function fulfill(promise, value) {
      if (promise._state !== PENDING) { return; }
      promise._state = SEALED;
      promise._detail = value;

      config.async(publishFulfillment, promise);
    }

    function reject(promise, reason) {
      if (promise._state !== PENDING) { return; }
      promise._state = SEALED;
      promise._detail = reason;

      config.async(publishRejection, promise);
    }

    function publishFulfillment(promise) {
      publish(promise, promise._state = FULFILLED);
    }

    function publishRejection(promise) {
      publish(promise, promise._state = REJECTED);
    }

    __exports__.Promise = Promise;
  });
define("promise/race", 
  ["./utils","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    /* global toString */
    var isArray = __dependency1__.isArray;

    /**
      `RSVP.race` allows you to watch a series of promises and act as soon as the
      first promise given to the `promises` argument fulfills or rejects.

      Example:

      ```javascript
      var promise1 = new RSVP.Promise(function(resolve, reject){
        setTimeout(function(){
          resolve("promise 1");
        }, 200);
      });

      var promise2 = new RSVP.Promise(function(resolve, reject){
        setTimeout(function(){
          resolve("promise 2");
        }, 100);
      });

      RSVP.race([promise1, promise2]).then(function(result){
        // result === "promise 2" because it was resolved before promise1
        // was resolved.
      });
      ```

      `RSVP.race` is deterministic in that only the state of the first completed
      promise matters. For example, even if other promises given to the `promises`
      array argument are resolved, but the first completed promise has become
      rejected before the other promises became fulfilled, the returned promise
      will become rejected:

      ```javascript
      var promise1 = new RSVP.Promise(function(resolve, reject){
        setTimeout(function(){
          resolve("promise 1");
        }, 200);
      });

      var promise2 = new RSVP.Promise(function(resolve, reject){
        setTimeout(function(){
          reject(new Error("promise 2"));
        }, 100);
      });

      RSVP.race([promise1, promise2]).then(function(result){
        // Code here never runs because there are rejected promises!
      }, function(reason){
        // reason.message === "promise2" because promise 2 became rejected before
        // promise 1 became fulfilled
      });
      ```

      @method race
      @for RSVP
      @param {Array} promises array of promises to observe
      @param {String} label optional string for describing the promise returned.
      Useful for tooling.
      @return {Promise} a promise that becomes fulfilled with the value the first
      completed promises is resolved with if the first completed promise was
      fulfilled, or rejected with the reason that the first completed promise
      was rejected with.
    */
    function race(promises) {
      /*jshint validthis:true */
      var Promise = this;

      if (!isArray(promises)) {
        throw new TypeError('You must pass an array to race.');
      }
      return new Promise(function(resolve, reject) {
        var results = [], promise;

        for (var i = 0; i < promises.length; i++) {
          promise = promises[i];

          if (promise && typeof promise.then === 'function') {
            promise.then(resolve, reject);
          } else {
            resolve(promise);
          }
        }
      });
    }

    __exports__.race = race;
  });
define("promise/reject", 
  ["exports"],
  function(__exports__) {
    "use strict";
    /**
      `RSVP.reject` returns a promise that will become rejected with the passed
      `reason`. `RSVP.reject` is essentially shorthand for the following:

      ```javascript
      var promise = new RSVP.Promise(function(resolve, reject){
        reject(new Error('WHOOPS'));
      });

      promise.then(function(value){
        // Code here doesn't run because the promise is rejected!
      }, function(reason){
        // reason.message === 'WHOOPS'
      });
      ```

      Instead of writing the above, your code now simply becomes the following:

      ```javascript
      var promise = RSVP.reject(new Error('WHOOPS'));

      promise.then(function(value){
        // Code here doesn't run because the promise is rejected!
      }, function(reason){
        // reason.message === 'WHOOPS'
      });
      ```

      @method reject
      @for RSVP
      @param {Any} reason value that the returned promise will be rejected with.
      @param {String} label optional string for identifying the returned promise.
      Useful for tooling.
      @return {Promise} a promise that will become rejected with the given
      `reason`.
    */
    function reject(reason) {
      /*jshint validthis:true */
      var Promise = this;

      return new Promise(function (resolve, reject) {
        reject(reason);
      });
    }

    __exports__.reject = reject;
  });
define("promise/resolve", 
  ["exports"],
  function(__exports__) {
    "use strict";
    function resolve(value) {
      /*jshint validthis:true */
      if (value && typeof value === 'object' && value.constructor === this) {
        return value;
      }

      var Promise = this;

      return new Promise(function(resolve) {
        resolve(value);
      });
    }

    __exports__.resolve = resolve;
  });
define("promise/utils", 
  ["exports"],
  function(__exports__) {
    "use strict";
    function objectOrFunction(x) {
      return isFunction(x) || (typeof x === "object" && x !== null);
    }

    function isFunction(x) {
      return typeof x === "function";
    }

    function isArray(x) {
      return Object.prototype.toString.call(x) === "[object Array]";
    }

    // Date.now is not available in browsers < IE9
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/now#Compatibility
    var now = Date.now || function() { return new Date().getTime(); };


    __exports__.objectOrFunction = objectOrFunction;
    __exports__.isFunction = isFunction;
    __exports__.isArray = isArray;
    __exports__.now = now;
  });
requireModule('promise/polyfill').polyfill();
}());
/*
*********************************************************************************************

  Loader Polyfill

    - Implemented exactly to the 2014-04-27 Specification Draft.
      Loader implemented to the modules draft from
      https://github.com/jorendorff/js-loaders/blob/e60d3651/specs/es6-modules-2013-12-02.pdf
    
    - All functions are commented with their spec numbers, with spec differences commented.

    - All spec bugs are commented in this code with links to the spec bugs.

    - Abstract functions have been combined where possible, and their associated functions
      commented.

    - When the traceur global is detected, declarative modules are transformed by Traceur
      into the `instantiate` System.register output.

    - Realm implementation is entirely omitted. As such, the Loader.realm accessor will 
      throw an error, as well as Loader.eval. Realm arguments are not passed.

    - Loader module table iteration currently not yet implemented

*********************************************************************************************
*/

// Some Helpers

// logs a linkset snapshot for debugging
/* function snapshot(loader) {
  console.log('---Snapshot---');
  for (var i = 0; i < loader.loads.length; i++) {
    var load = loader.loads[i];
    var linkSetLog = '  ' + load.name + ' (' + load.status + '): ';

    for (var j = 0; j < load.linkSets.length; j++) {
      linkSetLog += '{' + logloads(load.linkSets[j].loads) + '} ';
    }
    console.log(linkSetLog);
  }
  console.log('');
}
function logloads(loads) {
  var log = '';
  for (var k = 0; k < loads.length; k++)
    log += loads[k].name + (k != loads.length - 1 ? ' ' : '');
  return log;
} */


/* function checkInvariants() {
  // see https://bugs.ecmascript.org/show_bug.cgi?id=2603#c1

  var loads = System._loader.loads;
  var linkSets = [];
  
  for (var i = 0; i < loads.length; i++) {
    var load = loads[i];
    console.assert(load.status == 'loading' || load.status == 'loaded', 'Each load is loading or loaded');

    for (var j = 0; j < load.linkSets.length; j++) {
      var linkSet = load.linkSets[j];

      for (var k = 0; k < linkSet.loads.length; k++)
        console.assert(loads.indexOf(linkSet.loads[k]) != -1, 'linkSet loads are a subset of loader loads');

      if (linkSets.indexOf(linkSet) == -1)
        linkSets.push(linkSet);
    }
  }

  for (var i = 0; i < loads.length; i++) {
    var load = loads[i];
    for (var j = 0; j < linkSets.length; j++) {
      var linkSet = linkSets[j];

      if (linkSet.loads.indexOf(load) != -1)
        console.assert(load.linkSets.indexOf(linkSet) != -1, 'linkSet contains load -> load contains linkSet');

      if (load.linkSets.indexOf(linkSet) != -1)
        console.assert(linkSet.loads.indexOf(load) != -1, 'load contains linkSet -> linkSet contains load');
    }
  }

  for (var i = 0; i < linkSets.length; i++) {
    var linkSet = linkSets[i];
    for (var j = 0; j < linkSet.loads.length; j++) {
      var load = linkSet.loads[j];

      for (var k = 0; k < load.dependencies.length; k++) {
        var depName = load.dependencies[k].value;
        var depLoad;
        for (var l = 0; l < loads.length; l++) {
          if (loads[l].name != depName)
            continue;
          depLoad = loads[l];
          break;
        }

        // loading records are allowed not to have their dependencies yet
        // if (load.status != 'loading')
        //  console.assert(depLoad, 'depLoad found');

        // console.assert(linkSet.loads.indexOf(depLoad) != -1, 'linkset contains all dependencies');
      }
    }
  }
} */


(function (__global) {
  (function() {
    var Promise = __global.Promise || require('es6-promise').Promise;

    var traceur;

    var defineProperty;
    try {
      if (!!Object.defineProperty({}, 'a', {})) {
        defineProperty = Object.defineProperty;
      }
    } catch (e) {
      defineProperty = function (obj, prop, opt) {
        try {
          obj[prop] = opt.value || opt.get.call(obj);
        }
        catch(e) {}
      }
    }

    console.assert = console.assert || function() {};

    // Define an IE-friendly shim good-enough for purposes
    var indexOf = Array.prototype.indexOf || function(item) {
      for (var i = 0, thisLen = this.length; i < thisLen; i++) {
        if (this[i] === item) {
          return i;
        }
      }
      return -1;
    };

    // 15.2.3 - Runtime Semantics: Loader State

    // 15.2.3.11
    function createLoaderLoad(object) {
      return {
        // modules is an object for ES5 implementation
        modules: {},
        loads: [],
        loaderObj: object
      };
    }

    // 15.2.3.2 Load Records and LoadRequest Objects

    // 15.2.3.2.1
    function createLoad(name) {
      return {
        status: 'loading',
        name: name,
        linkSets: [],
        dependencies: [],
        metadata: {}
      };
    }

    // 15.2.3.2.2 createLoadRequestObject, absorbed into calling functions
    
    // 15.2.4

    // 15.2.4.1
    function loadModule(loader, name, options) {
      return new Promise(asyncStartLoadPartwayThrough({
        step: options.address ? 'fetch' : 'locate',
        loader: loader,
        moduleName: name,
        moduleMetadata: {},
        moduleSource: options.source,
        moduleAddress: options.address
      }));
    }

    // 15.2.4.2
    function requestLoad(loader, request, refererName, refererAddress) {
      // 15.2.4.2.1 CallNormalize
      return new Promise(function(resolve, reject) {
        resolve(loader.loaderObj.normalize(request, refererName, refererAddress));
      })
      // 15.2.4.2.2 GetOrCreateLoad
      .then(function(name) {
        var load;
        if (loader.modules[name]) {
          return { name: name };
          // See https://bugs.ecmascript.org/show_bug.cgi?id=2795
          /* load = createLoad(name);
          load.status = 'linked';
          load.module = loader.modules[name];
          return load; */
        }

        for (var i = 0, l = loader.loads.length; i < l; i++) {
          load = loader.loads[i];
          if (load.name != name)
            continue;
          console.assert(load.status == 'loading' || load.status == 'loaded', 'loading or loaded');
          return load;
        }

        load = createLoad(name);
        loader.loads.push(load);

        proceedToLocate(loader, load);

        return load;
      });
    }
    
    // 15.2.4.3
    function proceedToLocate(loader, load) {
      proceedToFetch(loader, load,
        Promise.resolve()
        // 15.2.4.3.1 CallLocate
        .then(function() {
          return loader.loaderObj.locate({ name: load.name, metadata: load.metadata });
        })
      );
    }

    // 15.2.4.4
    function proceedToFetch(loader, load, p) {
      proceedToTranslate(loader, load,
        p
        // 15.2.4.4.1 CallFetch
        .then(function(address) {
          // adjusted, see https://bugs.ecmascript.org/show_bug.cgi?id=2602
          if (load.status != 'loading')
            return;
          load.address = address;

          return loader.loaderObj.fetch({ name: load.name, metadata: load.metadata, address: address });
        })
      );
    }

    // 15.2.4.5
    function proceedToTranslate(loader, load, p) {
      p
      // 15.2.4.5.1 CallTranslate
      .then(function(source) {
        if (load.status != 'loading')
          return;
        return loader.loaderObj.translate({ name: load.name, metadata: load.metadata, address: load.address, source: source });
      })

      // 15.2.4.5.2 CallInstantiate
      .then(function(source) {
        if (load.status != 'loading')
          return;
        load.source = source;
        return loader.loaderObj.instantiate({ name: load.name, metadata: load.metadata, address: load.address, source: source });
      })

      // 15.2.4.5.3 InstantiateSucceeded
      .then(function(instantiateResult) {
        if (load.status != 'loading')
          return;

        var depsList;
        if (instantiateResult === undefined) {
          if (!__global.traceur)
            throw new TypeError('Include Traceur for module syntax support');

          traceur = traceur || __global.traceur;
          load.address = load.address || 'anon' + ++anonCnt;

          console.assert(load.source, 'Non-empty source');

          try {
            var parser = new traceur.syntax.Parser(new traceur.syntax.SourceFile(load.address, load.source));
            var body = parser.parseModule();

            load.kind = 'declarative';
            depsList = getImports(body);

            var oldSourceMaps = traceur.options.sourceMaps;
            var oldModules = traceur.options.modules;

            traceur.options.sourceMaps = true;
            traceur.options.modules = 'instantiate';

            var reporter = new traceur.util.ErrorReporter();

            reporter.reportMessageInternal = function(location, kind, format, args) {
              throw new SyntaxError(kind, location.start && location.start.line_, location.start && location.start.column_);
            }

            // traceur expects its version of System
            var curSystem = __global.System;
            __global.System = __global.traceurSystem;

            var tree = (new traceur.codegeneration.module.AttachModuleNameTransformer(load.name)).transformAny(body);
            tree = (new traceur.codegeneration.FromOptionsTransformer(reporter)).transform(tree);

            var sourceMapGenerator = new traceur.outputgeneration.SourceMapGenerator({ file: load.address });
            var options = { sourceMapGenerator: sourceMapGenerator };

            var source = traceur.outputgeneration.TreeWriter.write(tree, options);

            if (__global.btoa)
              source += '\n//# sourceMappingURL=data:application/json;base64,' + btoa(unescape(encodeURIComponent(options.sourceMap))) + '\n';

            // now run System.register
            var curRegister = System.register;
            
            System.register = function(name, deps, declare) {
              // store the registered declaration as load.declare
              load.declare = typeof name == 'string' ? declare : deps;
            }

            __eval(source, __global, load.name);
          }
          catch(e) {
            if (e.name == 'SyntaxError' || e.name == 'TypeError') 
              e.message = 'Evaluating ' + (load.name || load.address) + '\n\t' + e.message;
            if (curRegister)
              System.register = curRegister;
            if (curSystem)
              __global.System = curSystem;
            if (oldSourceMaps)
              traceur.options.sourceMaps = oldSourceMaps;
            if (oldModules)
              traceur.options.modules = oldModules;
            throw e;
          }
          System.register = curRegister;
          __global.System = curSystem;
          traceur.options.sourceMaps = oldSourceMaps;
          traceur.options.modules = oldModules;
        }
        else if (typeof instantiateResult == 'object') {
          depsList = instantiateResult.deps || [];
          load.execute = instantiateResult.execute;
          load.kind = 'dynamic';
        }
        else
          throw TypeError('Invalid instantiate return value');

        // 15.2.4.6 ProcessLoadDependencies
        load.dependencies = [];
        load.depsList = depsList;

        var loadPromises = [];
        for (var i = 0, l = depsList.length; i < l; i++) (function(request) {
          loadPromises.push(
            requestLoad(loader, request, load.name, load.address)

            // 15.2.4.6.1 AddDependencyLoad (load is parentLoad)
            .then(function(depLoad) {

              console.assert(!load.dependencies.some(function(dep) {
                return dep.key == request;
              }), 'not already a dependency');

              load.dependencies.push({
                key: request,
                value: depLoad.name
              });

              if (!depLoad.status)
                return;

              if (depLoad.status != 'linked') {
                var linkSets = load.linkSets.concat([]);
                for (var i = 0, l = linkSets.length; i < l; i++)
                  addLoadToLinkSet(linkSets[i], depLoad);
              }

              // console.log('AddDependencyLoad ' + depLoad.name + ' for ' + load.name);
              // snapshot(loader);
            })
          );
        })(depsList[i]);

        return Promise.all(loadPromises);
      })

      // 15.2.4.6.2 LoadSucceeded
      .then(function() {
        // console.log('LoadSucceeded ' + load.name);
        // snapshot(loader);

        console.assert(load.status == 'loading', 'is loading');

        load.status = 'loaded';

        var linkSets = load.linkSets.concat([]);
        for (var i = 0, l = linkSets.length; i < l; i++)
          updateLinkSetOnLoad(linkSets[i], load);
      })

      // 15.2.4.5.4 LoadFailed
      ['catch'](function(exc) {
        console.assert(load.status == 'loading', 'is loading on fail');
        load.status = 'failed';
        load.exception = exc;

        var linkSets = load.linkSets.concat([]);
        for (var i = 0, l = linkSets.length; i < l; i++)
          linkSetFailed(linkSets[i], exc);

        console.assert(load.linkSets.length == 0, 'linkSets not removed');
      });
    }

    // 15.2.4.7 PromiseOfStartLoadPartwayThrough absorbed into calling functions

    // 15.2.4.7.1
    function asyncStartLoadPartwayThrough(stepState) {
      return function(resolve, reject) {
        var loader = stepState.loader;
        var name = stepState.moduleName;
        var step = stepState.step;

        if (loader.modules[name]) 
          throw new TypeError('"' + name + '" already exists in the module table');

        // NB this still seems wrong for LoadModule as we may load a dependency
        // of another module directly before it has finished loading.
        for (var i = 0, l = loader.loads.length; i < l; i++)
          if (loader.loads[i].name == name)
            throw new TypeError('"' + name + '" already loading');

        var load = createLoad(name);
        
        load.metadata = stepState.moduleMetadata;

        var linkSet = createLinkSet(loader, load);

        loader.loads.push(load);

        resolve(linkSet.done);

        if (step == 'locate')
          proceedToLocate(loader, load);

        else if (step == 'fetch')
          proceedToFetch(loader, load, Promise.resolve(stepState.moduleAddress));

        else {
          console.assert(step == 'translate', 'translate step');
          load.address = stepState.moduleAddress;
          proceedToTranslate(loader, load, Promise.resolve(stepState.moduleSource));
        }
      }
    }

    // Declarative linking functions run through alternative implementation:
    // 15.2.5.1.1 CreateModuleLinkageRecord not implemented
    // 15.2.5.1.2 LookupExport not implemented
    // 15.2.5.1.3 LookupModuleDependency not implemented

    // 15.2.5.2.1
    function createLinkSet(loader, startingLoad) {
      var linkSet = {
        loader: loader,
        loads: [],
        loadingCount: 0
      };
      linkSet.done = new Promise(function(resolve, reject) {
        linkSet.resolve = resolve;
        linkSet.reject = reject;
      });
      addLoadToLinkSet(linkSet, startingLoad);
      return linkSet;
    }
    // 15.2.5.2.2
    function addLoadToLinkSet(linkSet, load) {
      console.assert(load.status == 'loading' || load.status == 'loaded', 'loading or loaded on link set');

      for (var i = 0, l = linkSet.loads.length; i < l; i++)
        if (linkSet.loads[i] == load)
          return;

      linkSet.loads.push(load);
      load.linkSets.push(linkSet);

      // adjustment, see https://bugs.ecmascript.org/show_bug.cgi?id=2603
      if (load.status != 'loaded') {
        linkSet.loadingCount++;
      }

      var loader = linkSet.loader;

      for (var i = 0, l = load.dependencies.length; i < l; i++) {
        var name = load.dependencies[i].value;

        if (loader.modules[name])
          continue;

        for (var j = 0, d = loader.loads.length; j < d; j++) {
          if (loader.loads[j].name != name)
            continue;
          
          addLoadToLinkSet(linkSet, loader.loads[j]);
          break;
        }
      }
      // console.log('add to linkset ' + load.name);
      // snapshot(linkSet.loader);
    }

    // 15.2.5.2.3
    function updateLinkSetOnLoad(linkSet, load) {
      console.assert(load.status == 'loaded' || load.status == 'linked', 'loaded or linked');

      // console.log('update linkset on load ' + load.name);
      // snapshot(linkSet.loader);

      linkSet.loadingCount--;

      if (linkSet.loadingCount > 0)
        return;

      var startingLoad = linkSet.loads[0];

      // non-executing link variation for loader tracing
      // on the server. Not in spec.
      /***/
      if (linkSet.loader.loaderObj.execute === false) {
        var loads = [].concat(linkSet.loads);
        for (var i = 0; i < loads.length; i++) {
          var load = loads[i];
          load.module = load.kind == 'dynamic' ? {
            module: Module({})
          } : {
            name: load.name,
            module: Module({}),
            evaluated: true
          };
          load.status = 'linked';
          finishLoad(linkSet.loader, load);
        }
        return linkSet.resolve(startingLoad);
      }
      /***/

      try {
        link(linkSet);
      }
      catch(exc) {
        return linkSetFailed(linkSet, exc);
      }

      console.assert(linkSet.loads.length == 0, 'loads cleared');

      linkSet.resolve(startingLoad);
    }

    // 15.2.5.2.4
    function linkSetFailed(linkSet, exc) {
      var loader = linkSet.loader;
      var loads = linkSet.loads.concat([]);
      for (var i = 0, l = loads.length; i < l; i++) {
        var load = loads[i];

        // store all failed load records
        loader.loaderObj.failed = loader.loaderObj.failed || [];
        if (loader.loaderObj.failed.indexOf(load) == -1)
          loader.loaderObj.failed.push(load);

        var linkIndex = indexOf.call(load.linkSets, linkSet);
        console.assert(linkIndex != -1, 'link not present');
        load.linkSets.splice(linkIndex, 1);
        if (load.linkSets.length == 0) {
          var globalLoadsIndex = indexOf.call(linkSet.loader.loads, load);
          if (globalLoadsIndex != -1)
            linkSet.loader.loads.splice(globalLoadsIndex, 1);
        }
      }
      linkSet.reject(exc);
    }

    // 15.2.5.2.5
    function finishLoad(loader, load) {
      // add to global trace if tracing
      if (loader.loaderObj.trace) {
        if (!loader.loaderObj.loads)
          loader.loaderObj.loads = {};
        var depMap = {};
        load.dependencies.forEach(function(dep) {
          depMap[dep.key] = dep.value;
        });
        loader.loaderObj.loads[load.name] = {
          name: load.name,
          deps: load.dependencies.map(function(dep){ return dep.key }),
          depMap: depMap,
          address: load.address,
          metadata: load.metadata,
          source: load.source,
          kind: load.kind
        };
      }
      // if not anonymous, add to the module table
      if (load.name) {
        console.assert(!loader.modules[load.name], 'load not in module table');
        loader.modules[load.name] = load.module;
      }
      var loadIndex = indexOf.call(loader.loads, load);
      if (loadIndex != -1)
        loader.loads.splice(loadIndex, 1);
      for (var i = 0, l = load.linkSets.length; i < l; i++) {
        loadIndex = indexOf.call(load.linkSets[i].loads, load);
        if (loadIndex != -1)
          load.linkSets[i].loads.splice(loadIndex, 1);
      }
      load.linkSets.splice(0, load.linkSets.length);
    }

    // 15.2.5.3 Module Linking Groups

    // 15.2.5.3.2 BuildLinkageGroups alternative implementation
    // Adjustments (also see https://bugs.ecmascript.org/show_bug.cgi?id=2755)
    // 1. groups is an already-interleaved array of group kinds
    // 2. load.groupIndex is set when this function runs
    // 3. load.groupIndex is the interleaved index ie 0 declarative, 1 dynamic, 2 declarative, ... (or starting with dynamic)
    function buildLinkageGroups(load, loads, groups, loader) {
      groups[load.groupIndex] = groups[load.groupIndex] || [];

      // if the load already has a group index and its in its group, its already been done
      // this logic naturally handles cycles
      if (indexOf.call(groups[load.groupIndex], load) != -1)
        return;

      // now add it to the group to indicate its been seen
      groups[load.groupIndex].push(load);

      for (var i = 0; i < loads.length; i++) {
        var loadDep = loads[i];

        // dependencies not found are already linked
        for (var j = 0; j < load.dependencies.length; j++) {
          if (loadDep.name == load.dependencies[j].value) {
            // by definition all loads in linkset are loaded, not linked
            console.assert(loadDep.status == 'loaded', 'Load in linkSet not loaded!');

            // if it is a group transition, the index of the dependency has gone up
            // otherwise it is the same as the parent
            var loadDepGroupIndex = load.groupIndex + (loadDep.kind != load.kind);

            // the group index of an entry is always the maximum
            if (loadDep.groupIndex === undefined || loadDep.groupIndex < loadDepGroupIndex) {
              
              // if already in a group, remove from the old group
              if (loadDep.groupIndex) {
                groups[loadDep.groupIndex].splice(groups[loadDep.groupIndex].indexOf(loadDep), 1);

                // if the old group is empty, then we have a mixed depndency cycle
                if (groups[loadDep.groupIndex].length == 0)
                  throw new TypeError("Mixed dependency cycle detected");
              }

              loadDep.groupIndex = loadDepGroupIndex;
            }

            buildLinkageGroups(loadDep, loads, groups, loader);
          }
        }
      }
    }

    // 15.2.5.4
    function link(linkSet) {

      var loader = linkSet.loader;

      // console.log('linking {' + logloads(loads) + '}');
      // snapshot(loader);

      // 15.2.5.3.1 LinkageGroups alternative implementation

      // build all the groups
      // because the first load represents the top of the tree
      // for a given linkset, we can work down from there
      var groups = [];
      var startingLoad = linkSet.loads[0];
      startingLoad.groupIndex = 0;
      buildLinkageGroups(startingLoad, linkSet.loads, groups, loader);

      // determine the kind of the bottom group
      var curGroupDeclarative = (startingLoad.kind == 'declarative') == groups.length % 2;

      // run through the groups from bottom to top
      for (var i = groups.length - 1; i >= 0; i--) {
        var group = groups[i];
        for (var j = 0; j < group.length; j++) {
          var load = group[j];

          // 15.2.5.5 LinkDeclarativeModules adjusted
          if (curGroupDeclarative) {
            linkDeclarativeModule(load, linkSet.loads, loader);
          }
          // 15.2.5.6 LinkDynamicModules adjusted
          else {
            var module = load.execute();
            if (!module || !module.__esModule)
              throw new TypeError('Execution must define a Module instance');
            load.module = {
              module: module
            };
            load.status = 'linked';
          }
          finishLoad(loader, load);
        }

        // alternative current kind for next loop
        curGroupDeclarative = !curGroupDeclarative;
      }
    }

    // custom declarative linking function
    function linkDeclarativeModule(load, loads, loader) {
      if (load.module)
        return;

      // declare the module with an empty depMap
      var depMap = [];

      var registryEntry = load.declare.call(__global, depMap);

      var moduleDependencies = [];

      // module is just a plain object, until we evaluate it
      var module = registryEntry.exports;

      console.assert(!load.module, 'Load module already declared!');

      load.module = {
        name: load.name,
        dependencies: moduleDependencies,
        execute: registryEntry.execute,
        exports: module,
        evaluated: false
      };

      // now link all the module dependencies
      // amending the depMap as we go
      for (var i = 0; i < load.dependencies.length; i++) {
        var depName = load.dependencies[i].value;
        var depModule;
        // if dependency already a module, use that
        if (loader.modules[depName]) {
          depModule = loader.modules[depName];
        }
        else {
          for (var j = 0; j < loads.length; j++) {
            if (loads[j].name != depName)
              continue;
            
            // only link if already not already started linking (stops at circular / dynamic)
            if (!loads[j].module)
              linkDeclarativeModule(loads[j], loads, loader);
            
            depModule = loads[j].module;
          }
        }

        var depModuleModule = depModule.exports || depModule.module;

        console.assert(depModule, 'Dependency module not found!');

        if (registryEntry.exportStar && indexOf.call(registryEntry.exportStar, load.dependencies[i].key) != -1) {
          // we are exporting * from this dependency
          (function(depModuleModule) {
            for (var p in depModuleModule) (function(p) {
              // if the property is already defined throw?
              defineProperty(module, p, {
                enumerable: true,
                get: function() {
                  return depModuleModule[p];
                },
                set: function(value) {
                  depModuleModule[p] = value;
                }
              });
            })(p);
          })(depModuleModule);
        }

        moduleDependencies.push(depModule);
        depMap[i] = depModuleModule;
      }

      load.status = 'linked';
    }
      


    // 15.2.5.5.1 LinkImports not implemented
    // 15.2.5.7 ResolveExportEntries not implemented
    // 15.2.5.8 ResolveExports not implemented
    // 15.2.5.9 ResolveExport not implemented
    // 15.2.5.10 ResolveImportEntries not implemented

    // 15.2.6.1
    function evaluateLoadedModule(loader, load) {
      console.assert(load.status == 'linked', 'is linked ' + load.name);
      ensureEvaluated(load.module, [], loader);
      return load.module.module;
    }

    /*
     * Module Object non-exotic for ES5:
     *
     * module.module        bound module object
     * module.execute       execution function for module
     * module.dependencies  list of module objects for dependencies
     * 
     */

    // 15.2.6.2 EnsureEvaluated adjusted
    function ensureEvaluated(module, seen, loader) {
      if (module.evaluated || !module.dependencies)
        return;

      seen.push(module);

      var deps = module.dependencies;

      for (var i = 0; i < deps.length; i++) {
        var dep = deps[i];
        if (indexOf.call(seen, dep) == -1)
          ensureEvaluated(dep, seen, loader);
      }

      if (module.evaluated)
        return;

      module.evaluated = true;
      module.execute.call(__global);
      module.module = Module(module.exports);
      delete module.execute;
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

      this._loader = {
        loaderObj: this,
        loads: [],
        modules: {}
      };

      defineProperty(this, 'global', {
        get: function() {
          return __global;
        }
      });
      defineProperty(this, 'realm', {
        get: function() {
          throw new TypeError('Realms not implemented in polyfill');
        }
      });
    }

    // importPromises adds ability to import a module twice without error - https://bugs.ecmascript.org/show_bug.cgi?id=2601
    var importPromises = {};
    Loader.prototype = {
      define: function(name, source, options) {
        if (importPromises[name])
          throw new TypeError('Module is already loading.');
        importPromises[name] = new Promise(asyncStartLoadPartwayThrough({
          step: options && options.address ? 'fetch' : 'translate',
          loader: this._loader,
          moduleName: name,
          moduleMetadata: options && options.metadata || {},
          moduleSource: source,
          moduleAddress: options && options.address
        }));
        return importPromises[name].then(function() { delete importPromises[name]; });
      },
      load: function(request, options) {
        if (this._loader.modules[request]) {
          ensureEvaluated(this._loader.modules[request], [], this._loader);
          return Promise.resolve(this._loader.modules[request].module);
        }
        if (importPromises[request])
          return importPromises[request];
        importPromises[request] = loadModule(this._loader, request, {});
        return importPromises[request].then(function() { delete importPromises[request]; })
      },
      module: function(source, options) {
        var load = createLoad();
        load.address = options && options.address;
        var linkSet = createLinkSet(this._loader, load);
        var sourcePromise = Promise.resolve(source);
        var loader = this._loader;
        var p = linkSet.done.then(function() {
          return evaluateLoadedModule(loader, load);
        });
        proceedToTranslate(loader, load, sourcePromise);
        return p;
      },
      'import': function(name, options) {
        // run normalize first
        var loaderObj = this;

        // added, see https://bugs.ecmascript.org/show_bug.cgi?id=2659
        return Promise.resolve(loaderObj.normalize(name, options && options.name, options && options.address))
        .then(function(name) {
          var loader = loaderObj._loader;
          
          if (loader.modules[name]) {
            ensureEvaluated(loader.modules[name], [], loader._loader);
            return Promise.resolve(loader.modules[name].module);
          }
          
          return (importPromises[name] || (importPromises[name] = loadModule(loader, name, options || {})))
            .then(function(load) {
              delete importPromises[name];
              return evaluateLoadedModule(loader, load);
            });
        });
      },
      eval: function(source) {
        throw new TypeError('Eval not implemented in polyfill')
      },
      get: function(key) {
        if (!this._loader.modules[key])
          return;
        ensureEvaluated(this._loader.modules[key], [], this);
        return this._loader.modules[key].module;
      },
      has: function(name) {
        return !!this._loader.modules[name];
      },
      set: function(name, module) {
        if (!(module.__esModule))
          throw new TypeError('Set must be a module');
        this._loader.modules[name] = {
          module: module
        };
      },
      'delete': function(name) {
        return this._loader.modules[name] ? delete this._loader.modules[name] : false;
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
      normalize: function(name, referrerName, referrerAddress) {
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
    var anonCnt = 0;

    // Module Object
    function Module(obj) {
      if (typeof obj != 'object')
        throw new TypeError('Expected object');

      var self = {
        __esModule: true
      };

      for (var key in obj) {
        (function (key) {
          defineProperty(self, key, {
            configurable: false,
            enumerable: true,
            get: function () {
              return obj[key];
            }
          });
        })(key);
      }

      if (Object.preventExtensions)
        Object.preventExtensions(self);

      return self;
    }


    if (typeof exports === 'object')
      module.exports = Loader;

    __global.Reflect = __global.Reflect || {};
    __global.Reflect.Loader = __global.Reflect.Loader || Loader;
    __global.LoaderPolyfill = Loader;
    __global.Module = Module;

  })();

  function __eval(__source, __global, __moduleName) {
    eval('var __moduleName = "' + (__moduleName || '').replace('"', '\"') + '"; with(__global) { (function() { ' + __source + ' \n }).call(__global); }');
  }

})(typeof global !== 'undefined' ? global : this);

/*
*********************************************************************************************

  System Loader Implementation

    - Implemented to https://github.com/jorendorff/js-loaders/blob/master/browser-loader.js

    - <script type="module"> supported

*********************************************************************************************
*/

(function (global) {
  var isBrowser = typeof window != 'undefined';
  var Loader = global.Reflect && global.Reflect.Loader || require('./loader');
  var Promise = global.Promise || require('es6-promise').Promise;

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
          throw new TypeError('Illegal module name "' + name + '"');
      }

      if (!rel)
        return name;

      // build the full module name
      var normalizedParts = [];
      var parentParts = (parentName || '').split('/');
      var normalizedLen = parentParts.length - 1 - dotdots;

      normalizedParts = normalizedParts.concat(parentParts.splice(0, parentParts.length - 1 - dotdots));
      normalizedParts = normalizedParts.concat(segments.splice(i, segments.length - i));

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
      return new Promise(function(resolve, reject) {
        fetchTextFromURL(toAbsoluteURL(this.baseURL, load.address), function(source) {
          resolve(source);
        }, reject);
      });
    }
  });

  if (isBrowser) {
    var href = window.location.href.split('#')[0].split('?')[0];
    System.baseURL = href.substring(0, href.lastIndexOf('/') + 1);
  }
  else {
    System.baseURL = './';
  }
  System.paths = { '*': '*.js' };

  if (global.System && global.traceur)
    global.traceurSystem = global.System;

  if (isBrowser)
    global.System = System;

  // <script type="module"> support
  // allow a data-init function callback once loaded
  if (isBrowser) {
    var curScript = document.getElementsByTagName('script');
    curScript = curScript[curScript.length - 1];

    function completed() {
      document.removeEventListener( "DOMContentLoaded", completed, false );
      window.removeEventListener( "load", completed, false );
      ready();
    }

    function ready() {
      var scripts = document.getElementsByTagName('script');

      for (var i = 0; i < scripts.length; i++) {
        var script = scripts[i];
        if (script.type == 'module') {
          var source = script.innerHTML;
          System.module(source)['catch'](function(err) { setTimeout(function() { throw err; }); });
        }
      }
    }

    // DOM ready, taken from https://github.com/jquery/jquery/blob/master/src/core/ready.js#L63
    if (document.readyState === 'complete') {
      setTimeout(ready);
    }
    else if (document.addEventListener) {
      document.addEventListener('DOMContentLoaded', completed, false);
      window.addEventListener('load', completed, false);
    }

    // run the data-init function on the script tag
    if (curScript.getAttribute('data-init'))
      window[curScript.getAttribute('data-init')]();
  }

  if (typeof exports === 'object')
    module.exports = System;

})(typeof global !== 'undefined' ? global : this);
