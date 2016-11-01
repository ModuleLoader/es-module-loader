import { baseURI, addToError, createSymbol } from './common.js';

// multiple exports of Module for backwards compat
// only ModuleNamespace will remain in next break!
export { Loader, Module, Module as InternalModuleNamespace, Module as ModuleNamespace }

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
  // custom resolveInstantiate combined hook for better perf
  return Promise.resolve(this[RESOLVE_INSTANTIATE](key, parent || this.key))
  .then(Module.evaluate)
  .catch(function (err) {
    throw addToError(err, 'Loading ' + key + (parent ? ' from ' + parent : ''));
  });
};
// 3.3.3
var RESOLVE = Loader.resolve = createSymbol('resolve');

/*
 * Combined resolve / instantiate hook
 *
 * Not in current reduced spec, but necessary to separate RESOLVE from RESOLVE + INSTANTIATE as described
 * in the spec notes of this repo to ensure that loader.resolve doesn't instantiate when not wanted.
 *
 * We implement RESOLVE_INSTANTIATE as a single hook instead of a separate INSTANTIATE in order to avoid
 * the need for double registry lookups as a performance optimization.
 */
var RESOLVE_INSTANTIATE = Loader.resolveInstantiate = createSymbol('resolveInstantiate');

// default resolveInstantiate is just to call resolve and then get from the registry
// this provides compatibility for the resolveInstantiate optimization
Loader.prototype[RESOLVE_INSTANTIATE] = function (key, parent) {
  var loader = this;
  return this.resolve(key, parent)
  .then(function (resolved) {
    var module = loader.registry.get(resolved);
    if (!module)
      throw new Error('Resolve did not define the "' + resolved + '" module into the registry.');
    return module;
  });
};

Loader.prototype[RESOLVE] = function () {
  throw new TypeError('No loader resolve hook implementation provided.');
};

Loader.prototype.resolve = function (key, parent) {
  var loader = this;
  return Promise.resolve()
  .then(function() {
    return loader[RESOLVE](key, parent);
  })
  .then(function (resolvedKey) {
    if (resolvedKey === undefined)
      throw new RangeError('No resolution found.');
    return resolvedKey;
  })
  .catch(function (err) {
    throw addToError(err, 'Resolving ' + key + (parent ? ' to ' + parent : ''));
  });
};

// 3.3.4 (import without evaluate)
// this is not documented because the use of deferred evaluation as in Module.evaluate is not
// documented, as it is not considered a stable feature to be encouraged
Loader.prototype.load = function (key, parent) {
  return Promise.resolve(this[RESOLVE_INSTANTIATE](key, parent || this.key))
  .catch(function (err) {
    throw addToError(err, 'Loading ' + key + (parent ? ' from ' + parent : ''));
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
 * Best-effort simplified non-spec implementation based on
 * a baseObject referenced via getters.
 *
 * Allows:
 *
 *   loader.registry.set('x', new Module({ default: 'x' }));
 *
 * Optional evaluation function provides experimental Module.evaluate
 * support for non-executed modules in registry.
 */
function Module (baseObject, evaluate) {
  Object.defineProperty(this, BASE_OBJECT, {
    value: baseObject
  });

  // evaluate defers namespace population
  if (evaluate) {
    Object.defineProperty(this, EVALUATE, {
      value: evaluate,
      configurable: true,
      writable: true
    });
  }
  else {
    Object.keys(baseObject).forEach(extendNamespace, this);
  }
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
    enumerable: true,
    get: function () {
      return this[BASE_OBJECT][key];
    }
  });
}

function doEvaluate (evaluate, context) {
  try {
    evaluate.call(context);
  }
  catch (e) {
    return e;
  }
}

// 8.4.1 Module.evaluate... not documented or used because this is potentially unstable
Module.evaluate = function (ns) {
  var evaluate = ns[EVALUATE];
  if (evaluate) {
    ns[EVALUATE] = undefined;
    var err = doEvaluate(evaluate);
    if (err) {
      // cache the error
      ns[EVALUATE] = function () {
        throw err;
      };
      throw err;
    }
    Object.keys(ns[BASE_OBJECT]).forEach(extendNamespace, ns);
  }
  // make chainable
  return ns;
};
