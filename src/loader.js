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
  var INSTANTIATE_ALL = 3;
  var LINK = 4;
  var READY = 5;

  // Loader class
  function Loader() {
    this._loader = {
      loaderObj: this,

      resolve: undefined,
      fetch: undefined,
      translate: undefined,
      instantiate: undefined,

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

      fetchResolve: undefined,
      translateResolve: undefined,
      instantiateResolve: undefined,

      dependencies: undefined,
      module: undefined,

      // System register lifecycle
      declare: undefined,

      error: null
    });
  }

  // 4.1.2 inlined

  // 4.1.3
  function fulfillFetch(loader, entry, payload) {
    if (entry.fetchResolve)
      entry.fetchResolve(payload);
    else
      entry.fetch = Promise.resolve(payload);
      
    entry.fetchResolve = undefined;
    entry.state = Math.max(entry.state, TRANSLATE);
  }

  // 4.1.4
  function fulfillTranslate(loader, entry, source) {
    if (entry.translateResolve)
      entry.translateResolve(source);
    else
      entry.translate = Promise.resolve(source);
      
    entry.translateResolve = undefined;
    entry.state = Math.max(entry.state, INSTANTIATE);
  }

  // 4.1.5
  function fulfillInstantiate(loader, entry, instance, source) {
    // 4.1.6 CommitInstantiated inlined

    // 4.1.7 Instantiation inlined
      if (instance === undefined)
        var registration = transpile.call(loader.loaderObj, entry.key, source, entry.metadata);
      else if (typeof instance !== 'function')
        throw new TypeError('Instantiate must return an execution function.');

    // we should really resolve instantiate with a Source Text Module Record
    // but we don't have that thing here
    // it's not used through the instantiate promise though, so it's ok
    if (entry.instantiateResolve)
      entry.instantiateResolve(instance);
    else
      entry.instantiate = Promise.resolve(instance);
    
    entry.instantiateResolve = undefined;

    var deps = [];

    if (instance === undefined) {
      // adjusted to use custom transpile hook
      // with the system register declare function
      entry.declare = registration.declare;
      
      for (var i = 0; i < registration.deps.length; i++)
        deps.push({ key: registration.deps[i], value: undefined });
    }

    entry.dependencies = deps;
    entry.module = instance;
    entry.state = Math.max(entry.state, INSTANTIATE_ALL);
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

    Promise.resolve()
    .then(function() {
      return loader.fetch(key, entry.metadata);
    })
    .then(function(payload) {
      // in turn calls fetchResolve
      fulfillFetch(loader, entry, payload);
    }, function(err) {
      throw addToError(err, 'Fetching ' + key);
    })
    ['catch'](function(err) {
      entry.error = entry.error || err;
    })
    .then(function() {
      if (entry.error && entry.fetchResolve)
        entry.fetchResolve(Promise.reject(entry.error));
    });

    return entry.fetch = new Promise(function(resolve) {
      entry.fetchResolve = resolve; 
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

    requestFetch(loader, key, null, entry)
    .then(function(payload) {
      return Promise.resolve()
      .then(function() {
        return loader.translate(key, payload, entry.metadata);
      })
      .then(function(source) {
        // in turn calls translateResolve
        fulfillTranslate(loader, entry, source);
      }, function(err) {
        throw addToError(err, 'Translating ' + key);
      });
    })
    ['catch'](function(err) {
      entry.error = entry.error || err;
    })
    .then(function() {
      if (entry.error && entry.translateResolve)
        entry.translateResolve(Promise.reject(entry.error));
    });

    return entry.translate = new Promise(function(resolve) {
      entry.translateResolve = resolve;
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

    requestTranslate(loader, key, null, entry)
    .then(function(source) {
      return Promise.resolve()
      .then(function() {
        return loader.instantiate(key, source, entry.metadata);
      })
      .then(function(instance) {
        fulfillInstantiate(loader, entry, instance, source);
      }, function(err) {
        throw addToError(err, 'Instantiating ' + key);
      });
    })
    ['catch'](function(err) {
      entry.error = entry.error || err;
    })
    .then(function() {
      if (entry.error && entry.instantiateResolve)
        entry.instantiateResolve(Promise.reject(entry.error));
    });

    return entry.instantiate = new Promise(function(resolve) {
      entry.instantiateResolve = resolve;
    });
  }

  // 4.2.4
  function requestInstantiateAll(loader, key, metadata, entry) {
    entry = entry || ensureRegistered(loader, key, metadata);

    if (entry.state > INSTANTIATE_ALL)
      return entry;

    return requestInstantiate(loader, key, null, entry)
    .then(function() {
      entry.state = Math.max(entry.state, LINK);

      var depLoads = [];
      for (var i = 0; i < entry.dependencies.length; i++) (function(pair) {
        // create dep meta object now, passed through into ensureRegister shortly
        var depMeta = {};
        depLoads.push(Promise.resolve(loader.resolve(pair.key, key, depMeta))
        .then(function(depKey) {
          var depEntry = ensureRegistered(loader, depKey, depMeta);

          pair.value = depEntry;

          return requestInstantiateAll(loader, depKey, null, depEntry);
        }));
      })(entry.dependencies[i]);
      return Promise.all(depLoads)
      ['catch'](function(err) {
        err = addToError(err, 'Loading ' + key);
        entry.error = entry.error || err;
        throw err;
      });
    });
  }

  // 4.2.5
  function requestLink(loader, key, metadata, entry) {
    entry = entry || ensureRegistered(loader, key, metadata);

    if (entry.error)
      return Promise.reject(entry.error);

    if (entry.state === READY)
      return Promise.resolve(entry);

    return requestInstantiateAll(loader, key, metadata, entry)
    .then(function() {
      // 5.2.1 Link inlined to reduce stack size
      
        // 5.2.2 dependencyGraph inlined
          var deps = [];
          computeDependencyGraph(entry, deps);

        // dynamic link
        for (var i = 0; i < deps.length; i++) {
          var dep = deps[i];
          if (dep.state == LINK && typeof dep.module == 'function') {
            doDynamicLink(dep);
            // console.assert(dep.module instanceof Module)
            dep.state = READY;
          }
        }

        // declarative link
        // adjusted linking implementation
        // to handle setter graph logic
        if (entry.state == LINK)
          declareModule(entry);

      // [assert entry's whole graph is in ready state]
      return entry;
    })
    ['catch'](function(err) {
      entry.error = err;
      throw err;
    });
  }

  // 4.2.6
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
      entry.error = entry.error || err;
      throw err;
    });
  }

  // 5. Linking

  // 5.2.1 inlined in 4.2.5
  // 5.2.2 inlined in 4.2.5

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
      return requestInstantiateAll(loader, key, metadata)
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
      fulfillFetch(loader, entry, value);
    }
    else if (stage == 'translate') {
      if (entry.state > TRANSLATE)
        throw new TypeError(key + ' has already been translated.');
      fulfillTranslate(loader, entry, value);
    }
    else if (stage == 'instantiate') {
      if (entry.state > INSTANTIATE)
        throw new TypeError(key + ' has already been instantiated.');
      fulfillFetch(loader, entry, undefined);
      fulfillTranslate(loader, entry, undefined);
      // NB error propogation
      entry.translate.then(function(source) {
        fulfillInstantiate(loader, entry, value, source);
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

  // plain user-facing module object
  function Module(descriptors, executor, evaluate) {
    // should define as unconfigurable and preventExtensions
    // going for max perf first iteration though
    for (var p in descriptors)
      this[p] = descriptors[p];
  }

