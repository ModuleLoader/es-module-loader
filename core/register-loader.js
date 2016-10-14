import { Loader, Module, } from './loader-polyfill.js';
import { resolveUrlToParentIfNotPlain } from './resolve.js';
import { addToError, global, createSymbol } from './common.js';

export default RegisterLoader;

export var emptyModule = new Module({});

/*
 * Register Loader
 *
 * Builds directly on top of loader polyfill to provide:
 * - loader.register support
 * - hookable higher-level normalize with metadata argument
 * - instantiate hook with metadata arugment returning a ModuleNamespace or undefined for es module loading
 * - loader error behaviour as in HTML and loader specs, clearing failed modules from registration cache synchronously
 * - build tracing support by providing a .trace=true and .loads object format
 */
function RegisterLoader (baseKey) {
  Loader.apply(this, arguments);

  // last anonymous System.register call
  this._registeredLastAnon = undefined;

  // in-flight es module load records
  this._registerRegistry = {};

  // tracing
  this.trace = false;
  // trace load objects when tracing
  this.loads = {};
}

RegisterLoader.prototype = Object.create(Loader.prototype);
RegisterLoader.prototype.constructor = RegisterLoader;

// NB replace with createSymbol('normalize'), ... for next major
RegisterLoader.normalize = 'normalize';
RegisterLoader.instantiate = 'instantiate';
RegisterLoader.createMetadata = 'createMetadata';
RegisterLoader.processRegisterContext = 'processRegisterContext';

// default normalize is the WhatWG style normalizer
RegisterLoader.prototype.normalize = function (key, parentKey, metadata) {
  return resolveUrlToParentIfNotPlain(key, parentKey);
};

RegisterLoader.prototype.instantiate = function (key, metadata) {};

// this function is an optimization to allow loader extensions to
// implement it to set the metadata object shape upfront to ensure
// it can run as a single hidden class throughout the normalize
// and instantiate pipeline hooks in the js engine
RegisterLoader.prototype.createMetadata = function () {
  return {};
};

var RESOLVE = Loader.resolve;

RegisterLoader.prototype[RESOLVE] = function (key, parentKey) {
  if (loader._registerRegistry[key] || loader.registry._registry[key])
    return Promise.resolve(key);

  return Promise.resolve(loader.normalize(key, parentKey, {}))
  .then(function (resolvedKey) {
    if (resolvedKey === undefined)
      throw new RangeError('No resolution found.');
    return resolvedKey;
  });
};

// provides instantiate promise cache
// we need to first wait on instantiate which will tell us if it is ES or not
// this record represents that waiting period, and when set, we then populate
// the esLinkRecord record into this load record.
// instantiate is a promise for a module namespace or undefined
function createLoadRecord (key, registration) {
  return this._registerRegistry[key] = {
    key: key,
    loader: this,

    // defineded System.register cache
    registration: registration,

    linkRecord: {
      metadata: undefined,

      // in-flight
      // promise for instantiate result (load / module namespace)
      instantiatePromise: undefined,

      error: undefined,

      dependencies: undefined,

      // will be the dependency load record, or a module namespace
      // picked up at linking time
      dependencyInstantiations: undefined,

      // indicates if module and all its dependencies have been instantiated
      // implies that dependencyInstantiations is fully populated
      // means we are ready to execute
      allInstantiated: false,

      execute: undefined,

      // this lock is necessary just in case a top level execute is called
      // while alreadu executing
      evaluated: false,

      // underlying module object
      moduleObj: undefined,

      // es only
      setters: undefined
    },

    module: undefined,

    // this sticks around so new module loads can listen to binding changes
    // for already-loaded modules by adding themselves to their importerSetters
    importerSetters: undefined
  };
}

