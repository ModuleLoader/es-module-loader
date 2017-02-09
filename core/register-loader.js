import { Loader, ModuleNamespace } from './loader-polyfill.js';
import { resolveIfNotPlain } from './resolve.js';
import { addToError, global, createSymbol, baseURI } from './common.js';

export default RegisterLoader;

/*
 * Register Loader
 *
 * Builds directly on top of loader polyfill to provide:
 * - loader.register support
 * - hookable higher-level resolve
 * - instantiate hook returning a ModuleNamespace or undefined for es module loading
 * - loader error behaviour as in HTML and loader specs, clearing failed modules from registration cache synchronously
 * - build tracing support by providing a .trace=true and .loads object format
 */

var REGISTER_INTERNAL = createSymbol('register-internal');

function RegisterLoader () {
  Loader.call(this);

  this[REGISTER_INTERNAL] = {
    // last anonymous System.register call
    lastRegister: undefined,
    // in-flight es module load records
    records: {}
  }

  // tracing
  this.trace = false;
}

RegisterLoader.prototype = Object.create(Loader.prototype);
RegisterLoader.prototype.constructor = RegisterLoader;

var INSTANTIATE = RegisterLoader.instantiate = createSymbol('instantiate');

// default normalize is the WhatWG style normalizer
RegisterLoader.prototype[RegisterLoader.resolve = Loader.resolve] = function (key, parentKey) {
  return resolveIfNotPlain(key, parentKey || baseURI);
};

RegisterLoader.prototype[INSTANTIATE] = function (key, processAnonRegister) {};

// once evaluated, the linkRecord is set to undefined leaving just the other load record properties
// this allows tracking new binding listeners for es modules through importerSetters
// for dynamic modules, the load record is removed entirely.
function createLoadRecord (state, key, registration) {
  return state.records[key] = {
    key: key,

    // defined System.register cache
    registration: registration,

    // module namespace object
    module: undefined,

    // es-only
    // this sticks around so new module loads can listen to binding changes
    // for already-loaded modules by adding themselves to their importerSetters
    importerSetters: undefined,

    // in-flight linking record
    linkRecord: {
      // promise for instantiated
      instantiatePromise: undefined,
      dependencies: undefined,
      execute: undefined,
      executingRequire: false,

      // underlying module object bindings
      moduleObj: undefined,

      // es only, also indicates if es or not
      setters: undefined,

      // promise for instantiated dependencies (dependencyInstantiations populated)
      depsInstantiatePromise: undefined,
      // will be the array of dependency load record or a module namespace
      dependencyInstantiations: undefined,

      // indicates if the load and all its dependencies are instantiated and linked
      // but not yet executed
      // mostly just a performance shortpath to avoid rechecking the promises above
      linked: false,

      error: undefined
      // NB optimization and way of ensuring module objects in setters
      // indicates setters which should run pre-execution of that dependency
      // setters is then just for completely executed module objects
      // alternatively we just pass the partially filled module objects as
      // arguments into the execute function
      // hoisted: undefined
    }
  };
}

RegisterLoader.prototype[Loader.resolveInstantiate] = function (key, parentKey) {
  var loader = this;
  var state = this[REGISTER_INTERNAL];
  var registry = loader.registry[loader.registry._registry];

  return resolveInstantiate(loader, key, parentKey, registry, state)
  .then(function (instantiated) {
    if (instantiated instanceof ModuleNamespace)
      return instantiated;

    // if already beaten to linked, return
    if (instantiated.module)
      return instantiated.module;

    // resolveInstantiate always returns a load record with a link record and no module value
    if (instantiated.linkRecord.linked)
      return ensureEvaluate(loader, instantiated, instantiated.linkRecord, registry, state, undefined);

    return instantiateDeps(loader, instantiated, instantiated.linkRecord, registry, state, [instantiated])
    .then(function () {
      return ensureEvaluate(loader, instantiated, instantiated.linkRecord, registry, state, undefined);
    })
    .catch(function (err) {
      clearLoadErrors(loader, instantiated);
      throw err;
    });
  });
};

function resolveInstantiate (loader, key, parentKey, registry, state) {
  // normalization shortpath for already-normalized key
  // could add a plain name filter, but doesn't yet seem necessary for perf
  var module = registry[key];
  if (module)
    return Promise.resolve(module);

  var load = state.records[key];

  // already linked but not in main registry is ignored
  if (load && !load.module)
    return instantiate(loader, load, load.linkRecord, registry, state);

  return loader.resolve(key, parentKey)
  .then(function (resolvedKey) {
    // main loader registry always takes preference
    module = registry[resolvedKey];
    if (module)
      return module;

    load = state.records[resolvedKey];

    // already has a module value but not already in the registry (load.module)
    // means it was removed by registry.delete, so we should
    // disgard the current load record creating a new one over it
    // but keep any existing registration
    if (!load || load.module)
      load = createLoadRecord(state, resolvedKey, load && load.registration);

    var link = load.linkRecord;
    if (!link)
      return load;

    return instantiate(loader, load, link, registry, state);
  });
}

