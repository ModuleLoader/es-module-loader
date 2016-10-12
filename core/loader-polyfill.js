import { baseURI, addToError, createSymbol } from './common.js';
export { Loader, Module, Module as InternalModuleNamespace }

/*
 * Simple Array values shim
 */
function arrayValues (arr) {
  if (arr.values)
    return arr.values();

  if (typeof Symbol === 'undefined' || !Symbol.iterator)
    throw new Error('Cannot return values iterator unless Symbol.iterator is defined');

  var iterable = {};
  iterable[Symbol.iterator] = function () {
    var keys = Object.keys(arr);
    var keyIndex = 0;
    return {
      next: function () {
        if (keyIndex < keys.length)
          return {
            value: arr[keys[keyIndex++]],
            done: false
          };
        else
          return {
            value: undefined,
            done: true
          };
      }
    };
  };
  return iterable;
}

/*
 * 3. Reflect.Loader
 *
 * We skip the entire native internal pipeline, just providing the bare API
 */
// 3.1.1
function Loader (baseKey) {
  this.key = baseKey || baseURI;
  this.registry = new Registry();
}
// 3.3.1
Loader.prototype.constructor = Loader;
// 3.3.2
Loader.prototype.import = function (key, parent) {
  if (typeof key !== 'string')
    throw new TypeError('Loader import method must be passed a module key string');
  return this.load(key, parent);
};
// 3.3.3
var RESOLVE = Loader.resolve = createSymbol('resolve');

// instantiate sets the namespace into the registry
// it is up to implementations to ensure instantiate is debounced properly
var INSTANTIATE = Loader.instantiate = createSymbol('instantiate');

Loader.prototype.resolve = function (key, parent) {
  return this[RESOLVE](key, parent)
  .catch(function (err) {
    throw addToError(err, 'Resolving ' + key + (parent ? ' to ' + parent : ''));
  });
};

// 3.3.4
Loader.prototype.load = function (key, parent) {
  var loader = this;
  var registry = loader.registry._registry;

  var resolvedKey;

  // there is the potential for an internal perf optimization to allow resolve to return { resolved, namespace }
  // but this needs to be done based on performance measurement
  return Promise.resolve(this[RESOLVE](key, parent || this.key))
  .then(function (resolved) {
    var existingNamespace = registry[resolved];

    if (existingNamespace)
      return Promise.resolve(existingNamespace);

    return loader[INSTANTIATE](resolved)
    .then(function (namespace) {

      // returning the namespace from instantiate can be considered a sort of perf optimization
      if (!namespace)
        namespace = loader.registry.get(resolvedKey);
      else if (!(namespace instanceof Module))
        throw new TypeError('Instantiate did not resolve a Module Namespace');

      return namespace;
    });
  })
  .catch(function (err) {
    throw addToError(err, 'Loading ' + key + (resolvedKey ? ' as ' + resolvedKey : '') + (parent ? ' from ' + parent : ''));
  });
};

/*
 * 4. Registry
 *
 * Instead of structuring through a Map, just use a dictionary object
 * We throw for construction attempts so this doesn't affect the public API
 *
 * Registry has been adjusted to use Namespace objects over ModuleStatus objects
 * as part of simplifying loader API implementation
 */
var iteratorSupport = typeof Symbol !== 'undefined' && Symbol.iterator;
function Registry() {
  this._registry = {};
}
// 4.4.1
Registry.prototype.constructor = function () {
  throw new TypeError('Custom registries cannot be created.');
};

if (iteratorSupport) {
  // 4.4.2
  Registry.prototype[Symbol.iterator] = function () {
    return this.entries()[Symbol.iterator]();
  };

  // 4.4.3
  Registry.prototype.entries = function () {
    var registry = this._registry;
    return arrayValues(Object.keys(registry).map(function (key) {
      return [key, registry[key]];
    }));
  };
}

// 4.4.4
Registry.prototype.keys = function () {
  return arrayValues(Object.keys(this._registry));
};
// 4.4.5
Registry.prototype.values = function () {
  var registry = this._registry;
  return arrayValues(Object.keys(registry).map(function (key) {
    return registry[key];
  }));
};
// 4.4.6
Registry.prototype.get = function (key) {
  return this._registry[key];
};
// 4.4.7
Registry.prototype.set = function (key, namespace) {
  if (!(namespace instanceof Module))
    throw new Error('Registry must be set with an instance of Module Namespace');
  this._registry[key] = namespace;
  return this;
};
// 4.4.8
Registry.prototype.has = function (key) {
  return !!this._registry[key];
};
// 4.4.9
Registry.prototype.delete = function (key) {
  if (this._registry[key]) {
    //delete this._registry[key];
    // much faster...
    this._registry[key] = undefined;
    return true;
  }
  return false;
};

/*
 * Simple ModuleNamespace Exotic object based on a baseObject
 * We export this for allowing a fast-path for module namespace creation over Module descriptors
 */
var EVALUATE = createSymbol('evaluate');
var BASE_OBJECT = createSymbol('baseObject');

// 8.3.1 Reflect.Module
/*
 * Best-effort spec guess made for September 2016 TC39 directions
 * - baseObject is the "module.exports"-like mutable object
 * - evaluate is an optional evaluation function
 *
 * The Module Namespace named export values are read as the iterable
 * properties of baseObject and fixed on completion of the evaluation
 * function (if any).
 *
 * Allows use cases:
 *
 *   loader.registry.set('x', new Module({ default: 'x' }));
 *
 * As well as:
 *
 *   var exports = {};
 *   loader.registry.set('cjs', new Module(exports, function() {
 *     exports.x = 'x';
 *   }));
 *
 */
function Module (baseObject, evaluate) {
  Object.defineProperty(this, BASE_OBJECT, {
    value: baseObject,
    writable: true
  });

  // evaluate defers namespace population
  if (evaluate)
    Object.defineProperty(this, EVALUATE, {
      value: evaluate,
      configurable: true,
      writable: true
    });
  else
    Object.keys(baseObject).forEach(extendNamespace, this);
};
// 8.4.2
Module.prototype = Object.create(null);

if (typeof Symbol !== 'undefined' && Symbol.toStringTag)
  Module.prototype[Symbol.toStringTag] = 'Module';
else
  Object.defineProperty(Module.prototype, 'toString', {
    value: function () {
      return '[object Module]';
    }
  });

function extendNamespace (key) {
  Object.defineProperty(this, key, {
    configurable: false,
    enumerable: true,
    get: function () {
      return this[BASE_OBJECT][key];
    },
    set: function () {
      throw new TypeError('Module exports cannot be changed externally.');
    }
  });
}

function doEvaluate (evaluate) {
  try {
    evaluate();
  }
  catch (e) {
    return e;
  }
}

// 8.4.1 Module.evaluate
Module.evaluate = function (ns) {
  var evaluate = ns[EVALUATE];
  if (evaluate) {
    ns[EVALUATE] = undefined;
    var err = doEvaluate(evaluate);
    if (err) {
      // effectively cache the evaluation error
      // to ensure we don't re-run evaluation of the module
      // before it has been cleared off the registry
      Object.defineProperty(ns, EVALUATE, {
        get: function() {
          throw err;
        }
      });
      throw err;
    }
    Object.keys(ns[BASE_OBJECT]).forEach(extendNamespace, ns);
  }
};

// non-spec
Module.isEvaluated = function (ns) {
  return !ns[EVALUATE];
};
