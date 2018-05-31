import { Loader, ModuleNamespace, REGISTRY } from './loader-polyfill.js';
import { resolveIfNotPlain } from './resolve.js';
import { addToError, global, createSymbol, baseURI, toStringTag } from './common.js';

export default RegisterLoader;

var resolvedPromise = Promise.resolve();
var emptyArray = [];

/*
 * Register Loader
 *
 * Builds directly on top of loader polyfill to provide:
 * - loader.register support
 * - hookable higher-level resolve
 * - instantiate hook returning a ModuleNamespace or undefined for es module loading
 * - loader error behaviour as in HTML and loader specs, caching load and eval errors separately
 * - build tracing support by providing a .trace=true and .loads object format
 */

var REGISTER_INTERNAL = createSymbol('register-internal');

function RegisterLoader () {
  Loader.call(this);

  var registryDelete = this.registry.delete;
  this.registry.delete = function (key) {
    var deleted = registryDelete.call(this, key);

    // also delete from register registry if linked
    if (records.hasOwnProperty(key) && !records[key].linkRecord) {
      delete records[key];
      deleted = true;
    }

    return deleted;
  };

  var records = {};

  this[REGISTER_INTERNAL] = {
    // last anonymous System.register call
    lastRegister: undefined,
    // in-flight es module load records
    records: records
  };

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

    loadError: undefined,
    evalError: undefined,

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

      // top-level await!
      evaluatePromise: undefined,

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
  var registry = this.registry[REGISTRY];

  return resolveInstantiate(loader, key, parentKey, registry, state)
  .then(function (instantiated) {
    if (instantiated instanceof ModuleNamespace || instantiated[toStringTag] === 'module')
      return instantiated;

    // resolveInstantiate always returns a load record with a link record and no module value
    var link = instantiated.linkRecord;

    // if already beaten to done, return
    if (!link) {
      if (instantiated.module)
        return instantiated.module;
      throw instantiated.evalError;
    }

    return deepInstantiateDeps(loader, instantiated, link, registry, state)
    .then(function () {
      return ensureEvaluate(loader, instantiated, link, registry, state);
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
  if (load && !load.module) {
    if (load.loadError)
      return Promise.reject(load.loadError);
    return instantiate(loader, load, load.linkRecord, registry, state);
  }

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

    if (load.loadError)
      return Promise.reject(load.loadError);

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
  (load.registration ? resolvedPromise : resolvedPromise.then(function () {
    state.lastRegister = undefined;
    return loader[INSTANTIATE](load.key, loader[INSTANTIATE].length > 1 && createProcessAnonRegister(loader, load, state));
  }))
  .then(function (instantiation) {
    // direct module return from instantiate -> we're done
    if (instantiation !== undefined) {
      if (!(instantiation instanceof ModuleNamespace || instantiation[toStringTag] === 'module'))
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
      link.moduleObj.default = link.moduleObj.__useDefault = {};
      link.executingRequire = registration[1];
      link.execute = registration[2];
    }

    // process System.register declaration
    else {
      registerDeclarative(loader, load, link, registration[1]);
    }

    return load;
  })
  .catch(function (err) {
    load.linkRecord = undefined;
    throw load.loadError = load.loadError || addToError(err, 'Instantiating ' + load.key);
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
      traceDepMap[key] = resolvedKey;

    // normalization shortpaths for already-normalized key
    var load = state.records[resolvedKey];
    var module = registry[resolvedKey];

    // main loader registry always takes preference
    if (module && (!load || load.module && module !== load.module))
      return module;

    if (load && load.loadError)
      throw load.loadError;

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
    dynamicDeps: [],
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

  var definedExports = false;

  // closure especially not based on link to allow link record disposal
  var declared = declare.call(global, function (name, value) {
    if (typeof name === 'object') {
      var changed = false;
      for (var p in name) {
        value = name[p];
        if (p !== '__useDefault' && (!(p in moduleObj) || moduleObj[p] !== value)) {
          changed = true;
          moduleObj[p] = value;
        }
      }
      if (changed === false)
        return value;
    }
    else {
      if ((definedExports || name in moduleObj) && moduleObj[name] === value)
        return value;
      moduleObj[name] = value;
    }

    for (var i = 0; i < importerSetters.length; i++)
      importerSetters[i](moduleObj);

    return value;
  }, new ContextualLoader(loader, load.key));

  link.setters = declared.setters || [];
  link.execute = declared.execute;
  if (declared.exports) {
    link.moduleObj = moduleObj = declared.exports;
    definedExports = true;
  }
}

function instantiateDeps (loader, load, link, registry, state) {
  if (link.depsInstantiatePromise)
    return link.depsInstantiatePromise;

  var depsInstantiatePromises = Array(link.dependencies.length);

  for (var i = 0; i < link.dependencies.length; i++)
    depsInstantiatePromises[i] = resolveInstantiateDep(loader, link.dependencies[i], load.key, registry, state, loader.trace && link.depMap || (link.depMap = {}));

  var depsInstantiatePromise = Promise.all(depsInstantiatePromises)
  .then(function (dependencyInstantiations) {
    link.dependencyInstantiations = dependencyInstantiations;

    // run setters to set up bindings to instantiated dependencies
    if (link.setters) {
      for (var i = 0; i < dependencyInstantiations.length; i++) {
        var setter = link.setters[i];
        if (setter) {
          var instantiation = dependencyInstantiations[i];

          if (instantiation instanceof ModuleNamespace || instantiation[toStringTag] === 'module') {
            setter(instantiation);
          }
          else {
            if (instantiation.loadError)
              throw instantiation.loadError;
            setter(instantiation.module || instantiation.linkRecord.moduleObj);
            // this applies to both es and dynamic registrations
            if (instantiation.importerSetters)
              instantiation.importerSetters.push(setter);
          }
        }
      }
    }

    return load;
  });

  if (loader.trace)
    depsInstantiatePromise = depsInstantiatePromise.then(function () {
      traceLoad(loader, load, link);
      return load;
    });

  depsInstantiatePromise = depsInstantiatePromise.catch(function (err) {
    // throw up the instantiateDeps stack
    link.depsInstantiatePromise = undefined;
    throw addToError(err, 'Loading ' + load.key);
  });

  depsInstantiatePromise.catch(function () {});

  return link.depsInstantiatePromise = depsInstantiatePromise;
}

function deepInstantiateDeps (loader, load, link, registry, state) {
  var seen = [];
  function addDeps (load, link) {
    if (!link)
      return resolvedPromise;
    if (seen.indexOf(load) !== -1)
      return resolvedPromise;
    seen.push(load);
    
    return instantiateDeps(loader, load, link, registry, state)
    .then(function () {
      var depPromises;
      for (var i = 0; i < link.dependencies.length; i++) {
        var depLoad = link.dependencyInstantiations[i];
        if (!(depLoad instanceof ModuleNamespace || depLoad[toStringTag] === 'module')) {
          depPromises = depPromises || [];
          depPromises.push(addDeps(depLoad, depLoad.linkRecord));
        }
      }
      if (depPromises)
        return Promise.all(depPromises);
    });
  };

  return addDeps(load, link);
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
// backwards-compatible with previous System.register context argument by exposing .id, .key
function ContextualLoader (loader, key) {
  this.loader = loader;
  this.key = this.id = key;
  this.meta = {
    url: key
    // scriptElement: null
  };
}
/*ContextualLoader.prototype.constructor = function () {
  throw new TypeError('Cannot subclass the contextual loader only Reflect.Loader.');
};*/
ContextualLoader.prototype.import = function (key) {
  if (this.loader.trace)
    this.loader.loads[this.key].dynamicDeps.push(key);
  return this.loader.import(key, this.key);
};
/*ContextualLoader.prototype.resolve = function (key) {
  return this.loader.resolve(key, this.key);
};*/

function ensureEvaluate (loader, load, link, registry, state) {
  if (load.module)
    return load.module;
  if (load.evalError)
    throw load.evalError;
  if (link.evaluatePromise)
    return link.evaluatePromise;

  if (link.setters) {
    var evaluatePromise = doEvaluateDeclarative(loader, load, link, registry, state, [load]);
    if (evaluatePromise)
      return evaluatePromise;
  }
  else {
    doEvaluateDynamic(loader, load, link, registry, state, [load]);
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

        if (depLoad instanceof ModuleNamespace || depLoad[toStringTag] === 'module') {
          module = depLoad;
        }
        else {
          if (depLoad.evalError)
            throw depLoad.evalError;
          if (depLoad.module === undefined && seen.indexOf(depLoad) === -1 && !depLoad.linkRecord.evaluatePromise) {
            if (depLoad.linkRecord.setters) {
              doEvaluateDeclarative(loader, depLoad, depLoad.linkRecord, registry, state, [depLoad]);
            }
            else {
              seen.push(depLoad);
              doEvaluateDynamic(loader, depLoad, depLoad.linkRecord, registry, state, seen);
            }
          }
          module = depLoad.module || depLoad.linkRecord.moduleObj;
        }

        return '__useDefault' in module ? module.__useDefault : module;
      }
    }
    throw new Error('Module ' + name + ' not declared as a System.registerDynamic dependency of ' + key);
  };
}

function evalError (load, err) {
  load.linkRecord = undefined;
  var evalError = addToError(err, 'Evaluating ' + load.key);
  if (load.evalError === undefined)
    load.evalError = evalError;
  throw evalError;
}

// es modules evaluate dependencies first
// returns the error if any
function doEvaluateDeclarative (loader, load, link, registry, state, seen) {
  var depLoad, depLink;
  var depLoadPromises;
  for (var i = 0; i < link.dependencies.length; i++) {
    var depLoad = link.dependencyInstantiations[i];
    if (depLoad instanceof ModuleNamespace || depLoad[toStringTag] === 'module')
      continue;

    // custom Module returned from instantiate
    depLink = depLoad.linkRecord;
    if (depLink) {
      if (depLoad.evalError) {
        evalError(load, depLoad.evalError);
      }
      else if (depLink.setters) {
        if (seen.indexOf(depLoad) === -1) {
          seen.push(depLoad);
          try {
            var depLoadPromise = doEvaluateDeclarative(loader, depLoad, depLink, registry, state, seen);
          }
          catch (e) {
            evalError(load, e);
          }
          if (depLoadPromise) {
            depLoadPromises = depLoadPromises || [];
            depLoadPromises.push(depLoadPromise.catch(function (err) {
              evalError(load, err);
            }));
          }
        }
      }
      else {
        try {
          doEvaluateDynamic(loader, depLoad, depLink, registry, state, [depLoad]);
        }
        catch (e) {
          evalError(load, e);
        }
      }
    }
  }

  if (depLoadPromises)
    return link.evaluatePromise = Promise.all(depLoadPromises)
    .then(function () {
      if (link.execute) {
        // ES System.register execute
        // "this" is null in ES
        try {
          var execPromise = link.execute.call(nullContext);
        }
        catch (e) {
          evalError(load, e);
        }
        if (execPromise)
          return execPromise.catch(function (e) {
            evalError(load, e);
          })
          .then(function () {
            load.linkRecord = undefined;
            return registry[load.key] = load.module = new ModuleNamespace(link.moduleObj);
          });
      }
    
      // dispose link record
      load.linkRecord = undefined;
      registry[load.key] = load.module = new ModuleNamespace(link.moduleObj);
    });

  if (link.execute) {
    // ES System.register execute
    // "this" is null in ES
    try {
      var execPromise = link.execute.call(nullContext);
    }
    catch (e) {
      evalError(load, e);
    }
    if (execPromise)
      return link.evaluatePromise = execPromise.catch(function (e) {
        evalError(load, e);
      })
      .then(function () {
        load.linkRecord = undefined;
        return registry[load.key] = load.module = new ModuleNamespace(link.moduleObj);
      });
  }

  // dispose link record
  load.linkRecord = undefined;
  registry[load.key] = load.module = new ModuleNamespace(link.moduleObj);
}

// non es modules explicitly call moduleEvaluate through require
function doEvaluateDynamic (loader, load, link, registry, state, seen) {
  // System.registerDynamic execute
  // "this" is "exports" in CJS
  var module = { id: load.key };
  var moduleObj = link.moduleObj;
  Object.defineProperty(module, 'exports', {
    configurable: true,
    set: function (exports) {
      moduleObj.default = moduleObj.__useDefault = exports;
    },
    get: function () {
      return moduleObj.__useDefault;
    }
  });

  var require = makeDynamicRequire(loader, load.key, link.dependencies, link.dependencyInstantiations, registry, state, seen);

  // evaluate deps first
  if (!link.executingRequire)
    for (var i = 0; i < link.dependencies.length; i++)
      require(link.dependencies[i]);

  try {
    var output = link.execute.call(global, require, moduleObj.default, module);
    if (output !== undefined)
      module.exports = output;
  }
  catch (e) {
    evalError(load, e);
  }

  load.linkRecord = undefined;

  // pick up defineProperty calls to module.exports when we can
  if (module.exports !== moduleObj.__useDefault)
    moduleObj.default = moduleObj.__useDefault = module.exports;

  var moduleDefault = moduleObj.default;

  // __esModule flag extension support via lifting
  if (moduleDefault && moduleDefault.__esModule) {
    for (var p in moduleDefault) {
      if (Object.hasOwnProperty.call(moduleDefault, p))
        moduleObj[p] = moduleDefault[p];
    }
  }

  registry[load.key] = load.module = new ModuleNamespace(link.moduleObj);

  // run importer setters and clear them
  // this allows dynamic modules to update themselves into es modules
  // as soon as execution has completed
  if (load.importerSetters)
    for (var i = 0; i < load.importerSetters.length; i++)
      load.importerSetters[i](load.module);
  load.importerSetters = undefined;
}

// the closest we can get to call(undefined)
var nullContext = Object.create(null);
if (Object.freeze)
  Object.freeze(nullContext);
