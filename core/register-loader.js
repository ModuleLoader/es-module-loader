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

var REGISTER_REGISTRY = createSymbol('registerRegistry');
var REGISTERED_LAST_ANON = createSymbol('registeredLastAnon');

function RegisterLoader (baseKey) {
  Loader.apply(this, arguments);

  // last anonymous System.register call
  this[REGISTERED_LAST_ANON] = undefined;

  // in-flight es module load records
  this[REGISTER_REGISTRY] = {};

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
  if (loader[REGISTER_REGISTRY][key] || loader.registry._registry[key])
    return Promise.resolve(key);

  return Promise.resolve(loader.normalize(key, parentKey, this.createMetadata()))
  .then(function (resolvedKey) {
    if (resolvedKey === undefined)
      throw new RangeError('No resolution found.');
    return resolvedKey;
  });
};

// once evaluated, the linkRecord is set to undefined leaving just the other load record properties
// this allows tracking new binding listeners for es modules through importerSetters
// for dynamic modules, the load record is removed entirely.
function createLoadRecord (key, registration) {
  return this[REGISTER_REGISTRY][key] = {
    key: key,
    loader: this,

    // defined System.register cache
    registration: registration,

    // module namespace object
    module: undefined,

    // indicates if the load is completely linked and in the main registry
    linked: false,

    // es-only
    // this sticks around so new module loads can listen to binding changes
    // for already-loaded modules by adding themselves to their importerSetters
    importerSetters: undefined,

    // in-flight linking record
    linkRecord: {
      metadata: undefined,

      // promise for instantiated
      instantiatePromise: undefined,
      // promise for instantiated dependencies (dependencyInstantiations populated)
      depsInstantiatePromise: undefined,
      // will be the dependency load record, or a module namespace
      // picked up at linking time
      dependencyInstantiations: undefined,

      error: undefined,

      dependencies: undefined,

      execute: undefined,
      evaluated: false,

      // underlying module object bindings
      moduleObj: undefined,

      // es only, also indicates if es or not
      setters: undefined
    }
  };
}

RegisterLoader.prototype[Loader.resolveInstantiate] = function (key, parentKey) {
  var loader = this;
  var registry = loader.registry._registry;
  var registerRegistry = loader[REGISTER_REGISTRY];
  return resolveInstantiate(loader, key, parentKey, registry, registerRegistry, undefined)
  .then(function (instantiated) {
    if (instantiated instanceof Module)
      return instantiated;

    if (instantiated.linked)
      return instantiated.module;

    return instantiateDeps(loader, instantiated, instantiated.linkRecord, registry, registerRegistry, [instantiated])
    .catch(function (err) {
      clearLoadErrors(loader, instantiated);
      throw err;
    });
  });
};

function resolveInstantiate (loader, key, parentKey, registry, registerRegistry, traceDepMap) {
  var load = registerRegistry[key];
  var module = registry[key];

  if (module) {
    if (traceDepMap)
      traceDepMap[key] = key;

    if (load && load.module === module)
      return Promise.resolve(load);
    else
      return Promise.resolve(module);
  }

  // already linked but not in main registry is ignored
  if (load && !load.linked) {
    if (traceDepMap)
      traceDepMap[key] = key;
    return instantiate(loader, load, load.linkRecord, registry, registerRegistry);
  }

  var metadata = loader.createMetadata();
  return Promise.resolve()
  .then(function () {
    return loader.normalize(key, parentKey, metadata);
  })
  .catch(function (err) {
    throw addToError(err, 'Resolving dependency "' + key + '" of ' + parentKey);
  })
  .then(function (resolvedKey) {
    if (resolvedKey === undefined)
      throw new RangeError('No resolution found resolving dependency "' + key + '" of ' + parentKey);

    if (traceDepMap)
      traceDepMap[key] = key;

    // similar logic to above
    load = registerRegistry[resolvedKey];
    module = registry[resolvedKey];

    // main loader registry always takes preference
    if (module && (!load || module !== load.module))
      return module;

    // already linked but wasnt found in main registry (!module && load.linked)
    // means it was removed by registry.delete, so we should
    // disgard the current load record creating a new one over it
    // but keep any existing registration
    if (!load || !module && load.linked)
      load = createLoadRecord.call(loader, resolvedKey, load && load.registration);

    var link = load.linkRecord;
    if (!link)
      return load;

    link.metadata = link.metadata || metadata;
    return instantiate(loader, load, link, registry, registerRegistry);
  });
}