RegisterLoader.prototype[Loader.resolveInstantiate] = function (key, parentKey) {
  var loader = this;
  var registry = loader.registry._registry;

  if (registry[key])
    return registry[key];

  var metadata;
  return Promise.resolve()
  .then(function () {
    return loader.normalize(key, parentKey, metadata = {});
  })
  .then(function (resolvedKey) {
    if (resolvedKey === undefined)
      throw new RangeError('No resolution found.');

    if (registry[resolvedKey])
      return registry[resolvedKey];

    var load = loader._registerRegistry[resolvedKey];

    if (!load) {
      load = createLoadRecord.call(loader, resolvedKey);
      load.linkRecord.metadata = metadata;
    }
    else if (!load.linkRecord) {
      // already linked but wasnt found in main registry
      // means it was removed by registry.delete, so we should
      // disgard the existing record creating a new one over it
      // but keep any registration
      var registration = load && load.registration;
      load = createLoadRecord.call(loader, resolvedKey);
      load.registration = registration;
      load.linkRecord.metadata = metadata;
    }

    return ensureInstantiate(loader, load)
    .then(function (module) {
      if (module)
        return registry[load.key] = module;

      return ensureInstantiateAllDeps(loader, load, [])
      .then(function () {
        return load.module;
      })
      .then(function (module) {
        // we add the top-level load to the registry
        // this allows deferred execution through loader.load
        // while keeping the dependency module records private to avoid
        // conflict scenarios with top-level exeuctions
        // dependencies are added into the registry as they become evaluated
        // unless otherwise top-level modules or already evaluated
        return registry[load.key] = load.module;
      })
    })
    .catch(function (err) {
      clearLoadErrors(loader, load);
      throw err;
    });
  });
};

// instantiates the given load record
// setting the dynamic namespace into the registry
function ensureInstantiate (loader, load) {
  var link = load.linkRecord;

  if (!link || link.allInstantiated)
    return Promise.resolve(load);

  if (link.error)
    return Promise.reject(link.error);

  return link.instantiatePromise || (link.instantiatePromise = Promise.resolve().then(function() {
    return loader.instantiate(load.key, link.metadata);
  }))
  .then(function (instantiation) {
    // direct module return from instantiate -> we're done
    if (instantiation !== undefined) {
      if (!(instantiation instanceof module))
        throw new TypeError('Instantiate did not return a valid Module object.');
      return instantiation;
    }

    // run the cached loader.register declaration if there is one
    ensureRegister.call(loader, load);
  })
  .catch(function (err) {
    throw link.error = addToError(err, 'Instantiating ' + load.key);
  });
}

// this only applies to load records with load.link set
function ensureInstantiateAllDeps (loader, load, seen) {
  var link = load.linkRecord;

  // skip if already executed / already all instantiated
  if (!link || link.allInstantiated)
    return Promise.resolve(load);

  if (seen.indexOf(load) !== -1)
    return Promise.resolve(load);
  seen.push(load);

  var instantiateDepsPromises = Array(link.dependencies.length);

  if (loader.trace)
    load.depMap = {};

  // instantiate dependencies deeply against seen list
  for (var i = 0; i < link.dependencies.length; i++)
    instantiateDepsPromises[i] = resolveInstantiateAllDeps.call(loader, link.dependencies[i], load, seen);

  return Promise.all(instantiateDepsPromises)
  .then(function (dependencyInstantiations) {
    link.allInstantiated = true;
    link.dependencyInstantiations = dependencyInstantiations;

    if (loader.trace)
      loader.loads[load.key] = {
        key: load.key,
        dependencies: link.dependencies,
        depMap: load.depMap,
        metadata: link.metadata
      };

    // run setters to set up bindings
    if (link.setters)
      for (var i = 0; i < dependencyInstantiations.length; i++) {
        var setter = link.setters[i];
        if (setter) {
          var instantiation = dependencyInstantiations[i];

          if (instantiation instanceof Module) {
            setter(instantiation, instantiation);
          }
          else {
            setter(instantiation.linkRecord && instantiation.linkRecord.moduleObj || instantiation.module, instantiation.module);
            // this applies to both es and dynamic registrations
            instantiation.importerSetters.push(setter);
          }
        }
      }

    return load;
  })
  .catch(function (err) {
    err = addToError(err, 'Loading ' + load.key);

    // throw up the instantiateAll stack
    // loads are then synchonously cleared at the top-level through the clearLoadErrors helper below
    // this then ensures avoiding partially unloaded tree states
    link.error = link.error || err;

    throw err;
  });
}

