import { baseURI, addToError } from './common.js';
export { Loader, Module, ModuleNamespace as InternalModuleNamespace }

/*
 * Simple Symbol() shim
 */
var hasSymbol = typeof Symbol !== 'undefined';
function createSymbol(name) {
  return hasSymbol ? Symbol() : '@@' + name;
}

/*
 * Simple Array values shim
 */
function arrayValues(arr) {
  if (arr.values)
    return arr.values();
  
  if (typeof Symbol === 'undefined' || !Symbol.iterator)
    throw new Error('Cannot return values iterator unless Symbol.iterator is defined');

  var iterable = {};
  iterable[Symbol.iterator] = function() {
    var keys = Object.keys(arr);
    var keyIndex = 0;
    return {
      next: function() {
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
function Loader(baseKey) {
  this.key = baseKey || baseURI;
  this.registry = new Registry();

  // evaluation flag to allow for tracing loaders
  this.execute = true;
}
// 3.3.1
Loader.prototype.constructor = Loader;
// 3.3.2
Loader.prototype.import = function(key, parent) {
  if (typeof key !== 'string')
    throw new TypeError('Loader import method must be passed a module key string');
  var execute = this.execute;
  return this.load(key, parent)
  .then(function(module) {
    // ensure evaluated
    if (execute)
      Module.evaluate(module);

    return module;
  });
};
// 3.3.3
var RESOLVE = Loader.resolve = createSymbol('resolve');

// instantiate sets the namespace into the registry
// it is up to implementations to ensure instantiate is debounced properly
var INSTANTIATE = Loader.instantiate = createSymbol('instantiate');

Loader.prototype.resolve = function(key, parent) {
  return this[RESOLVE](key, parent)
  .catch(function(err) {
    throw addToError(err, 'Resolving ' + key + (parent ? ' to ' + parent : ''));
  });
};

// 3.3.4
Loader.prototype.load = function(key, parent) {
  var loader = this;

  var resolvedKey;

  // there is the potential for an internal perf optimization to allow resolve to return { resolved, namespace }
  // but this needs to be done based on performance measurement
  return Promise.resolve(this[RESOLVE](key, parent || this.key))
  .then(function(resolved) {
    var existingNamespace = loader.registry.get(resolved);

    if (existingNamespace)
      return Promise.resolve(existingNamespace);

    return loader[INSTANTIATE](resolved)
    .then(function(namespace) {

      // returning the namespace from instantiate can be considered a sort of perf optimization
      if (!namespace)
        namespace = loader.registry.get(resolvedKey);
      else if (!(namespace instanceof ModuleNamespace))
        throw new TypeError('Instantiate did not resolve a Module Namespace');

      return namespace;
    });
  })
  .catch(function(err) {
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
Registry.prototype.constructor = function() {
  throw new TypeError('Custom registries cannot be created.');
};

if (iteratorSupport) {
  // 4.4.2
  Registry.prototype[Symbol.iterator] = function() {
    return this.entries()[Symbol.iterator]();
  };

  // 4.4.3
  Registry.prototype.entries = function() {
    var registry = this._registry;
    return arrayValues(Object.keys(registry).map(function(key) {
      return [key, registry[key]];
    }));
  };
}

// 4.4.4
Registry.prototype.keys = function() {
  return arrayValues(Object.keys(this._registry));
};
// 4.4.5
Registry.prototype.values = function() {
  var registry = this._registry;
  return arrayValues(Object.keys(registry).map(function(key) {
    return registry[key];
  }));
};
// 4.4.6
Registry.prototype.get = function(key) {
  return this._registry[key];
};
// 4.4.7
Registry.prototype.set = function(key, namespace) {
  if (!(namespace instanceof ModuleNamespace))
    throw new Error('Registry must be set with an instance of Module Namespace');
  this._registry[key] = namespace;
  return this;
};
// 4.4.8
Registry.prototype.has = function(key) {
  return !!this._registry[key];
};
// 4.4.9
Registry.prototype.delete = function(key) {
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
function ModuleNamespace(baseObject, evaluate) {
  var ns = this;
  Object.keys(baseObject).forEach(function(key) {
    Object.defineProperty(ns, key, {
      configurable: false,
      enumerable: true,
      get: function () {
        return baseObject[key];
      },
      set: function() {
        throw new TypeError('Module exports cannot be changed externally.');
      }
    });
  });
  if (evaluate)
    ns._evaluate = evaluate;
}

if (typeof Symbol !== 'undefined' && Symbol.toStringTag)
  ModuleNamespace.prototype[Symbol.toStringTag] = 'Module';

// 8.3.1 Reflect.Module
function Module(descriptors, executor, evaluate) {
  if (typeof descriptors !== 'object')
    throw new TypeError('Expected descriptors object');

  // instead of providing a mutator, just provide the base object
  var baseObject = {};

  // 8.2.1 ParseExportsDescriptors
  Object.keys(descriptors).forEach(function(key) {
    var descriptor = descriptors[key];

    if (!('value' in descriptor))
      throw new TypeError('Error reading descriptor for "' + key + '" - module polyfill only supports value descriptors currently');

    baseObject[key] = descriptor.value;
  });

  var ns = new ModuleNamespace(baseObject, evaluate);

  if (executor)
    executor(baseObject, ns);

  return ns;
};
// 8.4.2
Module.prototype = null;

// 8.4.1 Module.evaluate
Module.evaluate = function(ns) {
  if (!(ns instanceof ModuleNamespace))
    throw new TypeError('Module.evaluate must be called on a Module Namespace');

  if (ns._evaluate) {
    ns._evaluate();
    ns._evaluate = undefined;
  }
};