function createProcessAnonRegister (loader, load, state) {
  return function () {
    var lastRegister = state.lastRegister;

    if (!lastRegister)
      return !!load.registration;

    state.lastRegister = undefined;
    load.registration = lastRegister;

    return true;
  };
}

function instantiate (loader, load, link, registry, state) {
  return link.instantiatePromise || (link.instantiatePromise =
  // if there is already an existing registration, skip running instantiate
  (load.registration ? Promise.resolve() : Promise.resolve().then(function () {
    state.lastRegister = undefined;
    return loader[INSTANTIATE](load.key, loader[INSTANTIATE].length > 1 && createProcessAnonRegister(loader, load, state));
  }))
  .then(function (instantiation) {
    // direct module return from instantiate -> we're done
    if (instantiation !== undefined) {
      if (!(instantiation instanceof ModuleNamespace))
        throw new TypeError('Instantiate did not return a valid Module object.');

      delete state.records[load.key];
      if (loader.trace)
        traceLoad(loader, load, link);
      return registry[load.key] = instantiation;
    }

    // run the cached loader.register declaration if there is one
    var registration = load.registration;
    // clear to allow new registrations for future loads (combined with registry delete)
    load.registration = undefined;
    if (!registration)
      throw new TypeError('Module instantiation did not call an anonymous or correctly named System.register.');

    link.dependencies = registration[0];

    load.importerSetters = [];

    link.moduleObj = {};

    // process System.registerDynamic declaration
    if (registration[2]) {
      link.moduleObj.default = {};
      link.moduleObj.__useDefault = true;
      link.executingRequire = registration[1];
      link.execute = registration[2];
    }

    // process System.register declaration
    else {
      registerDeclarative(loader, load, link, registration[1]);
    }

    // shortpath to instantiateDeps
    if (!link.dependencies.length) {
      link.linked = true;
      if (loader.trace)
        traceLoad(loader, load, link);
    }

    return load;
  })
  .catch(function (err) {
    throw link.error = addToError(err, 'Instantiating ' + load.key);
  }));
}

// like resolveInstantiate, but returning load records for linking
function resolveInstantiateDep (loader, key, parentKey, registry, state, traceDepMap) {
  // normalization shortpaths for already-normalized key
  // DISABLED to prioritise consistent resolver calls
  // could add a plain name filter, but doesn't yet seem necessary for perf
  /* var load = state.records[key];
  var module = registry[key];

  if (module) {
    if (traceDepMap)
      traceDepMap[key] = key;

    // registry authority check in case module was deleted or replaced in main registry
    if (load && load.module && load.module === module)
      return load;
    else
      return module;
  }

  // already linked but not in main registry is ignored
  if (load && !load.module) {
    if (traceDepMap)
      traceDepMap[key] = key;
    return instantiate(loader, load, load.linkRecord, registry, state);
  } */
  return loader.resolve(key, parentKey)
  .then(function (resolvedKey) {
    if (traceDepMap)
      traceDepMap[key] = key;

    // normalization shortpaths for already-normalized key
    var load = state.records[resolvedKey];
    var module = registry[resolvedKey];

    // main loader registry always takes preference
    if (module && (!load || load.module && module !== load.module))
      return module;

    // already has a module value but not already in the registry (load.module)
    // means it was removed by registry.delete, so we should
    // disgard the current load record creating a new one over it
    // but keep any existing registration
    if (!load || !module && load.module)
      load = createLoadRecord(state, resolvedKey, load && load.registration);

    var link = load.linkRecord;
    if (!link)
      return load;

    return instantiate(loader, load, link, registry, state);
  });
}

function traceLoad (loader, load, link) {
  loader.loads = loader.loads || {};
  loader.loads[load.key] = {
    key: load.key,
    deps: link.dependencies,
    depMap: link.depMap || {}
  };
}

/*
 * Convert a CJS module.exports into a valid object for new Module:
 *
 *   new Module(getEsModule(module.exports))
 *
 * Sets the default value to the module, while also reading off named exports carefully.
 */