// just like resolveInstantiate, but with a seen list to handle instantiateAll subtrees
// this is used to instantiate dependencies in ensureInstantiateAllDeps
function resolveInstantiateAllDeps (key, parentLoad, seen) {
  var loader = this;
  var registry = loader.registry._registry;

  var load = loader._registerRegistry[key];
  if (registry[key]) {
    // tracing
    if (parentLoad.depMap)
      parentLoad.depMap[key] = key;

    // only use the load record if it matches the registry
    // the registry always has authoritative preference over registerRegistry
    if (load && registry[key] === load.module)
      return load;
    else
      return registry[key];
  }
  // only use the load if not in the registry if its linking
  // otherwise that indicates it was deleted from the main registry
  else if (load && load.linkRecord) {
    // tracing
    if (parentLoad.depMap)
      parentLoad.depMap[key] = key;

    return ensureInstantiate(loader, load)
    .then(function (module) {
      if (module)
        return module;

      return ensureInstantiateAllDeps(loader, load, seen);
    });
  }

  var metadata;
  return Promise.resolve()
  .then(function () {
    return loader.normalize(key, parentLoad.key, metadata = {});
  })
  .then(function (resolvedKey) {
    if (resolvedKey === undefined)
      throw new RangeError('No resolution found.');

    // for tracing
    if (parentLoad.depMap)
      parentLoad.depMap[key] = resolvedKey;

    // similar logic to above
    var load = loader._registerRegistry[resolvedKey];
    if (registry[resolvedKey]) {
      if (!load || registry[resolvedKey] !== load.module)
        return registry[resolvedKey];
    }
    else if (!load) {
      load = createLoadRecord.call(loader, resolvedKey);
      load.linkRecord.metadata = metadata;
    }
    else if (!load.linkRecord) {
      // already linked but wasnt found in main registry
      // means it was removed by registry.delete, so we should
      // disgard the existing record creating a new one over it
      // but keep any registration
      var registration = load && load.registration;
      load = createLoadRecord.call(loader, resolvedKey);
      load.registration = registration;
      load.linkRecord.metadata = metadata;
    }

    return ensureInstantiate(loader, load)
    .then(function (module) {
      if (module)
        return module;

      return ensureInstantiateAllDeps(loader, load, seen);
    });
  });
}

// clears an errored load and all its errored dependencies from the loads registry
function clearLoadErrors (loader, load) {
  // clear from loads
  if (loader._registerRegistry[load.key] === load)
    loader._registerRegistry[load.key] = undefined;

  var link = load.linkRecord;

  if (!link)
    return;

  if (link.dependencyInstantiations)
    link.dependencyInstantiations.forEach(function (depLoad, index) {
      if (!depLoad || depLoad instanceof Module)
        return;

      if (depLoad.linkRecord) {
        if (depLoad.linkRecord.error) {
          // provides a circular reference check
          if (loader._registerRegistry[depLoad.key] === depLoad)
            clearLoadErrors(loader, depLoad);
        }
        // unregister setters for es dependency load records that will remain
        else if (depLoad.importerSetters) {
          var setterIndex = depLoad.importerSetters.indexOf(link.setters[index]);
          depLoad.importerSetters.splice(setterIndex, 1);
        }
      }
    });
}

/*
 * System.register
 */
