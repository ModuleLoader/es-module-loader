// ---------- Loader ----------
/**
  * Spec Differences
  * - Realm not implemented
  * - Out of date; sections 3 & 4 are implemented though need checking
  * - uses newRegistry instead of Registry (this can probably be changed, as I
  *   suspect that the existing Registry code will work with ES6 Map and Symbol.iterator)
  * - 3.3.6 toStringTag not implemented
  * - Other sections need implementing/(re)writing

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

      registry: {},
      newRegistry: new Registry(), //this is temporary until Registry is ready to be used
      // Realm not implemented
    };
  }

  // States - TODO out of date; better as a 'states' object?
  // 5
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
      return requestLink(loader, key, metadata).then(function() {});
    
    else if (!stage || stage == 'ready')
      return requestReady(loader, key, metadata)
      .then(function(entry) {
        // this is ok because we use plain modules throughout
        return entry.module;
      });

    // @ifdef STRICT
    else
      throw new TypeError('Invalid stage ' + stage);
    // @endif
  };

  // 3.3.5
  Object.defineProperty(Loader.prototype, 'registry', {
      get: function() {
        // @ifdef STRICT
        if (typeof this !== 'object')
            throw new TypeError('this must be a Loader');
        // uncomment when Realm is implemented
        // if (!this._loader.realm)
        //     throw new TypeError('A Loader must have a realm');

        if (!(this._loader.newRegistry instanceof Registry))
            throw new TypeError('invalid registry -- must be created during Loader constructor');
        // @endif
        return this._loader.newRegistry;
      }
  });

  // 4. Registry Objects
  // For now, registry objects are a work in progress that don't fully integrate into the rest of the code base

  // 4.1.1 inlined in 4.2

  // 4.2 - see https://github.com/ModuleLoader/es6-module-loader/pull/462#discussion-diff-50639828 for why it deviates from spec
  function Registry() {
    this.registryMap = new __global.Map();
    // 4.4.2
  }

  // 4.3.1 -- not necessary because of https://github.com/ModuleLoader/es6-module-loader/pull/462#discussion-diff-50639828

  // 4.4 - not necessary because of https://github.com/ModuleLoader/es6-module-loader/pull/462#discussion-diff-50639828

  // 4.4.1
  Registry.prototype.constructor = Registry;

  // 4.4.2 is inlined in 4.2

  // 4.4.3
  Registry.prototype.entries = function() {
    // @ifdef STRICT
    if (typeof this !== 'object')
      throw new TypeError('cannot get entries of a non-registry');
    // @endif
    return this.registryMap.entries();
  };

  // 4.4.4
  Registry.prototype.keys = function() {
    // @ifdef STRICT
    if (typeof this !== 'object')
      throw new TypeError('invalid registry');
    // @endif
    return this.registryMap.keys();
  };

  // 4.4.5
  Registry.prototype.values = function() {
    // @ifdef STRICT
    if (typeof this !== 'object')
      throw new TypeError('invalid registry');
    // @endif
    return this.registryMap.values();
  };

  // 4.4.6
  Registry.prototype.get = function(key) {
    // @ifdef STRICT
    if (typeof this !== 'object')
      throw new TypeError('invalid registry');
    // @endif
    return this.registryMap.get(key);
  };

  // 4.4.7
  Registry.prototype.set = function(key, value) {
    // @ifdef STRICT
    if (typeof this !== 'object')
      throw new TypeError('invalid registry');
    // @endif
    this.registryMap.set(key, value);
    return this;
  };

  // 4.4.8
  Registry.prototype.has = function(key) {
    // @ifdef STRICT
    if (typeof this !== 'object')
      throw new TypeError('invalid registry');
    // @endif
    return this.registryMap.has(key);
  };

  // 4.4.9
  Registry.prototype.delete = function(key) {
    // @ifdef STRICT
    if (typeof this !== 'object')
      throw new TypeError('invalid registry');
    // @endif
    return this.registryMap.delete(key);
  };


  // 5. ModuleStatus Objects - TODO

  // 5.1.1 - TODO out of date
  function getCurrentStage(entry) {
    // @ifdef STRICT
    if (typeof entry !== 'object')
      throw new TypeError('entry is not an object');
    // @endif
    return entry.pipeline[0];
  }

  // 6. Loading - TODO out of date

  // 6.1.1 - TODO out of date
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

  // TODO - review this
  // function fulfillInstantiate(loader, entry, instance, source) {
  //   // 5.1.6 CommitInstantiated inlined

  //   // 5.1.7 Instantiation inlined
  //     if (instance === undefined)
  //       // defined in transpiler.js
  //       var registration = transpile(loader.loaderObj, entry.key, source, entry.metadata);
  //     else if (typeof instance !== 'function')
  //       throw new TypeError('Instantiate must return an execution function.');

  //   // we should really resolve instantiate with a Source Text Module Record
  //   // but we don't have that thing here
  //   // it's not used through the instantiate promise though, so it's ok
  //   if (entry.instantiateResolve)
  //     entry.instantiateResolve(instance);
  //   else
  //     entry.instantiate = Promise.resolve(instance);
    
  //   entry.instantiateResolve = undefined;

  //   var deps = [];

  //   if (instance === undefined) {
  //     // adjusted to use custom transpile hook
  //     // with the system register declare function
  //     entry.declare = registration.declare;
      
  //     for (var i = 0; i < registration.deps.length; i++)
  //       deps.push({ key: registration.deps[i], value: undefined });
  //   }

  //   entry.dependencies = deps;
  //   entry.module = instance;
  //   entry.state = Math.max(entry.state, INSTANTIATE_ALL);
  // }

  // // adjusted asynchronous declarative instantiate fulfillment
  // // to load transpiler
  // function loadTranspilerThenFulfillInstantiate(loader, entry, instance, source) {
  //   return Promise.resolve(instance === undefined && loadTranspiler(loader.loaderObj)).then(function() {
  //     fulfillInstantiate(loader, entry, instance, source);
  //   });
  // }

  // 6.2.1 - TODO out of date
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

  function fulfillFetch(loader, entry, payload) {
    if (entry.fetchResolve)
      entry.fetchResolve(payload);
    else
      entry.fetch = Promise.resolve(payload);
      
    entry.fetchResolve = undefined;
    entry.state = Math.max(entry.state, TRANSLATE);
  }

  // 6.2.2 - TODO out of date
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

  function fulfillTranslate(loader, entry, source) {
    if (entry.translateResolve)
      entry.translateResolve(source);
    else
      entry.translate = Promise.resolve(source);
      
    entry.translateResolve = undefined;
    entry.state = Math.max(entry.state, INSTANTIATE);
  }

  // 6.2.3 - TODO out of date
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

  // 6.2.4 - TODO out of date; should now be satisfyInstance()
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

  //  - TODO out of date - replaced by ensureRegistered() and LoadModule()
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

  //  - TODO out of date - replaced by ensureRegistered() and LoadModule()
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

  // 7. Linking - TODO out of date

  // 7.2.1 inlined in 5.2.5 - TODO out of date
  // 7.2.2 - TODO out of date
  function computeDependencyGraph(entry, result) {
    if (result.indexOf(entry) != -1)
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


  // 8. Module Objects - TODO out of date

  // 8.3 Module Reflection - TODO out of date

  // plain user-facing module object
  function Module(descriptors, executor, evaluate) {
    // should define as unconfigurable and preventExtensions
    // going for max perf first iteration though
    for (var p in descriptors)
      this[p] = descriptors[p];
  }
