// ---------- Loader ----------
  /*
   * Spec Differences
   * - Added ensureRegistered entry cache argument to avoid repeated lookups
   * - metadata sent through ensureRegistered and all requestHOOK calls
   * - Error entry checking and saving added to requestHOOK calls
   */

  // 3. Loader Objects

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

  // States
  var FETCH = 0;
  var TRANSLATE = 1;
  var INSTANTIATE = 2;
  var INSTANTIATE_ALL = 3;
  var LINK = 4;
  var READY = 5;

  // 3.3.2
  Loader.prototype['import'] = function(name, referrer) {
    var loader = this._loader;
    var metadata = {};
    return Promise.resolve()
    .then(function() {
      return loader.resolve.call(loader.loaderObj, name, referrer, metadata);
    })
    ['catch'](function(err) {
      throw addToError(err, 'Resolving ' + name + (referrer ? ', ' + referrer : ''));
    })
    .then(function(key) {
      return requestReady(loader, key, metadata);
    });
  };

  // 3.3.3
  Loader.prototype.resolve = function(name, referrer, metadata) {
    var loader = this._loader;
    return loader.resolve.call(loader.loaderObj, name, referrer, metadata || {});
  };

  // 3.3.4
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
  };

  // No longer in spec
  // For eg fetch, <script type="module">${value}</script>, key = anon
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
        loadTranspilerThenFulfillInstantiate(loader, entry, value, source);
      });
    }
    else
      throw new TypeError('Invalid stage ' + stage);
  };

  // TODO: the Loader no longer has the hook property
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
  };

  // 4. Registry Objects

  // 4.1.1
  function getCurrentStage(entry) {
    if (typeof entry !== 'object')
      throw new TypeError('entry is not an object');
    return entry.pipeline[0];
  }

  // 4.1.4
  function getRegistryEntry(registry, key) {
    if (typeof registry !== 'object')
      throw new TypeError('registry is not an object');

    var entry = registry._registry.registryData[key];
    if (!entry)
      return null;

    var currentStage = getCurrentStage(entry);
    var result = new Promise(function(resolve) {
      resolve(currentStage.result);
    });

    return {
      stage: currentStage.stage,
      result: result,
      module: currentStage.stage == 'ready' ? entry.module : undefined,
      error: entry.error ? { value: entry.error } : null
    };
  }

  // 4.2.1
  // For now, registry objects are a work in progress that don't fully integrate into the rest of the code base
  function Registry(loader) {
    if (!this.constructor)
      throw new TypeError('The Registry constructor must be called with "new"');
    if (typeof loader !== 'object')
      throw new TypeError('The Registry constructor must be called with a loader object');
    this._registry = {
      registryData: [],
      loader: loader
    };
    // 4.4.2
    if (__global.Symbol && __global.Symbol.iterator) {
      var instance = this;
      this[__global.Symbol.iterator] = function() {
        var registryEntryIndex = 0;
        return {
          next: function() {
            if (registryEntryIndex < instance._registry.registryData.length - 1) {
              return {
                value: instance._registry.registryData[registryEntryIndex++],
                done: false
              };
            }
            else {
              return {
                value: undefined,
                done: true
              };
            }
          }
        };
      };
    }
  }

  // 4.4.3
  Registry.prototype.lookup = function(key) {
    return getRegistryEntry(this, key);
  };

  // 4.4.4
  Registry.prototype.install = function(key, module) {
    if (typeof this !== 'object')
      throw new TypeError('registry must be an object');
    if (this._registry.registryData[key])
      throw new TypeError('Module with key ' + key + ' already exists');

    var result = new Promise(function(resolve) {
      resolve(module);
    });
    this._registry.registryData[key] = {
      key: key,
      pipeline: [{
        stage: 'ready',
        result: result
      }],
      metadata: undefined,
      dependencies: undefined,
      module: module
    };
  }

  // 4.4.5
  Registry.prototype.uninstall = function(key) {
    if (typeof this !== 'object')
      throw new TypeError('registry must be an object');
    var entry = this._registry.registryData[key];
    if (!entry)
      throw new TypeError('Module with key ' + key + 'does not exist');
    var stageEntry = getCurrentStage(entry);
    if (stageEntry.stage !== 'link' && stageEntry.stage !== 'ready')
      throw new TypeError('Module is still loading');
    delete this._registry.registryData[key];
  }

  // 4.4.6
  Registry.prototype.cancel = function(key) {
    if (typeof this !== 'object')
      throw new TypeError('registry must be an object');
    var entry = this._registry.registryData[key];
    if (!entry)
      throw new TypeError('Module with key ' + key + ' does not exist');
    var stageEntry = getCurrentStage(entry);
    if (stageEntry.stage === 'link' || stageEntry.stage === 'ready')
      throw new TypeError('Module with key ' + key + ' is already done linking');
    delete this._registry.registryData[key];
  }

  // 5. Loading

  // 5.1.1
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

  // 5.1.2 inlined

  // 5.1.3
  function fulfillFetch(loader, entry, payload) {
    if (entry.fetchResolve)
      entry.fetchResolve(payload);
    else
      entry.fetch = Promise.resolve(payload);
      
    entry.fetchResolve = undefined;
    entry.state = Math.max(entry.state, TRANSLATE);
  }

  // 5.1.4
  function fulfillTranslate(loader, entry, source) {
    if (entry.translateResolve)
      entry.translateResolve(source);
    else
      entry.translate = Promise.resolve(source);
      
    entry.translateResolve = undefined;
    entry.state = Math.max(entry.state, INSTANTIATE);
  }

  // 5.1.5
  function fulfillInstantiate(loader, entry, instance, source) {
    // 5.1.6 CommitInstantiated inlined

    // 5.1.7 Instantiation inlined
      if (instance === undefined)
        // defined in transpiler.js
        var registration = transpile(loader.loaderObj, entry.key, source, entry.metadata);
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

  // adjusted asynchronous declarative instantiate fulfillment
  // to load transpiler
  function loadTranspilerThenFulfillInstantiate(loader, entry, instance, source) {
    return Promise.resolve(instance === undefined && loadTranspiler(loader.loaderObj)).then(function() {
      fulfillInstantiate(loader, entry, instance, source);
    });
  }

  // 5.2.1
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
      return loader.fetch.call(loader.loaderObj, key, entry.metadata);
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

  // 5.2.2
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
        return loader.translate.call(loader.loaderObj, key, payload, entry.metadata);
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

  // 5.2.3
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
        return loader.instantiate.call(loader.loaderObj, key, source, entry.metadata);
      })
      .then(function(instance) {
        return loadTranspilerThenFulfillInstantiate(loader, entry, instance, source);
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

  // 5.2.4
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
        depLoads.push(Promise.resolve(loader.resolve.call(loader.loaderObj, pair.key, key, depMeta))
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

  // 5.2.5
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
          // defined in declare.js
          declareModule(entry);

      // [assert entry's whole graph is in ready state]
      return entry;
    })
    ['catch'](function(err) {
      entry.error = err;
      throw err;
    });
  }

  // 5.2.6
  function requestReady(loader, key, metadata, entry) {
    entry = entry || ensureRegistered(loader, key, metadata);

    return requestLink(loader, key, metadata, entry)
    .then(function(entry) {
      var module = entry.module;
      // dynamic already executed
      if (module instanceof Module)
        return module;

      // ModuleRecord needs System register execute
      // defined in declarative.js
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

  // 6. Linking

  // 6.2.1 inlined in 5.2.5
  // 6.2.2 inlined in 5.2.5

  // 6.2.3
  function computeDependencyGraph(entry, result) {
    if (indexOf.call(result, entry) != -1)
      return;

    result.push(entry);
    for (var i = 0; i < entry.dependencies.length; i++)
      computeDependencyGraph(entry.dependencies[i].value, result);
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


  // 7. Module Objects

  // 7.3 Module Reflection

  // plain user-facing module object
  function Module(descriptors, executor, evaluate) {
    // should define as unconfigurable and preventExtensions
    // going for max perf first iteration though
    for (var p in descriptors)
      this[p] = descriptors[p];
  }