function instantiate (loader, load, link, registry, registerRegistry) {
  return link.instantiatePromise || (link.instantiatePromise =
  Promise.resolve(loader.instantiate(load.key, link.metadata))
  .then(function (instantiation) {
    // direct module return from instantiate -> we're done
    if (instantiation !== undefined) {
      if (!(instantiation instanceof Module))
        throw new TypeError('Instantiate did not return a valid Module object.');

      load.linked = true;
      registerRegistry[load.key] = undefined;
      if (loader.trace)
        traceLoad(load, link);
      return registry[load.key] = load.module = instantiation;
    }

    // run the cached loader.register declaration if there is one
    var registration = load.registration;
    // clear to allow new registrations for future loads (combined with registry delete)
    // NB try deferring registration removal?
    load.registration = undefined;
    if (!registration)
      throw new TypeError('Module instantiation did not call an anonymous or correctly named System.register.');

    link.dependencies = registration[0];

    load.importerSetters = [];

    // process System.registerDynamic declaration
    if (registration[2])
      registerDynamic.call(loader, load, link, registration[1]);

    // process System.register declaration
    else
      registerDeclarative.call(loader, load, link, registration[1]);

    // shortpath to instantiateDeps
    if (!link.dependencies.length) {
      load.linked = true;
      if (loader.trace)
        traceLoad(load, link);
      registry[load.key] = load.module;
    }

    return load;
  })
  .catch(function (err) {
    throw link.error = addToError(err, 'Instantiating ' + load.key);
  }));
}

function traceLoad (load, link) {
  loader.loads[load.key] = {
    key: load.key,
    dependencies: load.link.dependencies,
    depMap: link.depMap,
    metadata: link.metadata
  };
}

function registerDynamic (load, link, execute) {
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
          err = doEvaluate(depLoad, depLoad.link, [load]);

        if (err)
          throw addToError(err, 'Calling require(\'' + name + '\') within ' + load.key);

        var module = depLoad instanceof Module ? depLoad : depLoad.module;
        return module.__useDefault ? module.default : module;
      }
    }
    throw new Error('Module ' + name + ' not declared as a System.registerDynamic dependency of ' + load.key);
  }

  load.execute = function evaluate () {
    var exports = moduleObj.default = {};
    var module = { exports: exports, id: load.key };
    getESModule(execute(require, exports, module) || module.exports, moduleObj);
  }
  load.module = new Module(moduleObj, moduleEvaluate, load);
}

function registerDeclarative (load, link, declare) {
  var moduleObj = link.moduleObj = {};
  var importerSetters = load.importerSetters;
  var module = load.module = new Module(moduleObj, moduleEvaluate, load);

  var locked = false;

  // closure especially not based on link to allow link record disposal
  var declared = declare.call(global, function (name, value) {
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
}

function instantiateDeps (loader, load, link, registry, registerRegistry, seen) {
  return (link.depsInstantiatePromise || (link.depsInstantiatePromise = Promise.resolve()
  .then(function () {
    var depsInstantiatePromises = Array(link.dependencies.length);

    for (var i = 0; i < link.dependencies.length; i++)
      depsInstantiatePromises[i] = resolveInstantiate(loader, link.dependencies[i], load.key, registry, registerRegistry, loader.trace && (link.depMap = {}));

    return Promise.all(depsInstantiatePromises);
  })
  .then(function (dependencyInstantiations) {
    link.dependencyInstantiations = dependencyInstantiations;

    // run setters to set up bindings to instantiated dependencies
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
            if (instantiation.importerSetters)
              instantiation.importerSetters.push(setter);
          }
        }
      }
  })))
  .then(function () {
    // now deeply instantiateDeps on each dependencyInstantiation that is a load record
    var deepDepsInstantiatePromises = [];

    for (var i = 0; i < link.dependencies.length; i++) {
      var depLoad = link.dependencyInstantiations[i];
      var depLink = depLoad.linkRecord;

      if (!depLink || depLoad.linked)
        continue;

      if (seen.indexOf(depLoad) !== -1)
        continue;
      seen.push(depLoad);

      deepDepsInstantiatePromises.push(instantiateDeps(loader, depLoad, depLoad.linkRecord, registry, registerRegistry, seen));
    }

    return Promise.all(deepDepsInstantiatePromises);
  })
  .then(function () {
    // as soon as all dependencies instantiated, we are ready for evaluation so can add to the registry
    // this can run multiple times, but so what
    load.linked = true;
    registry[load.key] = load.module;
    if (loader.trace)
      traceLoad(load, link);

    return load.module;
  })
  .catch(function (err) {
    err = addToError(err, 'Loading ' + load.key);

    // throw up the instantiateDeps stack
    // loads are then synchonously cleared at the top-level through the clearLoadErrors helper below
    // this then ensures avoiding partially unloaded tree states
    link.error = link.error || err;

    throw err;
  });
}

