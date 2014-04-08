!function(){ return typeof Promise != 'undefined' && Promise.all && Promise.resolve && Promise.reject; }() &&
!function(e){"object"==typeof exports?module.exports=e():"function"==typeof define&&define.amd?define(e):"undefined"!=typeof window?window.Promise=e():"undefined"!=typeof global?global.Promise=e():"undefined"!=typeof self&&(self.Promise=e())}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/** @license MIT License (c) copyright 2010-2014 original author or authors */
/** @author Brian Cavalier */
/** @author John Hann */

/**
 * ES6 global Promise shim
 */
var PromiseConstructor = module.exports = require('../lib/Promise');

var g = typeof global !== 'undefined' && global
  || typeof window !== 'undefined' && window
  || typeof self !== 'undefined' && self;

if(typeof g !== 'undefined' && typeof g.Promise === 'undefined') {
  g.Promise = PromiseConstructor;
}

},{"../lib/Promise":2}],2:[function(require,module,exports){
/** @license MIT License (c) copyright 2010-2014 original author or authors */
/** @author Brian Cavalier */
/** @author John Hann */

(function(define) { 'use strict';
define(function (require) {

  var makePromise = require('./makePromise');
  var Scheduler = require('./scheduler');
  var async = require('./async');

  return makePromise({
    scheduler: new Scheduler(async),
    monitor: typeof console !== 'undefined' ? console : void 0
  });

});
})(typeof define === 'function' && define.amd ? define : function (factory) { module.exports = factory(require); });

},{"./async":4,"./makePromise":5,"./scheduler":6}],3:[function(require,module,exports){
/** @license MIT License (c) copyright 2010-2014 original author or authors */
/** @author Brian Cavalier */
/** @author John Hann */

(function(define) { 'use strict';
define(function() {
  /**
   * Circular queue
   * @param {number} capacityPow2 power of 2 to which this queue's capacity
   *  will be set initially. eg when capacityPow2 == 3, queue capacity
   *  will be 8.
   * @constructor
   */
  function Queue(capacityPow2) {
    this.head = this.tail = this.length = 0;
    this.buffer = new Array(1 << capacityPow2);
  }

  Queue.prototype.push = function(x) {
    if(this.length === this.buffer.length) {
      this._ensureCapacity(this.length * 2);
    }

    this.buffer[this.tail] = x;
    this.tail = (this.tail + 1) & (this.buffer.length - 1);
    ++this.length;
    return this.length;
  };

  Queue.prototype.shift = function() {
    var x = this.buffer[this.head];
    this.buffer[this.head] = void 0;
    this.head = (this.head + 1) & (this.buffer.length - 1);
    --this.length;
    return x;
  };

  Queue.prototype._ensureCapacity = function(capacity) {
    var head = this.head;
    var buffer = this.buffer;
    var newBuffer = new Array(capacity);
    var i = 0;
    var len;

    if(head === 0) {
      len = this.length;
      for(; i<len; ++i) {
        newBuffer[i] = buffer[i];
      }
    } else {
      capacity = buffer.length;
      len = this.tail;
      for(; head<capacity; ++i, ++head) {
        newBuffer[i] = buffer[head];
      }

      for(head=0; head<len; ++i, ++head) {
        newBuffer[i] = buffer[head];
      }
    }

    this.buffer = newBuffer;
    this.head = 0;
    this.tail = this.length;
  };

  return Queue;

});
}(typeof define === 'function' && define.amd ? define : function(factory) { module.exports = factory(); }));

},{}],4:[function(require,module,exports){
/** @license MIT License (c) copyright 2010-2014 original author or authors */
/** @author Brian Cavalier */
/** @author John Hann */

(function(define) { 'use strict';
define(function(require) {

  // Sniff "best" async scheduling option
  // Prefer process.nextTick or MutationObserver, then check for
  // vertx and finally fall back to setTimeout

  /*jshint maxcomplexity:6*/
  /*global process,document,setTimeout,MutationObserver,WebKitMutationObserver*/
  var nextTick, MutationObs;

  if (typeof process !== 'undefined' && process !== null &&
    typeof process.nextTick === 'function') {
    nextTick = function(f) {
      process.nextTick(f);
    };

  } else if (MutationObs =
    (typeof MutationObserver === 'function' && MutationObserver) ||
    (typeof WebKitMutationObserver === 'function' && WebKitMutationObserver)) {
    nextTick = (function (document, MutationObserver) {
      var scheduled;
      var el = document.createElement('div');
      var o = new MutationObserver(run);
      o.observe(el, { attributes: true });

      function run() {
        var f = scheduled;
        scheduled = void 0;
        f();
      }

      return function (f) {
        scheduled = f;
        el.setAttribute('class', 'x');
      };
    }(document, MutationObs));

  } else {
    nextTick = (function(cjsRequire) {
      try {
        // vert.x 1.x || 2.x
        return cjsRequire('vertx').runOnLoop || cjsRequire('vertx').runOnContext;
      } catch (ignore) {}

      // capture setTimeout to avoid being caught by fake timers
      // used in time based tests
      var capturedSetTimeout = setTimeout;
      return function (t) {
        capturedSetTimeout(t, 0);
      };
    }(require));
  }

  return nextTick;
});
}(typeof define === 'function' && define.amd ? define : function(factory) { module.exports = factory(require); }));

},{}],5:[function(require,module,exports){
/** @license MIT License (c) copyright 2010-2014 original author or authors */
/** @author Brian Cavalier */
/** @author John Hann */

(function(define) { 'use strict';
define(function() {

  return function makePromise(environment) {

    var foreverPendingPromise;
    var tasks = environment.scheduler;

    var objectCreate = Object.create ||
      function(proto) {
        function Child() {}
        Child.prototype = proto;
        return new Child();
      };

    /**
     * Create a promise whose fate is determined by resolver
     * @constructor
     * @returns {Promise} promise
     * @name Promise
     */
    function Promise(resolver) {
      var self = this;
      this._handler = new DeferredHandler();

      runResolver(resolver, promiseResolve, promiseReject, promiseNotify);

      /**
       * Transition from pre-resolution state to post-resolution state, notifying
       * all listeners of the ultimate fulfillment or rejection
       * @param {*} x resolution value
       */
      function promiseResolve (x) {
        self._handler.resolve(x);
      }
      /**
       * Reject this promise with reason, which will be used verbatim
       * @param {*} reason reason for the rejection, typically an Error
       */
      function promiseReject (reason) {
        self._handler.reject(reason);
      }

      /**
       * Issue a progress event, notifying all progress listeners
       * @param {*} x progress event payload to pass to all listeners
       */
      function promiseNotify (x) {
        self._handler.notify(x);
      }
    }

    function runResolver(resolver, promiseResolve, promiseReject, promiseNotify) {
      try {
        resolver(promiseResolve, promiseReject, promiseNotify);
      } catch (e) {
        promiseReject(e);
      }
    }

    // Creation

    Promise.resolve = resolve;
    Promise.reject = reject;
    Promise.never = never;

    Promise._defer = defer;

    /**
     * Returns a trusted promise. If x is already a trusted promise, it is
     * returned, otherwise returns a new trusted Promise which follows x.
     * @param  {*} x
     * @return {Promise} promise
     */
    function resolve(x) {
      return x instanceof Promise ? x
        : new InternalPromise(new AsyncHandler(getHandler(x)));
    }

    /**
     * Return a reject promise with x as its reason (x is used verbatim)
     * @param {*} x
     * @returns {Promise} rejected promise
     */
    function reject(x) {
      return new InternalPromise(new AsyncHandler(new RejectedHandler(x)));
    }

    /**
     * Return a promise that remains pending forever
     * @returns {Promise} forever-pending promise.
     */
    function never() {
      return foreverPendingPromise; // Should be frozen
    }

    /**
     * Creates an internal {promise, resolver} pair
     * @private
     * @returns {{resolver: DeferredHandler, promise: InternalPromise}}
     */
    function defer() {
      return new InternalPromise(new DeferredHandler());
    }

    // Transformation and flow control

    /**
     * Transform this promise's fulfillment value, returning a new Promise
     * for the transformed result.  If the promise cannot be fulfilled, onRejected
     * is called with the reason.  onProgress *may* be called with updates toward
     * this promise's fulfillment.
     * @param [onFulfilled] {Function} fulfillment handler
     * @param [onRejected] {Function} rejection handler
     * @param [onProgress] {Function} progress handler
     * @return {Promise} new promise
     */
    Promise.prototype.then = function(onFulfilled, onRejected, onProgress) {
      var from = this._handler;
      var to = new DeferredHandler(from.receiver);
      from.when(to.resolve, to.notify, to, from.receiver, onFulfilled, onRejected, onProgress);

      return new InternalPromise(to);
    };

    /**
     * If this promise cannot be fulfilled due to an error, call onRejected to
     * handle the error. Shortcut for .then(undefined, onRejected)
     * @param {function?} onRejected
     * @return {Promise}
     */
    Promise.prototype['catch'] = Promise.prototype.otherwise = function(onRejected) {
      return this.then(void 0, onRejected);
    };

    /**
     * Private function to bind a thisArg for this promise's handlers
     * @private
     * @param {object} thisArg `this` value for all handlers attached to
     *  the returned promise.
     * @returns {Promise}
     */
    Promise.prototype._bindContext = function(thisArg) {
      return new InternalPromise(new BoundHandler(this._handler, thisArg));
    };

    // Array combinators

    Promise.all = all;
    Promise.race = race;

    /**
     * Return a promise that will fulfill when all promises in the
     * input array have fulfilled, or will reject when one of the
     * promises rejects.
     * @param {array} promises array of promises
     * @returns {Promise} promise for array of fulfillment values
     */
    function all(promises) {
      /*jshint maxcomplexity:6*/
      var resolver = new DeferredHandler();
      var len = promises.length >>> 0;
      var pending = len;
      var results = [];
      var i, x;

      for (i = 0; i < len; ++i) {
        if (i in promises) {
          x = promises[i];
          if (maybeThenable(x)) {
            resolveOne(resolver, results, getHandlerThenable(x), i);
          } else {
            results[i] = x;
            --pending;
          }
        } else {
          --pending;
        }
      }

      if(pending === 0) {
        resolver.resolve(results);
      }

      return new InternalPromise(resolver);

      function resolveOne(resolver, results, handler, i) {
        handler.when(noop, noop, void 0, resolver, function(x) {
          results[i] = x;
          if(--pending === 0) {
            this.resolve(results);
          }
        }, resolver.reject, resolver.notify);
      }
    }

    /**
     * Fulfill-reject competitive race. Return a promise that will settle
     * to the same state as the earliest input promise to settle.
     *
     * WARNING: The ES6 Promise spec requires that race()ing an empty array
     * must return a promise that is pending forever.  This implementation
     * returns a singleton forever-pending promise, the same singleton that is
     * returned by Promise.never(), thus can be checked with ===
     *
     * @param {array} promises array of promises to race
     * @returns {Promise} if input is non-empty, a promise that will settle
     * to the same outcome as the earliest input promise to settle. if empty
     * is empty, returns a promise that will never settle.
     */
    function race(promises) {
      // Sigh, race([]) is untestable unless we return *something*
      // that is recognizable without calling .then() on it.
      if(Object(promises) === promises && promises.length === 0) {
        return never();
      }

      var h = new DeferredHandler();
      for(var i=0; i<promises.length; ++i) {
        getHandler(promises[i]).when(noop, noop, void 0, h, h.resolve, h.reject);
      }

      return new InternalPromise(h);
    }

    // Promise internals

    /**
     * InternalPromise represents a promise that is either already
     * fulfilled or reject, or is following another promise, based
     * on the provided handler.
     * @private
     * @param {object} handler
     * @constructor
     */
    function InternalPromise(handler) {
      this._handler = handler;
    }

    InternalPromise.prototype = objectCreate(Promise.prototype);

    /**
     * Get an appropriate handler for x, checking for untrusted thenables
     * and promise graph cycles.
     * @private
     * @param {*} x
     * @param {object?} h optional handler to check for cycles
     * @returns {object} handler
     */
    function getHandler(x, h) {
      if(x instanceof Promise) {
        return getHandlerChecked(x, h);
      }
      return maybeThenable(x) ? getHandlerUntrusted(x) : new FulfilledHandler(x);
    }

    /**
     * Get an appropriate handler for x, which must be either a thenable
     * @param {object} x
     * @returns {object} handler
     */
    function getHandlerThenable(x) {
      return x instanceof Promise ? x._handler.join() : getHandlerUntrusted(x);
    }

    /**
     * Get x's handler, checking for cycles
     * @param {Promise} x
     * @param {object?} h handler to check for cycles
     * @returns {object} handler
     */
    function getHandlerChecked(x, h) {
      var xh = x._handler.join();
      return h === xh ? promiseCycleHandler() : xh;
    }

    /**
     * Get a handler for potentially untrusted thenable x
     * @param {*} x
     * @returns {object} handler
     */
    function getHandlerUntrusted(x) {
      try {
        var untrustedThen = x.then;
        return typeof untrustedThen === 'function'
          ? new ThenableHandler(untrustedThen, x)
          : new FulfilledHandler(x);
      } catch(e) {
        return new RejectedHandler(e);
      }
    }

    /**
     * Handler for a promise that is pending forever
     * @private
     * @constructor
     */
    function Handler() {}

    Handler.prototype.inspect = toPendingState;
    Handler.prototype.when = noop;
    Handler.prototype.resolve = noop;
    Handler.prototype.reject = noop;
    Handler.prototype.notify = noop;
    Handler.prototype.join = function() { return this; };

    Handler.prototype._env = environment.monitor || Promise;
    Handler.prototype._addTrace = noop;
    Handler.prototype._isMonitored = function() {
      return typeof this._env.promiseMonitor !== 'undefined';
    };

    /**
     * Abstract base for handler that delegates to another handler
     * @private
     * @param {object} handler
     * @constructor
     */
    function DelegateHandler(handler) {
      this.handler = handler;
      if(this._isMonitored()) {
        var trace = this._env.promiseMonitor.captureStack();
        this.trace = handler._addTrace(trace);
      }
    }

    DelegateHandler.prototype = objectCreate(Handler.prototype);

    DelegateHandler.prototype.join = function() {
      return this.handler.join();
    };

    DelegateHandler.prototype.inspect = function() {
      return this.handler.inspect();
    };

    DelegateHandler.prototype._addTrace = function(trace) {
      return this.handler._addTrace(trace);
    };

    /**
     * Handler that manages a queue of consumers waiting on a pending promise
     * @private
     * @constructor
     */
    function DeferredHandler(receiver) {
      this.consumers = [];
      this.receiver = receiver;
      this.handler = void 0;
      this.resolved = false;
      if(this._isMonitored()) {
        this.trace = this._env.promiseMonitor.captureStack();
      }
    }

    DeferredHandler.prototype = objectCreate(Handler.prototype);

    DeferredHandler.prototype.inspect = function() {
      return this.resolved ? this.handler.join().inspect() : toPendingState();
    };

    DeferredHandler.prototype.resolve = function(x) {
      this._join(getHandler(x, this));
    };

    DeferredHandler.prototype.reject = function(x) {
      this._join(new RejectedHandler(x));
    };

    DeferredHandler.prototype.join = function() {
      return this.resolved ? this.handler.join() : this;
    };

    DeferredHandler.prototype.run = function() {
      var q = this.consumers;
      var handler = this.handler = this.handler.join();
      this.consumers = void 0;

      for (var i = 0; i < q.length; i+=7) {
        handler.when(q[i], q[i+1], q[i+2], q[i+3], q[i+4], q[i+5], q[i+6]);
      }
    };

    DeferredHandler.prototype._join = function(handler) {
      if(this.resolved) {
        return;
      }

      this.resolved = true;
      this.handler = handler;
      tasks.enqueue(this);

      if(this._isMonitored()) {
        this.trace = handler._addTrace(this.trace);
      }
    };

    DeferredHandler.prototype.when = function(resolve, notify, t, receiver, f, r, u) {
      if(this.resolved) {
        tasks.enqueue(new RunHandlerTask(resolve, notify, t, receiver, f, r, u, this.handler.join()));
      } else {
        this.consumers.push(resolve, notify, t, receiver, f, r, u);
      }
    };

    DeferredHandler.prototype.notify = function(x) {
      if(!this.resolved) {
        tasks.enqueue(new ProgressTask(this.consumers, x));
      }
    };

    DeferredHandler.prototype._addTrace = function(trace) {
      return this.resolved ? this.handler._addTrace(trace) : trace;
    };

    /**
     * Wrap another handler and force it into a future stack
     * @private
     * @param {object} handler
     * @constructor
     */
    function AsyncHandler(handler) {
      DelegateHandler.call(this, handler);
    }

    AsyncHandler.prototype = objectCreate(DelegateHandler.prototype);

    AsyncHandler.prototype.when = function(resolve, notify, t, receiver, f, r, u) {
      tasks.enqueue(new RunHandlerTask(resolve, notify, t, receiver, f, r, u, this.join()));
    };

    /**
     * Handler that follows another handler, injecting a receiver
     * @private
     * @param {object} handler another handler to follow
     * @param {object=undefined} receiver
     * @constructor
     */
    function BoundHandler(handler, receiver) {
      DelegateHandler.call(this, handler);
      this.receiver = receiver;
    }

    BoundHandler.prototype = objectCreate(DelegateHandler.prototype);

    BoundHandler.prototype.when = function(resolve, notify, t, receiver, f, r, u) {
      // Because handlers are allowed to be shared among promises,
      // each of which possibly having a different receiver, we have
      // to insert our own receiver into the chain if it has been set
      // so that callbacks (f, r, u) will be called using our receiver
      if(this.receiver !== void 0) {
        receiver = this.receiver;
      }
      this.join().when(resolve, notify, t, receiver, f, r, u);
    };

    /**
     * Handler that wraps an untrusted thenable and assimilates it in a future stack
     * @private
     * @param {function} then
     * @param {{then: function}} thenable
     * @constructor
     */
    function ThenableHandler(then, thenable) {
      DeferredHandler.call(this);
      this.assimilated = false;
      this.untrustedThen = then;
      this.thenable = thenable;
    }

    ThenableHandler.prototype = objectCreate(DeferredHandler.prototype);

    ThenableHandler.prototype.when = function(resolve, notify, t, receiver, f, r, u) {
      if(!this.assimilated) {
        this.assimilated = true;
        this._assimilate();
      }
      DeferredHandler.prototype.when.call(this, resolve, notify, t, receiver, f, r, u);
    };

    ThenableHandler.prototype._assimilate = function() {
      var h = this;
      this._try(this.untrustedThen, this.thenable, _resolve, _reject, _notify);

      function _resolve(x) { h.resolve(x); }
      function _reject(x)  { h.reject(x); }
      function _notify(x)  { h.notify(x); }
    };

    ThenableHandler.prototype._try = function(then, thenable, resolve, reject, notify) {
      try {
        then.call(thenable, resolve, reject, notify);
      } catch (e) {
        reject(e);
      }
    };

    /**
     * Handler for a fulfilled promise
     * @private
     * @param {*} x fulfillment value
     * @constructor
     */
    function FulfilledHandler(x) {
      this.value = x;
    }

    FulfilledHandler.prototype = objectCreate(Handler.prototype);

    FulfilledHandler.prototype.inspect = function() {
      return toFulfilledState(this.value);
    };

    FulfilledHandler.prototype.when = function(resolve, notify, t, receiver, f) {
      var x = typeof f === 'function'
        ? tryCatchReject(f, this.value, receiver)
        : this.value;

      resolve.call(t, x);
    };

    /**
     * Handler for a rejected promise
     * @private
     * @param {*} x rejection reason
     * @constructor
     */
    function RejectedHandler(x) {
      this.value = x;
      this.observed = false;

      if(this._isMonitored()) {
        this.key = this._env.promiseMonitor.startTrace(x);
      }
    }

    RejectedHandler.prototype = objectCreate(Handler.prototype);

    RejectedHandler.prototype.inspect = function() {
      return toRejectedState(this.value);
    };

    RejectedHandler.prototype.when = function(resolve, notify, t, receiver, f, r) {
      if(this._isMonitored() && !this.observed) {
        this._env.promiseMonitor.removeTrace(this.key);
      }

      this.observed = true;
      var x = typeof r === 'function'
        ? tryCatchReject(r, this.value, receiver)
        : reject(this.value);

      resolve.call(t, x);
    };

    RejectedHandler.prototype._addTrace = function(trace) {
      if(!this.observed) {
        this._env.promiseMonitor.updateTrace(this.key, trace);
      }
    };

    // Errors and singletons

    foreverPendingPromise = new InternalPromise(new Handler());

    function promiseCycleHandler() {
      return new RejectedHandler(new TypeError('Promise cycle'));
    }

    // Snapshot states

    /**
     * Creates a fulfilled state snapshot
     * @private
     * @param {*} x any value
     * @returns {{state:'fulfilled',value:*}}
     */
    function toFulfilledState(x) {
      return { state: 'fulfilled', value: x };
    }

    /**
     * Creates a rejected state snapshot
     * @private
     * @param {*} x any reason
     * @returns {{state:'rejected',reason:*}}
     */
    function toRejectedState(x) {
      return { state: 'rejected', reason: x };
    }

    /**
     * Creates a pending state snapshot
     * @private
     * @returns {{state:'pending'}}
     */
    function toPendingState() {
      return { state: 'pending' };
    }

    // Task runners

    /**
     * Run a single consumer
     * @private
     * @constructor
     */
    function RunHandlerTask(a, b, c, d, e, f, g, handler) {
      this.a=a;this.b=b;this.c=c;this.d=d;this.e=e;this.f=f;this.g=g;
      this.handler = handler;
    }

    RunHandlerTask.prototype.run = function() {
      this.handler.when(this.a, this.b, this.c, this.d, this.e, this.f, this.g);
    };

    /**
     * Run a queue of progress handlers
     * @private
     * @constructor
     */
    function ProgressTask(q, value) {
      this.q = q;
      this.value = value;
    }

    ProgressTask.prototype.run = function() {
      var q = this.q;
      // First progress handler is at index 1
      for (var i = 1; i < q.length; i+=7) {
        this._notify(q[i], q[i+1], q[i+2], q[i+5]);
      }
    };

    ProgressTask.prototype._notify = function(notify, t, receiver, u) {
      var x = typeof u === 'function'
        ? tryCatchReturn(u, this.value, receiver)
        : this.value;

      notify.call(t, x);
    };

    /**
     * @param {*} x
     * @returns {boolean} false iff x is guaranteed not to be a thenable
     */
    function maybeThenable(x) {
      return (typeof x === 'object' || typeof x === 'function') && x !== null;
    }

    /**
     * Return f.call(thisArg, x), or if it throws return a rejected promise for
     * the thrown exception
     * @private
     */
    function tryCatchReject(f, x, thisArg) {
      try {
        return f.call(thisArg, x);
      } catch(e) {
        return reject(e);
      }
    }

    /**
     * Return f.call(thisArg, x), or if it throws, *return* the exception
     * @private
     */
    function tryCatchReturn(f, x, thisArg) {
      try {
        return f.call(thisArg, x);
      } catch(e) {
        return e;
      }
    }

    function noop() {}

    return Promise;
  };
});
}(typeof define === 'function' && define.amd ? define : function(factory) { module.exports = factory(); }));

},{}],6:[function(require,module,exports){
/** @license MIT License (c) copyright 2010-2014 original author or authors */
/** @author Brian Cavalier */
/** @author John Hann */

(function(define) { 'use strict';
define(function(require) {

  var Queue = require('./Queue');

  // Credit to Twisol (https://github.com/Twisol) for suggesting
  // this type of extensible queue + trampoline approach for next-tick conflation.

  function Scheduler(enqueue) {
    this._enqueue = enqueue;
    this._handlerQueue = new Queue(15);

    var self = this;
    this.drainQueue = function() {
      self._drainQueue();
    };
  }

  /**
   * Enqueue a task. If the queue is not currently scheduled to be
   * drained, schedule it.
   * @param {function} task
   */
  Scheduler.prototype.enqueue = function(task) {
    if(this._handlerQueue.push(task) === 1) {
      this._enqueue(this.drainQueue);
    }
  };

  /**
   * Drain the handler queue entirely, being careful to allow the
   * queue to be extended while it is being processed, and to continue
   * processing until it is truly empty.
   */
  Scheduler.prototype._drainQueue = function() {
    var q = this._handlerQueue;
    while(q.length > 0) {
      q.shift().run();
    }
  };

  return Scheduler;

});
}(typeof define === 'function' && define.amd ? define : function(factory) { module.exports = factory(require); }));

},{"./Queue":3}]},{},[1])
(1)
});
;
/*
*********************************************************************************************

  Loader Polyfill

    - Implemented exactly to the 2013-12-02 Specification Draft -
      https://github.com/jorendorff/js-loaders/blob/e60d3651/specs/es6-modules-2013-12-02.pdf
      with the only exceptions as described here

    - Abstract functions have been combined where possible, and their associated functions 
      commented

    - When the traceur global is detected, declarative modules are transformed by Traceur
      before execution. The Traceur parse tree is stored as load.body, analogously to the
      spec

    - Link and EnsureEvaluated have been customised from the spec

    - Module Linkage records are stored as: { module: (actual module), dependencies, body, name, address }

    - Cycles are not supported at all and will throw an error

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

(function (global) {
  (function() {
    var Promise = global.Promise || require('./promise');

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
    function requestLoad(loader, request, referrerName, referrerAddress) {
      return new Promise(function(resolve, reject) {
        // CallNormalize
        resolve(loader.normalize(request, referrerName, referrerAddress));
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
            console.assert('loading or loaded', load.status == 'loading' || load.status == 'loaded');
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
        if (instantiateResult === undefined) {
          if (global.traceur) {
            if (!traceur) {
              traceur = global.traceur;
              $traceurRuntime.ModuleStore.get = $traceurRuntime.getModuleImpl = function(name) {
                return System.get(name);
              }
            }
            load.address = load.address || 'anon' + ++anonCnt;
            var parser = new traceur.syntax.Parser(new traceur.syntax.SourceFile(load.address, load.source));
            load.body = parser.parseModule();
            depsList = getImports(load.body);
          }
          else {
            throw new TypeError('Include Traceur for module syntax support');
          }
          load.kind = 'declarative';
        }
        else if (typeof instantiateResult == 'object') {
          depsList = instantiateResult.deps || [];
          load.execute = instantiateResult.execute;
          load.kind = 'dynamic';
        }
        else
          throw TypeError('Invalid instantiate return value');

        // ProcessLoadDependencies
        load.dependencies = {};
        load.depsList = depsList;
        var loadPromises = [];
        for (var i = 0, l = depsList.length; i < l; i++) (function(request) {
          var p = requestLoad(loader, request, load.name, load.address);

          // AddDependencyLoad (load is parentLoad)
          p.then(function(depLoad) {
            console.assert('not already a dependency', !load.dependencies[request]);
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
        console.assert('is loading', load.status == 'loading');

        load.status = 'loaded';

        // console.log('load succeeeded ' + load.name);
        // snapshot(loader);

        var linkSets = load.linkSets.concat([]);
        for (var i = 0, l = linkSets.length; i < l; i++)
          updateLinkSetOnLoad(linkSets[i], load);
      }

      // LoadFailed
      , function(exc) {
        console.assert('is loading on fail', load.status == 'loading');
        load.status = 'failed';
        load.exception = exc;
        for (var i = 0, l = load.linkSets.length; i < l; i++)
          linkSetFailed(load.linkSets[i], exc);
        console.assert('fail linkSets removed', load.linkSets.length == 0);
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
      console.assert('loading or loaded on link set', load.status == 'loading' || load.status == 'loaded');

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
      // console.assert('no load when updated ' + load.name, indexOf.call(linkSet.loads, load) != -1);
      console.assert('loaded or linked', load.status == 'loaded' || load.status == 'linked');

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

      console.assert('loads cleared', linkSet.loads.length == 0);
      linkSet.resolve(startingLoad);
    }
    function linkSetFailed(linkSet, exc) {
      var loads = linkSet.loads.concat([]);
      for (var i = 0, l = loads.length; i < l; i++) {
        var load = loads[i];
        var linkIndex = indexOf.call(load.linkSets, linkSet);
        console.assert('link not present', linkIndex != -1);
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
        console.assert('load not in module table', !loader._modules[load.name]);
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
          console.assert('translate step', step == 'translate');
          load.address = address;
          proceedToTranslate(loader, load, Promise.resolve(source));
        }
      }
    }
    function evaluateLoadedModule(loader, load) {
      console.assert('is linked ' + load.name, load.status == 'linked');

      ensureEvaluated(load.module, loader);

      console.assert('is a module', load.module.module instanceof Module);

      return load.module.module;
    }
    function ensureEvaluated(module, loader) {

      // if already executed or dynamic module exists
      // dynamic modules are evaluated during linking
      if (module.module)
        return module.module;
      
      // ensure all dependencies are evaluated first
      for (var m in module.dependencies) {
        var depName = module.dependencies[m];
        // no module object means it is not executed
        if (!loader._modules[depName].module)
          ensureEvaluated(loader._modules[depName], loader);
      }

      // now evaluate this module
      traceur.options.sourceMaps = true;
      traceur.options.modules = 'instantiate';

      var reporter = new traceur.util.ErrorReporter();

      reporter.reportMessageInternal = function(location, kind, format, args) {
        throw kind + '\n' + location;
      }

      // transform

      // traceur expects its version of System
      var sys = global.System;
      global.System = global.traceurSystem;

      var tree = (new traceur.codegeneration.module.AttachModuleNameTransformer(module.name)).transformAny(module.body);
      tree = (new traceur.codegeneration.FromOptionsTransformer(reporter)).transform(tree);

      // revert system
      global.System = sys;

      delete module.body;

      // convert back to a source string
      var sourceMapGenerator = new traceur.outputgeneration.SourceMapGenerator({ file: module.address });
      var options = { sourceMapGenerator: sourceMapGenerator };

      var source = traceur.outputgeneration.TreeWriter.write(tree, options);
      if (global.btoa)
        source += '\n//# sourceMappingURL=data:application/json;base64,' + btoa(unescape(encodeURIComponent(options.sourceMap))) + '\n';

      var sysRegister = System.register;
      System.register = function(name, deps, execute) {
        for (var i = 0; i < deps.length; i++)
          deps[i] = module.dependencies[deps[i]];

        module.module = new Module(execute.apply(global, deps));
      }

      __eval(source, global, module.address, module.name);

      System.register = sysRegister;
    }

    // Linking
    function link(loads, loader) {
      // console.log('linking {' + logloads(loads) + '}');

      // continue until all linked
      var circular = false;
      while (loads.length) {
        circular = true;
        // search through to find a load with all its dependencies linked
        search: for (var i = 0; i < loads.length; i++) {
          var load = loads[i];
          var depNames = [];
          for (var d in load.dependencies) {
            var depName = load.dependencies[d];
            // being in the module table means it is linked
            if (!loader._modules[depName])
              continue search;
            var index = indexOf.call(load.depsList, d);
            depNames[index] = depName;
          }

          circular = false;

          // all dependencies linked now, so we can link

          if (load.kind == 'declarative') {
            load.module = {
              name: load.name,
              dependencies: load.dependencies,
              body: load.body
            };
          }
          else {
            var module = load.execute.apply(null, depNames);
            if (!(module instanceof Module))
              throw new TypeError('Execution must define a Module instance');
            load.module = {
              module: module
            };
          }
          
          load.status = 'linked';
          finishLoad(loader, load);
        }
        if (circular)
          throw new TypeError('Circular dependencies not supported by the polyfill');
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
          return global;
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
        if (this._modules[request]) {
          ensureEvaluated(this._modules[request], this);
          return Promise.resolve(this._modules[request].module);
        }
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
        var loader = this;
        var p = linkSet.done.then(function() {
          return evaluateLoadedModule(loader, load);
        });
        proceedToTranslate(this, load, sourcePromise);
        return p;
      },
      'import': function(name, options) {
        if (this._modules[name]) {
          ensureEvaluated(this._modules[name], this);
          return Promise.resolve(this._modules[name].module);
        }
        var loader = this;
        return (importPromises[name] || (importPromises[name] = loadModule(this, name, options)))
          .then(function(load) {
            delete importPromises[name];
            return evaluateLoadedModule(loader, load);
          });
      },
      eval: function(source) {
        throw new TypeError('Eval not implemented in polyfill')
      },
      get: function(key) {
        if (!this._modules[key])
          return;
        ensureEvaluated(this._modules[key], this);
        return this._modules[key].module;
      },
      has: function(name) {
        return !!this._modules[name];
      },
      set: function(name, module) {
        if (!(module instanceof Module))
          throw new TypeError('Set must be a module');
        this._modules[name] = {
          module: module
        };
      },
      'delete': function(name) {
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
      if (Object.preventExtensions)
        Object.preventExtensions(this);
    }
    // Module.prototype = null;


    if (typeof exports === 'object')
      module.exports = Loader;

    global.Reflect = global.Reflect || {};
    global.Reflect.Loader = global.Reflect.Loader || Loader;
    global.LoaderPolyfill = Loader;
    global.Module = Module;

  })();

  function __eval(__source, global, __sourceURL, __moduleName) {
    try {
      eval('var __moduleName = "' + (__moduleName || '').replace('"', '\"') + '"; with(global) { (function() { ' + __source + ' \n }).call(global); }'
        + (__sourceURL && !__source.match(/\/\/[@#] ?(sourceURL|sourceMappingURL)=([^\n]+)/)
        ? '\n//# sourceURL=' + __sourceURL : ''));
    }
    catch(e) {
      if (e.name == 'SyntaxError')
        e.message = 'Evaluating ' + __sourceURL + '\n\t' + e.message;
      throw e;
    }
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
  var Promise = global.Promise || require('./promise');

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
      var resolve, reject, promise = new Promise(function(_resolve, _reject) { resolve = _resolve; reject = _reject; });
      fetchTextFromURL(toAbsoluteURL(this.baseURL, load.address), function(source) {
        resolve(source);
      }, reject);
      return promise;
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