function registerDeclarative (loader, load, link, declare) {
  var moduleObj = link.moduleObj;
  var importerSetters = load.importerSetters;

  var locked = false;

  // closure especially not based on link to allow link record disposal
  var declared = declare.call(global, function (name, value) {
    // export setter propogation with locking to avoid cycles
    if (locked)
      return;

    if (typeof name === 'object') {
      for (var p in name)
        if (p !== '__useDefault')
          moduleObj[p] = name[p];
    }
    else {
      moduleObj[name] = value;
    }

    locked = true;
    for (var i = 0; i < importerSetters.length; i++)
      importerSetters[i](moduleObj);
    locked = false;

    return value;
  }, new ContextualLoader(loader, load.key));

  link.setters = declared.setters;
  link.execute = declared.execute;
  if (declared.exports)
    link.moduleObj = moduleObj = declared.exports;
}

function instantiateDeps (loader, load, link, registry, state, seen) {
  return (link.depsInstantiatePromise || (link.depsInstantiatePromise = Promise.resolve()
  .then(function () {
    var depsInstantiatePromises = Array(link.dependencies.length);

    for (var i = 0; i < link.dependencies.length; i++)
      depsInstantiatePromises[i] = resolveInstantiateDep(loader, link.dependencies[i], load.key, registry, state, loader.trace && (link.depMap = {}));

    return Promise.all(depsInstantiatePromises);
  })
  .then(function (dependencyInstantiations) {
    link.dependencyInstantiations = dependencyInstantiations;

    // run setters to set up bindings to instantiated dependencies
    if (link.setters) {
      for (var i = 0; i < dependencyInstantiations.length; i++) {
        var setter = link.setters[i];
        if (setter) {
          var instantiation = dependencyInstantiations[i];

          if (instantiation instanceof ModuleNamespace) {
            setter(instantiation);
          }
          else {
            setter(instantiation.module || instantiation.linkRecord.moduleObj);
            // this applies to both es and dynamic registrations
            if (instantiation.importerSetters)
              instantiation.importerSetters.push(setter);
          }
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

      if (!depLink || depLink.linked)
        continue;

      if (seen.indexOf(depLoad) !== -1)
        continue;
      seen.push(depLoad);

      deepDepsInstantiatePromises.push(instantiateDeps(loader, depLoad, depLoad.linkRecord, registry, state, seen));
    }

    return Promise.all(deepDepsInstantiatePromises);
  })
  .then(function () {
    // as soon as all dependencies instantiated, we are ready for evaluation so can add to the registry
    // this can run multiple times, but so what
    link.linked = true;
    if (loader.trace)
      traceLoad(loader, load, link);

    return load;
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
  var state = loader[REGISTER_INTERNAL];

  // clear from loads
  if (state.records[load.key] === load)
    delete state.records[load.key];

  var link = load.linkRecord;

  if (!link)
    return;

  if (link.dependencyInstantiations)
    link.dependencyInstantiations.forEach(function (depLoad, index) {
      if (!depLoad || depLoad instanceof ModuleNamespace)
        return;

      if (depLoad.linkRecord) {
        if (depLoad.linkRecord.error) {
          // provides a circular reference check
          if (state.records[depLoad.key] === depLoad)
            clearLoadErrors(loader, depLoad);
        }

        // unregister setters for es dependency load records that will remain
        if (link.setters && depLoad.importerSetters) {
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
  var state = this[REGISTER_INTERNAL];

  // anonymous modules get stored as lastAnon
  if (declare === undefined) {
    state.lastRegister = [key, deps, undefined];
  }

  // everything else registers into the register cache
  else {
    var load = state.records[key] || createLoadRecord(state, key, undefined);
    load.registration = [deps, declare, undefined];
  }
};

/*
 * System.registerDyanmic
 */
RegisterLoader.prototype.registerDynamic = function (key, deps, executingRequire, execute) {
  var state = this[REGISTER_INTERNAL];

  // anonymous modules get stored as lastAnon
  if (typeof key !== 'string') {
    state.lastRegister = [key, deps, executingRequire];
  }

  // everything else registers into the register cache
  else {
    var load = state.records[key] || createLoadRecord(state, key, undefined);
    load.registration = [deps, executingRequire, execute];
  }
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
  return this.loader.resolve(key, this.key);
};
ContextualLoader.prototype.load = function (key) {
  return this.loader.load(key, this.key);
};

// this is the execution function bound to the Module namespace record
function ensureEvaluate (loader, load, link, registry, state, seen) {
  if (load.module)
    return load.module;

  if (link.error)
    throw link.error;

  if (seen && seen.indexOf(load) !== -1)
    return load.linkRecord.moduleObj;

  // for ES loads we always run ensureEvaluate on top-level, so empty seen is passed regardless
  // for dynamic loads, we pass seen if also dynamic
  var err = doEvaluate(loader, load, link, registry, state, link.setters ? [] : seen || []);
  if (err) {
    clearLoadErrors(loader, load);
    throw err;
  }

  return load.module;
}

function makeDynamicRequire (loader, key, dependencies, dependencyInstantiations, registry, state, seen) {
  // we can only require from already-known dependencies
  return function (name) {
    for (var i = 0; i < dependencies.length; i++) {
      if (dependencies[i] === name) {
        var depLoad = dependencyInstantiations[i];
        var module;

        if (depLoad instanceof ModuleNamespace)
          module = depLoad;
        else
          module = ensureEvaluate(loader, depLoad, depLoad.linkRecord, registry, state, seen);

        return module.__useDefault ? module.default : module;
      }
    }
    throw new Error('Module ' + name + ' not declared as a System.registerDynamic dependency of ' + key);
  };
}

// ensures the given es load is evaluated
// returns the error if any
function doEvaluate (loader, load, link, registry, state, seen) {
  seen.push(load);

  var err;

  // es modules evaluate dependencies first
  // non es modules explicitly call moduleEvaluate through require
  if (link.setters) {
    var depLoad, depLink;
    for (var i = 0; i < link.dependencies.length; i++) {
      depLoad = link.dependencyInstantiations[i];

      if (depLoad instanceof ModuleNamespace)
        continue;

      // custom Module returned from instantiate
      depLink = depLoad.linkRecord;
      if (depLink && seen.indexOf(depLoad) === -1) {
        if (depLink.error)
          err = depLink.error;
        else
          // dynamic / declarative boundaries clear the "seen" list
          // we just let cross format circular throw as would happen in real implementations
          err = doEvaluate(loader, depLoad, depLink, registry, state, depLink.setters ? seen : []);
      }

      if (err)
        return link.error = addToError(err, 'Evaluating ' + load.key);
    }
  }

  // link.execute won't exist for Module returns from instantiate on top-level load
  if (link.execute) {
    // ES System.register execute
    // "this" is null in ES
    if (link.setters) {
      err = declarativeExecute(link.execute);
    }
    // System.registerDynamic execute
    // "this" is "exports" in CJS
    else {
      var module = { id: load.key };
      var moduleObj = link.moduleObj;
      Object.defineProperty(module, 'exports', {
        configurable: true,
        set: function (exports) {
          moduleObj.default = exports;
        },
        get: function () {
          return moduleObj.default;
        }
      });

      var require = makeDynamicRequire(loader, load.key, link.dependencies, link.dependencyInstantiations, registry, state, seen);

      // evaluate deps first
      if (!link.executingRequire)
        for (var i = 0; i < link.dependencies.length; i++)
          require(link.dependencies[i]);

      err = dynamicExecute(link.execute, require, moduleObj.default, module);

      // pick up defineProperty calls to module.exports when we can
      if (module.exports !== moduleObj.default)
        moduleObj.default = module.exports;

      // __esModule flag extension support via lifting
      if (moduleObj.default && moduleObj.default.__esModule) {
        moduleObj.__useDefault = false;
        for (var p in moduleObj.default) {
          if (Object.hasOwnProperty.call(moduleObj.default, p))
            moduleObj[p] = moduleObj.default[p];
        }
        Object.defineProperty(moduleObj, '__esModule', {
          value: true
        });
      }
    }
  }

  if (err)
    return link.error = addToError(err, 'Evaluating ' + load.key);

  registry[load.key] = load.module = new ModuleNamespace(link.moduleObj);

  // if not an esm module, run importer setters and clear them
  // this allows dynamic modules to update themselves into es modules
  // as soon as execution has completed
  if (!link.setters) {
    if (load.importerSetters)
      for (var i = 0; i < load.importerSetters.length; i++)
        load.importerSetters[i](load.module);
    load.importerSetters = undefined;
  }

  // dispose link record
  load.linkRecord = undefined;
}

// {} is the closest we can get to call(undefined)
var nullContext = {};
if (Object.freeze)
  Object.freeze(nullContext);

function declarativeExecute (execute) {
  try {
    execute.call(nullContext);
  }
  catch (e) {
    return e;
  }
}

function dynamicExecute (execute, require, exports, module) {
  try {
    var output = execute.call(global, require, exports, module);
    if (output !== undefined)
      module.exports = output;
  }
  catch (e) {
    return e;
  }
}
