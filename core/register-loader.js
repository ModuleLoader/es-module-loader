import { Loader, Module, InternalModuleNamespace as ModuleNamespace } from './loader-polyfill.js';
import { resolveUrlToParentIfNotPlain } from './resolve.js';
import { addToError, global } from './common.js';

export default RegisterLoader;

export var emptyModule = new ModuleNamespace({});

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
function RegisterLoader(baseKey) {
  Loader.apply(this, arguments);

  // System.register registration cache
  this._registerCache = {};

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

// these are implementation specific
RegisterLoader.prototype.normalize = function(key, parentKey, metadata) {
  return key;
};

RegisterLoader.prototype.instantiate = function(key, metadata) {};

// this function is an optimization to allow loader extensions to 
// implement it to set the metadata object shape upfront to ensure
// it can run as a single hidden class throughout the normalize
// and instantiate pipeline hooks in the js engine
RegisterLoader.prototype.createMetadata = function() {
  return {};
};

var RESOLVE = Loader.resolve;

RegisterLoader.prototype[RESOLVE] = function(key, parentKey) {
  var loader = this;

  var resolved = resolveUrlToParentIfNotPlain(key, parentKey);

  // normalization shortpath if already in the registry or loading
  if (resolved && (loader.registry.has(resolved) || loader._registerRegistry[resolved]))
    return Promise.resolve(resolved);

  var metadata = this.createMetadata();
  return Promise.resolve(loader.normalize(resolved || key, parentKey, metadata))
  .then(function(resolvedKey) {
    // we create the in-progress load record already here to store the normalization metadata
    if (!loader.registry.has(resolvedKey))
      getOrCreateLoadRecord(loader, resolvedKey).metadata = metadata;
    return resolvedKey;
  });
};

// provides instantiate promise cache
// we need to first wait on instantiate which will tell us if it is ES or not
// this record represents that waiting period, and when set, we then populate
// the esLinkRecord record into this load record.
// instantiate is a promise for a module namespace or undefined
function getOrCreateLoadRecord(loader, key) {
  return loader._registerRegistry[key] || (loader._registerRegistry[key] = {
    key: key,
    metadata: undefined,

    instantiatePromise: undefined,

    module: undefined,

    // es-specific
    esLinkRecord: undefined,
    importerSetters: undefined
  });
}

RegisterLoader.prototype[Loader.instantiate] = function(key) {
  var loader = this;
  return instantiate(this, key)
  .then(function(instantiated) {
    if (instantiated instanceof ModuleNamespace)
      return Promise.resolve(instantiated);

    return instantiateAllDeps(loader, instantiated, [])
    .then(function() {
      if (loader.execute)
        var err = ensureEvaluated(loader, instantiated, []);
      if (err)
        return Promise.reject(err);

      if (loader.trace)
        traceLoadRecord(loader, instantiated, []);
      return instantiated.module || emptyModule;
    })
    .catch(function(err) {
      clearLoadErrors(loader, instantiated);
      throw err;
    });
  })
};

// instantiates the given module name
// returns the load record for es or the namespace object for dynamic
// setting the dynamic namespace into the registry
function instantiate(loader, key) {
  var load = loader._registerRegistry[key];

  // this is impossible assuming resolve always runs before instantiate
  if (!load)
    throw new TypeError('Internal error, load record not created');

  return load.instantiatePromise || (load.instantiatePromise = Promise.resolve(loader.instantiate(key, load.metadata))
  .then(function(instantiation) {
    // dynamic module
    if (instantiation !== undefined) {
      loader.registry.set(key, instantiation);
      loader._registerRegistry[key] = undefined;
      return instantiation;
    }

    // run the cached loader.register declaration if there is one
    ensureRegisterLinkRecord.call(loader, load);

    // metadata no longer needed
    if (!loader.trace)
      load.metadata = undefined;

    return load;
  })
  .catch(function(err) {
    err = addToError(err, 'Instantiating ' + load.key);

    // immediately clear the load record for an instantiation error
    if (loader._registerRegistry[load.key] === load)
      loader._registerRegistry[load.key] = undefined;

    throw err;
  }));
}

// this only applies to load records with load.esLinkRecord set
function instantiateAllDeps(loader, load, seen) {
  // skip if already linked
  if (load.module)
    return Promise.resolve();

  var esLinkRecord = load.esLinkRecord;

  // no dependencies shortpath
  if (!esLinkRecord.dependencies.length)
    return Promise.resolve();

  // assumes seen does not contain load already
  seen.push(load);

  var instantiateDepsPromises = Array(esLinkRecord.dependencies.length);

  // normalize dependencies
  for (var i = 0; i < esLinkRecord.dependencies.length; i++) (function(i) {
    // this resolve can potentially be cached on the link record, should be a measured optimization
    instantiateDepsPromises[i] = loader[RESOLVE](esLinkRecord.dependencies[i], load.key)
    .catch(function(err) {
      throw addToError(err, 'Resolving ' + esLinkRecord.dependencies[i] + ' to ' + load.key);
    })
    .then(function(resolvedDepKey) {
      var existingNamespace = loader.registry.get(resolvedDepKey);
      if (existingNamespace) {
        esLinkRecord.dependencyInstantiations[i] = existingNamespace;
        // run setter to reference the module
        if (esLinkRecord.setters[i])
          esLinkRecord.setters[i](existingNamespace);
        return Promise.resolve();
      }

      if (loader.trace) {
        esLinkRecord.depMap = esLinkRecord.depMap || {};
        esLinkRecord.depMap[esLinkRecord.dependencies[i]] = resolvedDepKey;
      }

      return instantiate(loader, resolvedDepKey)
      .then(function(instantiation) {
        // instantiation is either a load record or a module namespace
        esLinkRecord.dependencyInstantiations[i] = instantiation;

        // dynamic module
        if (instantiation instanceof ModuleNamespace) {
          if (esLinkRecord.setters[i])
            esLinkRecord.setters[i](instantiation);
          return Promise.resolve();
        }

        // register setter with dependency
        instantiation.importerSetters.push(esLinkRecord.setters[i]);

        // run setter now to pick up the first bindings from the dependency
        if (esLinkRecord.setters[i])
          esLinkRecord.setters[i](instantiation.esLinkRecord.moduleObj);

        // circular
        if (seen.indexOf(instantiation) !== -1)
          return Promise.resolve();

        // es module load

        // if not already linked, instantiate dependencies
        if (instantiation.esLinkRecord)
          return instantiateAllDeps(loader, instantiation, seen);
      });
    })
  })(i);

  return Promise.all(instantiateDepsPromises)
  .catch(function(err) {
    err = addToError(err, 'Loading ' + load.key);

    // throw up the instantiateAllDeps stack
    // loads are then synchonously cleared at the top-level through the helper below
    // this then ensures avoiding partially unloaded tree states
    esLinkRecord.error = err;

    throw err;
  });
}

// clears an errored load and all its errored dependencies from the loads registry
function clearLoadErrors(loader, load) {
  // clear from loads
  if (loader._registerRegistry[load.key] === load)
    loader._registerRegistry[load.key] = undefined;

  var esLinkRecord = load.esLinkRecord;

  if (!esLinkRecord)
    return;

  esLinkRecord.dependencyInstantiations.forEach(function(depLoad, index) {
    if (!depLoad || depLoad instanceof ModuleNamespace)
      return;

    if (depLoad.esLinkRecord && depLoad.esLinkRecord.error) {
      // unregister setters for es dependency load records
      var setterIndex = depLoad.importerSetters.indexOf(esLinkRecord.setters[index]);
      depLoad.importerSetters.splice(setterIndex, 1);

      // provides a circular reference check
      if (loader._registerRegistry[depLoad.key] === depLoad)
        clearLoadErrors(loader, depLoad);
    }
  });
}

function createESLinkRecord(dependencies, setters, module, moduleObj, execute) {
  return {
    dependencies: dependencies,

    error: undefined,

    // will be the dependency ES load record, or a module namespace
    dependencyInstantiations: Array(dependencies.length),

    setters: setters,

    module: module,
    moduleObj: moduleObj,
    execute: execute
  };
}

/*
 * System.register
 * Places the status into the registry and a load into the loads list
 */
RegisterLoader.prototype.register = function(key, deps, declare) {
  // anonymous modules get stored as lastAnon
  if (declare === undefined)
    this._registeredLastAnon = [key, deps];

  // everything else registers into the register cache
  else
    this._registerCache[key] = [deps, declare];
};

RegisterLoader.prototype.processRegisterContext = function(contextKey) {
  if (!this._registeredLastAnon)
    return;

  this._registerCache[contextKey] = this._registeredLastAnon;
  this._registeredLastAnon = undefined;
};

function ensureRegisterLinkRecord(load) {
  // ensure we already have a link record
  if (load.esLinkRecord)
    return;

  var key = load.key;

  var registrationPair = this._registerCache[key];

  if (!registrationPair)
    throw new TypeError('Module instantiation did not call an anonymous or correctly named System.register');

  this._registerCache[key] = undefined;

  var importerSetters = [];

  var moduleObj = {};

  var locked = false;

  var declared = registrationPair[1].call(global, function(name, value) {
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

    if (importerSetters.length) {
      locked = true;
      for (var i = 0; i < importerSetters.length; i++)
        // this object should be a defined module object
        // but in order to do that we need the exports returned by declare
        // for now we assume no exports in the implementation
        importerSetters[i](moduleObj);

      locked = false;
    }
    return value;
  }, new ContextualLoader(this, key));

  var setters, execute;

  if (typeof declared !== 'function') {
    setters = declared.setters;
    execute = declared.execute;
  }
  else {
    setters = [],
    execute = declared;
  }

  // TODO, pass module when we can create it here already via exports
  load.importerSetters = importerSetters;
  load.esLinkRecord = createESLinkRecord(registrationPair[0], setters, undefined, moduleObj, execute);
}

// ContextualLoader class
// backwards-compatible with previous System.register context argument by exposing .id
function ContextualLoader(loader, key) {
  this.loader = loader;
  this.key = this.id = key;
}
ContextualLoader.prototype.constructor = function() {
  throw new TypeError('Cannot subclass the contextual loader only Reflect.Loader.');
};
ContextualLoader.prototype.import = function(key) {
  return this.loader.import(key, this.key)
};
ContextualLoader.prototype.resolve = function(key) {
  return this.loader[Loader.resolve](key, this.key);
};
ContextualLoader.prototype.load = function(key) {
  return this.loader.load(key, this.key);
};

// ensures the given es load is evaluated
// returns the error if any
function ensureEvaluated(loader, load, seen) {
  var esLinkRecord = load.esLinkRecord;
  
  // no esLinkRecord means evaluated
  if (!esLinkRecord)
    return;

  // assumes seen does not contain load already
  seen.push(load);

  var err, depLoad;

  for (var i = 0; i < esLinkRecord.dependencies.length; i++) {
    depLoad = esLinkRecord.dependencyInstantiations[i];

    // non ES load

    // it is the responsibility of the executor to remove the module from the registry on failure
    if (depLoad instanceof ModuleNamespace)
      err = namespaceEvaluate(depLoad);

    // ES load
    else if (seen.indexOf(depLoad) === -1)
      err = ensureEvaluated(loader, depLoad, seen);

    if (err)
      return addToError(err, 'Evaluating ' + load.key);
  }

  // es load record evaluation
  err = esEvaluate(esLinkRecord);
  
  if (err) {
    loader.registry.delete(load.key);
    if (loader._registerRegistry[load.key] === load)
      loader._registerRegistry[load.key] = undefined;
    return addToError(err, 'Evaluating ' + load.key);
  }

  load.module = new ModuleNamespace(esLinkRecord.moduleObj);
  loader.registry.set(load.key, load.module);
  
  // can clear link record now
  if (!loader.trace)
    load.esLinkRecord = undefined;
}

function esEvaluate(esLinkRecord) {
  try {
    // {} is the closest we can get to call(undefined)
    // this should really be blocked earlier though
    esLinkRecord.execute.call({});
  }
  catch(err) {
    return err;
  }
}
function namespaceEvaluate(namespace) {
  try {
    Module.evaluate(namespace);
  }
  catch(err) {
    return err;
  }
}

function traceLoadRecord(loader, load, seen) {
  // its up to dynamic instantiate layers to ensure their own traces are present
  if (load instanceof ModuleNamespace)
    return;

  seen.push(load);

  if (!load.esLinkRecord || load.esLinkRecord.dependencies.length && !load.esLinkRecord.depMap)
    throw new Error('Tracing error, ensure loader.trace is set before loading begins');

  loader.loads[load.key] = {
    key: load.key,
    dependencies: load.esLinkRecord.dependencies,
    depMap: load.esLinkRecord.depMap || {},
    metadata: load.metadata
  };

  load.esLinkRecord.dependencies.forEach(function(dep) {
    if (seen.indexOf(dep) === -1)
      traceLoadRecord(loader, dep, seen);
  });
}