RegisterLoader.prototype.register = function (key, deps, declare) {
  // anonymous modules get stored as lastAnon
  if (declare === undefined) {
    this._registeredLastAnon = [key, deps, false];
  }

  // everything else registers into the register cache
  else {
    var load = this._registerRegistry[key] || createLoadRecord.call(this, key);
    load.registration = [deps, declare, false];
  }
};

/*
 * System.registerDyanmic
 */
RegisterLoader.prototype.registerDynamic = function (key, deps, execute) {
  // anonymous modules get stored as lastAnon
  if (typeof key !== 'string') {
    this._registeredLastAnon = [key, deps === true && execute || deps === false && makeExecutingRequire(key, execute) || deps, true];
  }

  // everything else registers into the register cache
  else {
    var load = this._registerRegistry[key] || createLoadRecord.call(this, key);
    load.registration = [deps, execute === true && arguments[3] || execute === false && makeExecutingRequire(key, arguments[3]) || execute, true];
  }
};
function makeNonExecutingRequire (deps, execute) {
  return function(require) {
    // evaluate deps first
    for (var i = 0; i < deps.length; i++)
      require(deps[i]);

    // then run execution function
    return execute.apply(this, arguments);
  };
}

RegisterLoader.prototype.processRegisterContext = function (contextKey) {
  var registeredLastAnon = this._registeredLastAnon;

  if (!registeredLastAnon)
    return;

  this._registeredLastAnon = undefined;

  // returning the defined value allows avoiding an extra lookup for custom instantiate
  var load = this._registerRegistry[contextKey] || createLoadRecord.call(this, contextKey);
  load.registration = registeredLastAnon;
};

function ensureRegister (load) {
  var link = load.linkRecord;

  var registration = load.registration;
  // clear to allow new registrations for future loads (combined with registry delete)
  load.registration = undefined;
  if (!registration)
    throw new TypeError('Module instantiation did not call an anonymous or correctly named System.register.');

  link.dependencies = registration[0];

  load.importerSetters = [];

  // dynamic module
  if (registration[2]) {
    var moduleObj = link.moduleObj = {};

    // NB manage this so we can actually dispose the load record!
    function require (name) {
      for (var i = 0; i < load.dependencies.length; i++) {
        if (load.dependencies[i] === name) {
          var depLoad = load.dependencyInstantiations[i];
          var err;
          if (depLoad instanceof Module)
            err = Module.evaluate(depLoad);
          else
            err = ensureEvaluate(depLoad, [load]);

          if (err)
            throw addToError(err, 'Calling require(\'' + name + '\') within ' + load.key);

          var module = depLoad instanceof Module ? depLoad : depLoad.module;
          return module.__useDefault ? module.default : module;
        }
      }
      throw new Error('Module ' + name + ' not declared as a System.registerDynamic dependency of ' + load.key);
    }

    var execute = registration[1];
    load.execute = function evaluate () {
      var exports = moduleObj.default = {};
      var module = { exports: exports, id: load.key };
      getESModule(execute(require, exports, module) || module.exports, moduleObj);
    }
    load.module = new Module(moduleObj, moduleEvaluate, load);
  }
  // declarative module
  else {
    var moduleObj = link.moduleObj = {};
    var module;

    var importerSetters = load.importerSetters;

    var locked = false;
    var declared = registration[1].call(global, function (name, value) {
      // export setter propogation with locking to avoid cycles
      if (locked)
        return;

      if (typeof name == 'object') {
        for (var p in name)
          moduleObj[p] = name[p];
      }
      else {
        moduleObj[name] = value;
      }

      locked = true;
      for (var i = 0; i < importerSetters.length; i++)
        // temporary solution to problem of bindings obj v module namespace
        // module namespace does not have export bindings present until it is executed
        // so bindings object is used to show bindings until then
        // but import * as X will then get this bindings object not a namespace
        // by providing both as separate arguments, transpilers can manage intent
        // ideally extensible namespace constructor could avoid this, but otherwise
        // we can stick with this two-argument approach
        importerSetters[i](moduleObj, module);
      locked = false;

      return value;
    }, new ContextualLoader(this, load.key));

    if (typeof declared !== 'function') {
      link.setters = declared.setters;
      link.execute = declared.execute;
    }
    else {
      link.setters = [];
      link.execute = declared;
    }

    module = load.module = new Module(moduleObj, moduleEvaluate, load);
  }
}

