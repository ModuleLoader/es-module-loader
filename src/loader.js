  // ---------- Loader ----------

  /*
   * Spec Differences
   * - Added ensureRegistered entry cache argument to avoid repeated lookups
   * - metadata sent through ensureRegistered and all requestHOOK calls
   * - Error entry checking and saving added to requestHOOK calls
   */

  // 3. Loader Objects

  // 3.1 Module Registry
  // States
  var FETCH = 0;
  var TRANSLATE = 1;
  var INSTANTIATE = 2;
  var LINK = 3;
  var READY = 4;

  // Loader class
  function Loader() {
    this._loader = {
      loaderObj: this,

      resolve: undefined,
      fetch: undefined,
      translate: undefined,
      instantiate: undefined,
      haveGraph: false,

      registry: {}
      // Realm not implemented
    };
  }

  // 4. Loading

  // 4.1.1
  function ensureRegistered(loader, key, metadata) {
    return loader.registry[key] || (loader.registry[key] = {
      key: key,
      state: FETCH,
      metadata: metadata || {},
      
      fetch: undefined,
      translate: undefined,
      instantiate: undefined,

      dependencies: undefined,
      module: undefined,

      // System register lifecycle
      declare: undefined,

      error: null
    });
  }

  // 4.1.2
  function resolveFetch(loader, entry, payload) {
    entry.fetch = entry.fetch || Promise.resolve(payload);
    entry.state = TRANSLATE;
  }

  // 4.1.3
  function resolveTranslate(loader, entry, source) {
    entry.translate = entry.translate || Promise.resolve(source);
    entry.state = INSTANTIATE;
  }

  // 4.1.4
  function resolveInstantiate(loader, entry, instance, source) {
    entry.instantiate = entry.instantiate || Promise.resolve(instance);
    return commitInstantiated(loader, entry, instance, source);
  }

  // 4.1.5
  function commitInstantiated(loader, entry, instance, source) {
    // 4.1.6 Instantiation
    // adjusted to use custom transpile hook
    // with the system register declare function

    // key spec adjustment:
    // adjusted to immediately requestInstantiate of dependencies
    // moved dependency resolve from link to here
    // returns a promise instead of synchronous
    // promise returns when instantiate promises of dependencies exist
    // this way the graph can be built up by chaining these promises
    if (instance === undefined) {
      var key = entry.key;
      var registration = loader.loaderObj.parse(key, source, entry.metadata);
      entry.declare = registration.declare;
      var dependencies = [];
      var depLoads = [];
      for (var i = 0, len = registration.deps.length; i < len; i++) (function(dep) {
        depLoads.push(Promise.resolve()
        .then(function() {
          return loader.resolve(dep, key, entry.metadata);
        })
        ['catch'](function(err) {
          throw addToError(err, 'Resolving ' + name + ', ' + key);
        })
        .then(function(depKey) {
          var depEntry = ensureRegistered(loader, depKey);
          dependencies.push(depEntry);

          if (depEntry.state === READY)
            return depEntry;

          // we run but dont rely on the promise to avoid circularity
          // this is what allows us to guarantee purely that the 
          // instantiate promises for all dependnecies will exist
          requestInstantiate(loader, depKey, null, depEntry);
        }));
      })(registration.deps[i]);
      return Promise.all(depLoads)
      .then(function() {
        entry.dependencies = dependencies;  
        entry.state = LINK;
        return entry;
      });
    }
    else {
      entry.dependencies = [];
      entry.module = instance;
      return entry;
    }
  }

  // 4.2.1
  function requestFetch(loader, key, metadata, entry) {
    entry = entry || ensureRegistered(loader, key, metadata);

    if (entry.error)
      return Promise.reject(entry.error);

    if (entry.state === READY)
      return Promise.reject(new Error(key + ' cannot be fetched as it is already linked.'));

    if (entry.fetch)
      return entry.fetch;

    return entry.fetch = Promise.resolve()
    .then(function() {
      return loader.fetch(key, entry.metadata);
    })
    ['catch'](function(err) {
      throw entry.error = addToError(err, 'Fetching ' + key);
    })
    .then(function(v) {
      entry.state = TRANSLATE;
      return v;
    });
  }

  // 4.2.2
  function requestTranslate(loader, key, metadata, entry) {
    entry = entry || ensureRegistered(loader, key, metadata);

    if (entry.error)
      return Promise.reject(entry.error);

    if (entry.state === READY)
      return Promise.reject(new Error(key + ' cannot initiate translate as it is already linked.'));

    if (entry.translate)
      return entry.translate;

    return entry.translate = requestFetch(loader, key, null, entry)
    .then(function(payload) {
      return Promise.resolve()
      .then(function() {
        return loader.translate(key, payload, entry.metadata);
      })
      ['catch'](function(err) {
        throw entry.error = addToError(err, 'Translating ' + key);
      });
    })
    .then(function(source) {
      entry.state = INSTANTIATE;
      return source;
    });
  }

  // 4.2.3
  function requestInstantiate(loader, key, metadata, entry) {
    entry = entry || ensureRegistered(loader, key, metadata);
    
    if (entry.error)
      return Promise.reject(entry.error);

    if (entry.state === READY)
      return Promise.reject(new Error(key + ' cannot instantiate as it is already linked.'));

    if (entry.instantiate)
      return entry.instantiate;

    return entry.instantiate = requestTranslate(loader, key, null, entry)
    .then(function(source) {
      return Promise.resolve()
      .then(function() {
        return loader.instantiate(key, source, entry.metadata);
      })
      ['catch'](function(err) {
        throw entry.error = addToError(err, 'Instantiating ' + key);
      })
      .then(function(instance) {
        return commitInstantiated(loader, entry, instance, source);
      });
    });
  }

  // 4.2.4
  function requestLink(loader, key, metadata, entry) {
    entry = entry || ensureRegistered(loader, key, metadata);

    if (entry.error)
      return Promise.reject(entry.error);

    if (entry.state === READY)
      return Promise.resolve(entry);

    return requestInstantiate(loader, key, null, entry)
    .then(function(entry) {
      // adjusted to use promise waiting until dependency graph is populated
      return dependencyGraph(entry);
    })
    .then(function(depGraph) {
      link(loader, entry, depGraph);
      // NB assert entry's whole graph is in ready state
      return entry;
    }, function(err) {
      entry.error = err;
      throw err;
    });
  }

  // 4.2.5
  function requestReady(loader, key, metadata, entry) {
    entry = entry || ensureRegistered(loader, key, metadata);

    return requestLink(loader, key, metadata, entry)
    .then(function(entry) {
      var module = entry.module;
      // dynamic already executed
      if (module instanceof Module)
        return module;

      // ModuleRecord needs System register execute
      var err = ensureModuleExecution(module, []);
      if (err) {
        err = addToError(err, 'Error evaluating ' + key);
        entry.error = err;
        throw err;
      }

      return module.module;
    }, function(err) {
      entry.error = err;
      throw err;
    });
  }

  // 5. Linking

  // 5.2.1
  function link(loader, root, depGraph) {
    // adjusted for graph already being computed in requestLink
    for (var i = 0, len = depGraph.length; i < len; i++) {
      var dep = depGraph[i];
      if (dep.state == LINK && typeof dep.module == 'function') {
        doDynamicLink(dep);
        // console.assert(dep.module instanceof Module)
        dep.state = READY;
      }
    }

    // adjusted linking implementation
    // to handle setter graph logic
    if (root.state == LINK)
      declareModule(root);
  }

  function doDynamicLink(dep) {
    // may have had a previous error
    if (dep.error)
      throw dep.error;

    try {
      dep.module = dep.module();
    }
    catch(e) {
      dep.error = e;
      throw e;
    }
  }

  // 5.2.2
  function dependencyGraph(root) {
    var result = [];
    return computeDependencyGraph(root, result)
    .then(function() {
      return result;
    })
    ['catch'](function(err) {
      // build up a tree stack error for better debugging
      throw addToError(err, 'Loading ' + root.key);
    });
  }

  // 5.2.3
  // spec adjustment. We make this a promise function
  // that can be run during link, waiting on dependency
  // downloads to complete before returning full graph
  // assumption is that instantiate promises exist
  function computeDependencyGraph(entry, result) {
    if (indexOf.call(result, entry) != -1)
      return;

    result.push(entry);

    var returnPromise = Promise.resolve();

    for (var i = 0, len = entry.dependencies.length; i < len; i++) (function(depEntry) {
      // ensure deterministic computation
      // dont need parallel anyway as we know that underlying promises are being
      // driven forward from elsewhere
      returnPromise = returnPromise.then(function() {
        return Promise.resolve(depEntry.instantiate)
        .then(function() {
          return computeDependencyGraph(depEntry, result);
        });
      });
    })(entry.dependencies[i]);

    return returnPromise;
  }

  // ES6-style module binding and execution code
  function declareModule(entry) {
    // could consider a try catch around setters here that saves errors to module.error
    var module = entry.module = ensureModuleRecord(entry.key);
    var moduleObj = module.module;

    // run the System register declare function
    // providing the binding export function argument
    // NB module meta should be an additional argument in future here
    var registryEntry = entry.declare.call(__global, function(name, value) {
      // export setter propogation with locking to avoid cycles
      module.locked = true;
      moduleObj[name] = value;

      for (var i = 0, len = module.importers.length; i < len; i++) {
        var importerModule = module.importers[i];
        if (!importerModule.locked) {
          var importerIndex = indexOf.call(importerModule.dependencies, module);
          importerModule.setters[importerIndex](moduleObj);
        }
      }

      module.locked = false;
      return value;
    });

    module.setters = registryEntry.setters;
    module.execute = registryEntry.execute;

    // now go through dependencies and declare them in turn, building up the binding graph as we go
    for (var i = 0, len = entry.dependencies.length; i < len; i++) {
      var depEntry = entry.dependencies[i];

      // if dependency not already declared, declare it now
      // we check module existence over state to stop at circular and dynamic
      if (!depEntry.module)
        declareModule(depEntry);

      var depModule = depEntry.module;

      // dynamic -> no setter propogation, but need dependencies and setters to line up
      if (depModule instanceof Module) {
        module.dependencies.push(null);
      }
      else {
        module.dependencies.push(depModule);
        depModule.importers.push(module);
      }

      // finally run this setter
      if (module.setters[i])
        module.setters[i](depModule.module);
    }

    entry.state = READY;
  }

  // execute a module record and all the modules that need it
  function ensureModuleExecution(module, seen) {
    if (indexOf.call(seen, module) != -1)
      return;

    if (module.error)
      return module.error;

    seen.push(module);

    var deps = module.dependencies;
    var err;

    for (var i = 0, len = deps.length; i < len; i++) {
      var dep = deps[i];

      // dynamic modules are null in the ModuleRecord graph
      if (!dep)
        continue;

      err = ensureModuleExecution(deps[i], seen);
      if (err) {
        module.error = addToError(err, 'Error evaluating ' + dep.key);
        return module.error;
      }
    }

    err = doExecute(module);
    
    if (err)
      module.error = err;

    return err;
  }

  function doExecute(module) {
    try {
      module.execute.call({});
    }
    catch(e) {
      return e;
    }
  }

  function addToError(err, msg) {
    var newErr;
    if (err instanceof Error) {
      var newErr = new err.constructor(err.message, err.fileName, err.lineNumber);
      newErr.message = err.message + '\n  ' + msg
      newErr.stack = err.stack;
    }
    else {
      newErr = err + '\n  ' + msg;
    }
      
    return newErr;
  }

  // 6. API

  // 6.1.1
  Loader.prototype['import'] = function(name, referrer) {
    var loader = this._loader;
    var metadata = {};
    return Promise.resolve()
    .then(function() {
      return loader.resolve(name, referrer, metadata);
    })
    ['catch'](function(err) {
      throw addToError(err, 'Resolving ' + name + (referrer ? ', ' + referrer : ''));
    })
    .then(function(key) {
      return requestReady(loader, key, metadata);
    });
  }

  // 6.2.1
  Loader.prototype.resolve = function(name, referrer, metadata) {
    var loader = this._loader;
    return loader.resolve(name, referrer, metadata || {});
  }

  // 6.3.1
  // For eg ready, <script type="module" src="${key}"></script>
  Loader.prototype.load = function(key, stage, metadata) {
    var loader = this._loader;
    
    if (stage == 'fetch')
      return requestFetch(loader, key, metadata);
    
    else if (stage == 'translate')
      return requestTranslate(loader, key, metadata);
    
    else if (stage == 'instantiate')
      return requestInstantiate(loader, key, metadata)
      .then(function(entry) {
        if (!(entry.module instanceof Module))
          return entry.module;
      });
    
    else if (stage == 'link')
      return requestLink(loader, key, metadata).then(function() {})
    
    else if (!stage || stage == 'ready')
      return requestReady(loader, key, metadata)
      .then(function(entry) {
        // this is ok because we use plain modules throughout
        return entry.module;
      });

    else
      throw new TypeError('Invalid stage ' + stage);
  }

  // 6.4.1
  // For eg fetch, <script type="module" src="${key}">${value}</script>
  Loader.prototype.provide = function(key, stage, value, metadata) {
    var loader = this._loader;

    var entry = ensureRegistered(loader, key, metadata);

    if (stage == 'fetch') {
      if (entry.state > FETCH)
        throw new TypeError(key + ' has already been fetched.');
      resolveFetch(loader, entry, value);
    }
    else if (stage == 'translate') {
      if (entry.state > TRANSLATE)
        throw new TypeError(key + ' has already been translated.');
      resolveTranslate(loader, entry, value);
    }
    else if (stage == 'instantiate') {
      if (entry.state > INSTANTIATE)
        throw new TypeError(key + ' has already been instantiated.');
      resolveFetch(loader, entry, undefined);
      resolveTranslate(loader, entry, undefined);
      // NB error propogation
      entry.translate.then(function(source) {
        resolveInstantiate(loader, entry, value, source);
      });
    }
    else
      throw new TypeError('Invalid stage ' + stage);
  }

  // 6.4.2
  // SPEC TODO
  Loader.prototype.error = function(key, stage, value) {}

  // 6.5.1
  Loader.prototype.lookup = function(key) {
    var loader = this._loader;

    var entry = loader.registry[key];
    if (!entry)
      return null;

    var state;
    if (entry.state == FETCH)
      state = 'fetch';
    else if (entry.state == TRANSLATE)
      state = 'translate';
    else if (entry.state == INSTANTIATE)
      state = 'instantiate';
    else if (entry.state == LINK)
      state = 'link';
    else if (entry.state == READY)
      state = 'ready';

    return {
      state: state,
      metadata: entry.metadata,
      fetch: entry.fetch && Promise.resolve(entry.fetch),
      translate: entry.translate && Promise.resolve(entry.translate),
      instantiate: entry.instantiate && Promise.resolve(entry.instantiate),
      module: entry.state == READY && (entry.module instanceof Module ? entry.module : entry.module.module),
      error: entry.error
    };
  }

  // 6.5.2
  Loader.prototype.install = function(key, module) {
    var loader = this._loader;

    if (loader.registry[key])
      throw new TypeError(key + ' is already defined in the Loader registry.');

    loader.registry[key] = {
      key: key,
      state: READY,
      metadata: metadata,

      fetch: undefined,
      translate: undefined,
      instantiate: undefined,

      dependencies: undefined,
      module: module,
      declare: undefined,
      error: null
    };
  }

  // 6.5.3
  Loader.prototype.uninstall = function(key) {
    var loader = this._loader;

    var entry = loader.registry[key];
    if (!entry)
      throw new TypeError(key + ' is not defined in the Loader registry.');

    if (entry.state < LINK)
      throw new TypeError(key + ' is still loading.');

    delete loader.registry[key];
  }

  // 6.5.4
  Loader.prototype.cancel = function(key) {
    var loader = this._loader;

    var entry = loader.registry[key];
    if (!entry)
      throw new TypeError(key + ' does not exist.');

    if (entry.state >= LINK)
      throw new TypeError(key + ' is already past linking.');

    delete loader.registry[key];
  }

  // 6.6.1
  // loader.hook('resolve') -> returns resolve hook
  // loader.hook('resolve', fn) -> sets resolve hook
  var hooks = ['resolve', 'fetch', 'translate', 'instantiate'];
  Loader.prototype.hook = function(name, value) {
    var loader = this._loader;
    if (indexOf.call(hooks, name) == -1)
      throw new TypeError(name + ' is not a valid hook.');
    if (value)
      loader[name] = value;
    else
      return loader[name];
  }

  // 6.7 Module Reflection

  // module record used for binding and evaluation management
  var moduleRecords = {};
  function ensureModuleRecord(key) {
    return moduleRecords[key] || (moduleRecords[key] = {
      key: key,
      dependencies: [],
      module: new Module({}),
      importers: [],
      locked: false,
      // these are specifically for runtime binding / execution errors
      error: null
    });
  }

  // plain user-facing module object
  function Module(descriptors, executor, evaluate) {
    // should define as unconfigurable and preventExtensions
    // going for max perf first iteration though
    for (var p in descriptors)
      this[p] = descriptors[p];
  }