// clears an errored load and all its errored dependencies from the loads registry
function clearLoadErrors (loader, load) {
  // clear from loads
  if (loader[REGISTER_REGISTRY][load.key] === load)
    loader[REGISTER_REGISTRY][load.key] = undefined;

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
          if (loader[REGISTER_REGISTRY][depLoad.key] === depLoad)
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
    this[REGISTERED_LAST_ANON] = [key, deps, false];
  }

  // everything else registers into the register cache
  else {
    var load = this[REGISTER_REGISTRY][key] || createLoadRecord.call(this, key, undefined);
    load.registration = [deps, declare, false];
  }
};

/*
 * System.registerDyanmic
 */
RegisterLoader.prototype.registerDynamic = function (key, deps, execute) {
  // anonymous modules get stored as lastAnon
  if (typeof key !== 'string') {
    this[REGISTERED_LAST_ANON] = [key, deps === true && execute || deps === false && makeExecutingRequire(key, execute) || deps, true];
  }

  // everything else registers into the register cache
  else {
    var load = this[REGISTER_REGISTRY][key] || createLoadRecord.call(this, key, undefined);
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
  var registeredLastAnon = this[REGISTERED_LAST_ANON];

  if (!registeredLastAnon)
    return;

  this[REGISTERED_LAST_ANON] = undefined;

  // returning the defined value allows avoiding an extra lookup for custom instantiate
  var load = this[REGISTER_REGISTRY][contextKey] || createLoadRecord.call(this, contextKey, undefined);
  load.registration = registeredLastAnon;
};

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

// this is the execution function bound to the Module namespace record
function moduleEvaluate () {
  var link = this.linkRecord;
  if (!link)
    return;

  if (link.error)
    throw link.error;

  if (link.evaluated)
    return;

  var err = doEvaluate(this, link, []);
  if (err) {
    clearLoadErrors(this.loader, this);
    throw err;
  }
}

// ensures the given es load is evaluated
// returns the error if any
function doEvaluate (load, link, seen) {
  seen.push(load);

  var err, depLoad, depLink;

  // es modules evaluate dependencies first
  // non es modules explicitly call moduleEvaluate through require
  if (link.setters)
    for (var i = 0; i < link.dependencies.length; i++) {
      depLoad = link.dependencyInstantiations[i];

      // custom Module returned from instantiate
      // it is the responsibility of the executor to remove the module from the registry on failure
      if (depLoad instanceof Module) {
        err = nsEvaluate(depLoad);
      }

      // ES or dynamic execute
      else if (seen.indexOf(depLoad) === -1) {
        depLink = depLoad.linkRecord;

        if (!depLink)
          continue;

        if (depLink.error)
          err = depLink.error;
        else if (!depLink.evaluated)
          err = doEvaluate(depLoad, depLink, seen);
      }

      if (err)
        return link.error = addToError(err, 'Evaluating ' + load.key);
    }

  // extra guard in case of overlapping execution graphs
  // eg a Module.evaluate call within a Module.evaluate body
  link.evaluated = true;
  if (link.execute)
    err = doExecute(link.execute, link.setters && nullContext);

  if (err)
    return link.error = addToError(err, 'Evaluating ' + load.key);

  // if not an esm module, run importer setters and clear them
  // this allows dynamic modules to update themselves into es modules
  // as soon as execution has completed
  if (!link.setters) {
    if (load.importerSetters)
      for (var i = 0; i < load.importerSetters.length; i++)
        load.importerSetters[i](link.moduleObj, load.module);

    // once executed, non-es modules can be removed from the private registry
    // since we don't need to store binding update metadata
    if (load.loader[REGISTER_REGISTRY][load.key] === load)
      load.loader[REGISTER_REGISTRY][load.key] = undefined;
  }

  load.linkRecord = undefined;

  // evaluate the namespace to seal the exports
  // this hits the shortpath in moduleEvaluate as linkRecord is undefined
  nsEvaluate(load.module);
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