// ContextualLoader class
// backwards-compatible with previous System.register context argument by exposing .id
function ContextualLoader (loader, key) {
  this.loader = loader;
  this.key = this.id = key;
}
ContextualLoader.prototype.constructor = function () {
  throw new TypeError('Cannot subclass the contextual loader only Reflect.Loader.');
};
ContextualLoader.prototype.import = function (key) {
  return this.loader.import(key, this.key);
};
ContextualLoader.prototype.resolve = function (key) {
  return this.loader[Loader.resolve](key, this.key);
};
ContextualLoader.prototype.load = function (key) {
  return this.loader.load(key, this.key);
};

function moduleEvaluate () {
  var link = this.linkRecord;
  if (!link)
    return;

  if (link.error)
    throw link.error;

  var err = ensureEvaluate(this, []);
  if (err) {
    clearLoadErrors(this.loader, this);
    throw err;
  }

  // NB compare perf with clear loads batch here post-execute instead of ensure
}

// ensures the given es load is evaluated
// returns the error if any
function ensureEvaluate (load, seen) {
  seen.push(load);

  var link = load.linkRecord;

  // no esLinkRecord means evaluated
  if (!link || link.evaluated)
    return;

  var err, depLoad;

  // es modules evaluate dependencies first
  // non es modules explicitly call ensureEvaluate through require
  if (link.setters)
    for (var i = 0; i < link.dependencies.length; i++) {
      depLoad = link.dependencyInstantiations[i];

      // custom Module returned from instantiate
      // it is the responsibility of the executor to remove the module from the registry on failure
      if (depLoad instanceof Module)
        err = nsEvaluate(depLoad);

      // ES or dynamic execute
      else if (seen.indexOf(depLoad) === -1)
        err = ensureEvaluate(depLoad, seen);

      if (err)
        return link.error = addToError(err, 'Evaluating ' + load.key);
    }

  // extra guard in case of overlapping execution graphs
  // eg a Module.evaluate call within a Module.evaluate body
  if (!link.evaluated) {
    link.evaluated = true;
    err = doExecute(link.execute, link.setters && nullContext);

    if (err)
      return link.error = addToError(err, 'Evaluating ' + load.key);

    // can clear link record now for es modules,
    // just keeping importerSetters binding metadata
    load.linkRecord = undefined;

    // if not an esm module, run importer setters and clear them
    // this allows dynamic modules to update themselves into es modules
    // as soon as execution has completed
    if (!link.setters) {
      for (var i = 0; i < load.importerSetters.length; i++)
        load.importerSetters[i](link.moduleObj, load.module);

      // once executed, non-es modules can be removed from the private registry
      // since we don't need to store binding update metadata
      if (load.loader._registerRegistry[load.key] === load)
        load.loader._registerRegistry[load.key] = undefined;
    }

    // evaluate the namespace to seal the exports
    // this hits the shortpath in moduleEvaluate as linkRecord is undefined
    nsEvaluate(load.module);
    // as evaluated, ensure set in main registry
    load.loader.registry._registry[load.key] = load.module;
  }
  else if (link.error) {
    return link.error;
  }
}

// {} is the closest we can get to call(undefined)
var nullContext = {};
if (Object.freeze)
  Object.freeze(nullContext);
function doExecute (execute, context) {
  try {
    execute.call(context);
  }
  catch (e) {
    return e;
  }
}

function nsEvaluate (ns) {
  try {
    Module.evaluate(ns);
  }
  catch (e) {
    return e;
  }
}
