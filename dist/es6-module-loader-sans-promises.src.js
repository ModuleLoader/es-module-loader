/*
 * Dynamic ES6 Module Loader Polyfill
 *
 * Implemented to the in-progress WhatWG loader standard at
 *   https://github.com/whatwg/loader/tree/819035fd5c59c53130a025694162fcaa2315fc36
 *
 * Up to date as of 23 Feb 2015.
 *
 */

(function(__global) {

  var Promise = __global.Promise || require('when/es6-shim/Promise');

  // IE8 support
  // Note: console.assert is not supported or polyfillable in IE8
  // so it is better to debug in IE8 against the source with 
  // assertions removed.
  var indexOf = Array.prototype.indexOf || function(item) {
    for (var i = 0, thisLen = this.length; i < thisLen; i++)
      if (this[i] === item)
        return i;
    return -1;
  };

  // if we have require and exports, then define as CommonJS
  var cjsMode = typeof exports == 'object' && typeof require == 'function';
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
        var registration = loader.loaderObj.transpile(entry.key, source, entry.metadata);
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

  // 5.2.3
  function computeDependencyGraph(entry, result) {
    if (indexOf.call(result, entry) != -1)
      return;

    result.push(entry);
    for (var i = 0; i < entry.dependencies.length; i++)
      computeDependencyGraph(entry.dependencies[i].value, result);
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

      for (var i = 0; i < module.importers.length; i++) {
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
    for (var i = 0; i < entry.dependencies.length; i++) {
      var depEntry = entry.dependencies[i].value;

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

    for (var i = 0; i < deps.length; i++) {
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


  // ---------- Transpiler Hooks ----------

  // Returns an array of ModuleSpecifiers
  var transpiler, transpilerModule;

  // use Traceur by default
  Loader.prototype.transpiler = 'traceur';

  Loader.prototype.transpile = function(key, source, metadata) {
    if (!transpiler) {
      if (this.transpiler == 'babel') {
        transpilerModule = cjsMode ? require('babel-core') : __global.babel;
        if (!transpilerModule)
          throw new TypeError('Unable to find the Babel transpiler.');
        transpiler = babelTranspile;
      }
      else {
        transpilerModule = cjsMode ? require('traceur') : __global.traceur;
        if (!transpilerModule)
          throw new TypeError('Unable to find the Traceur transpiler.');
        transpiler = traceurTranspile;
      }
    }

    // transpile to System register and evaluate out the { deps, declare } form
    return evaluateSystemRegister(key, transpiler.call(this, key, source, metadata));
  }

  function traceurTranspile(key, source, metadata) {
    var options = this.traceurOptions || {};
    options.modules = 'instantiate';
    options.script = false;
    options.sourceMaps = 'inline';
    options.inputSourceMap = metadata.sourceMap;
    options.filename = key;

    var compiler = new transpilerModule.Compiler(options);
    var source = doTraceurCompile(source, compiler, options.filename);

    // add "!eval" to end of Traceur sourceURL
    source += '!eval';

    return source;
  }
  function doTraceurCompile(source, compiler, filename) {
    try {
      return compiler.compile(source, filename);
    }
    catch(e) {
      // traceur throws an error array
      throw e[0] || e;
    }
  }

  function babelTranspile(key, source, metadata) {
    var options = this.babelOptions || {};
    options.modules = 'system';
    options.sourceMap = 'inline';
    options.filename = key;
    options.code = true;
    options.ast = false;

    // We blacklist JSX because transpiling needs to take us only as far as
    // the baseline ES features that exist when loaders are widely natively
    // supported. This allows experimental features, but features certainly
    // not in ES* won't make sense here so we try to encourage good habits.
    options.blacklist = options.blacklist || [];
    options.blacklist.push('react');

    var source = transpilerModule.transform(source, options).code;

    // add "!eval" to end of Babel sourceURL
    return source + '\n//# sourceURL=' + key + '!eval';
  }

  function evaluateSystemRegister(key, source) {
    var curSystem = __global.System = __global.System || System;

    var registration;

    // Hijack System .register to set declare function
    var curRegister = curSystem .register;
    curSystem .register = function(deps, declare) {
      registration = {
        deps: deps,
        declare: declare
      };
    }

    doEval(source);

    curSystem .register = curRegister;
    // console.assert(registration);
    return registration;
  }

  function doEval(source) {
    try {
      // closest we can get to undefined 'this'
      // we use eval over new Function because of source maps support
      // NB retry Function again here
      eval.call(null, source);
    }
    catch(e) {
      if (e.name == 'SyntaxError' || e.name == 'TypeError')
        e.message = 'Evaluating ' + key + '\n\t' + e.message;
      throw e;
    }
  }


  // from https://gist.github.com/Yaffle/1088850
  function URLUtils(url, baseURL) {
    if (typeof url != 'string')
      throw new TypeError('URL must be a string');
    var m = String(url).replace(/^\s+|\s+$/g, "").match(/^([^:\/?#]+:)?(?:\/\/(?:([^:@\/?#]*)(?::([^:@\/?#]*))?@)?(([^:\/?#]*)(?::(\d*))?))?([^?#]*)(\?[^#]*)?(#[\s\S]*)?/);
    if (!m) {
      throw new RangeError();
    }
    var protocol = m[1] || "";
    var username = m[2] || "";
    var password = m[3] || "";
    var host = m[4] || "";
    var hostname = m[5] || "";
    var port = m[6] || "";
    var pathname = m[7] || "";
    var search = m[8] || "";
    var hash = m[9] || "";
    if (baseURL !== undefined) {
      var base = baseURL instanceof URLUtils ? baseURL : new URLUtils(baseURL);
      var flag = protocol === "" && host === "" && username === "";
      if (flag && pathname === "" && search === "") {
        search = base.search;
      }
      if (flag && pathname.charAt(0) !== "/") {
        pathname = (pathname !== "" ? (((base.host !== "" || base.username !== "") && base.pathname === "" ? "/" : "") + base.pathname.slice(0, base.pathname.lastIndexOf("/") + 1) + pathname) : base.pathname);
      }
      // dot segments removal
      var output = [];
      pathname.replace(/^(\.\.?(\/|$))+/, "")
        .replace(/\/(\.(\/|$))+/g, "/")
        .replace(/\/\.\.$/, "/../")
        .replace(/\/?[^\/]*/g, function (p) {
          if (p === "/..") {
            output.pop();
          } else {
            output.push(p);
          }
        });
      pathname = output.join("").replace(/^\//, pathname.charAt(0) === "/" ? "/" : "");
      if (flag) {
        port = base.port;
        hostname = base.hostname;
        host = base.host;
        password = base.password;
        username = base.username;
      }
      if (protocol === "") {
        protocol = base.protocol;
      }
    }
    this.origin = protocol + (protocol !== "" || host !== "" ? "//" : "") + host;
    this.href = protocol + (protocol !== "" || host !== "" ? "//" : "") + (username !== "" ? username + (password !== "" ? ":" + password : "") + "@" : "") + host + pathname + search + hash;
    this.protocol = protocol;
    this.username = username;
    this.password = password;
    this.host = host;
    this.hostname = hostname;
    this.port = port;
    this.pathname = pathname;
    this.search = search;
    this.hash = hash;
  }
  
  // ---------- System Loader Definition ----------

  /*
   * Corrsponds to section 8 of the specification
   */

  var isWindows = typeof process != 'undefined' && !!process.platform.match(/^win/);

  // Fetch Implementation
  var fetchURI;

  if (typeof XMLHttpRequest != 'undefined') {
    fetchURI = function(url, fulfill, reject) {
      var xhr = new XMLHttpRequest();
      var sameDomain = true;
      var doTimeout = false;
      if (!('withCredentials' in xhr)) {
        // check if same domain
        var domainCheck = /^(\w+:)?\/\/([^\/]+)/.exec(url);
        if (domainCheck) {
          sameDomain = domainCheck[2] === window.location.host;
          if (domainCheck[1])
            sameDomain &= domainCheck[1] === window.location.protocol;
        }
      }
      if (!sameDomain && typeof XDomainRequest != 'undefined') {
        xhr = new XDomainRequest();
        xhr.onload = load;
        xhr.onerror = error;
        xhr.ontimeout = error;
        xhr.onprogress = function() {};
        xhr.timeout = 0;
        doTimeout = true;
      }
      function load() {
        fulfill(xhr.responseText);
      }
      function error() {
        reject(new Error('GET ' + url + ' ' + xhr.status + ' (' + xhr.statusText + ')'));
      }

      xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) {
          if (xhr.status === 200 || (xhr.status == 0 && xhr.responseText)) {
            load();
          } else {
            error();
          }
        }
      };
      xhr.open("GET", url, true);

      if (doTimeout)
        setTimeout(function() {
          xhr.send();
        }, 0);

      xhr.send(null);
    }
  }
  else if (cjsMode) {
    var fs;
    fetchURI = function(url, fulfill, reject) {
      if (url.substr(0, 8) != 'file:///')
        throw 'Only file URLs of the form file: allowed running in Node.';
      fs = fs || require('fs');
      if (isWindows)
        url = url.replace(/\//g, '\\').substr(8)
      else
        url = url.substr(7);
      fs.readFile(url, function(err, data) {
        if (err)
          reject(err);
        else
          fulfill(data + '');
      });
    }
  }
  else {
    throw new TypeError('No environment fetch API available.');
  }

  var SystemLoader = function() {
    Loader.call(this, arguments);

    var siteTable = {};
    this.site = function(mappings) {
      for (var m in mappings)
        siteTable[m] = mappings[m];
    }
    this.site.get = function(name) {
      return siteTable[name];
    }
    this.site.set = function(name, url) {
      siteTable[name] = url;
    }
    this.site.has = function(name) {
      return !!siteTable[name];
    }
    this.site['delete'] = function(name) {
      delete siteTable[name];
    }

    function siteLookup(target) {
      for (var p in siteTable) {
        var wildcard = p.charAt(p.length - 1) === '*';
        if (wildcard) {
          if (target.substr(0, p.length - 1) === p.substr(0, p.length - 1))
            return siteTable[p].replace('*', target.substr(p.length - 1, target.length - p.length + 1));
        }
        else {
          if (target === p)
            return siteTable[p];
        }
      }
    }

    this.hook('resolve', function(url, parentUrl, metadata) {
      // first check site table
      var sitesUrl = siteLookup(url);
      
      if (sitesUrl || !parentUrl)
        parentUrl = base;

      // then do url normalization
      // NB for performance, test out a normalization cache here
      return new URLUtils(sitesUrl || url, parentUrl).href;
    });

    this.hook('fetch', function(url, metadata) {
      return new Promise(function(resolve, reject) {
        fetchURI(url, resolve, reject);
      });
    });

    this.hook('translate', function(url, source, metadata) {
      return source;
    });

    this.hook('instantiate', function(url, source, metadata) {});
  }

  // inline Object.create-style class extension
  function LoaderProto() {}
  LoaderProto.prototype = Loader.prototype;
  SystemLoader.prototype = new LoaderProto();

  // set the base URL
  var base;
  if (typeof document != 'undefined' && document.baseURI) {
    base = document.baseURI;
  }
  else if (typeof location != 'undefined' && location.href) {
    base = location.href;
  }
  else if (typeof document != 'undefined' && document.getElementsByTagName) {
    base = document.getElementsByTagName('base')[0];
    base = base && base.href;
  }
  if (base) {
    base = base.split('#')[0].split('?')[0];
    base = base.substr(0, base.lastIndexOf('/') + 1);
  }
  else if (typeof process != 'undefined' && process.cwd) {
    base = 'file://' + (isWindows ? '/' : '') + process.cwd() + '/';
    if (isWindows)
      base = base.replace(/\\/g, '/');
  }
  base = new URLUtils(base);

  var System = new SystemLoader();
  System.constructor = SystemLoader;

  // <script type="module"> support
  // allow a data-init function callback once loaded
  if (typeof document != 'undefined' && document.getElementsByTagName) {
    var curScript = document.getElementsByTagName('script');
    curScript = curScript[curScript.length - 1];

    function completed() {
      document.removeEventListener('DOMContentLoaded', completed, false );
      window.removeEventListener('load', completed, false );
      ready();
    }

    function ready() {
      var scripts = document.getElementsByTagName('script');
      var anonCnt = 0;
      for (var i = 0; i < scripts.length; i++) {
        var script = scripts[i];
        if (script.type == 'module') {
          var url = script.src;

          // <script type="module" src="file.js"></script>
          if (url) {
            System.load(url, 'ready');
          }

          // <script type="module">import "x"</script>
          else {
            System.provide('anon' + ++anonCnt, 'fetch', script.innerHTML.substr(1));
            System.load('anon' + anonCnt, 'ready');
          }
        }
      }
    }

    // DOM ready, taken from https://github.com/jquery/jquery/blob/master/src/core/ready.js#L63
    if (document.readyState === 'complete') {
      setTimeout(ready);
    }
    else if (document.addEventListener) {
      document.addEventListener('DOMContentLoaded', completed, false);
      window.addEventListener('load', completed, false);
    }

    // run the data-init function on the script tag
    if (curScript && curScript.getAttribute('data-init'))
      window[curScript.getAttribute('data-init')]();
  }

  // ---------- Export Definitions ----------  
  
  var Reflect;

  (function(exports) {

    Reflect = exports.Reflect || {};

    Reflect.Loader = Reflect.Loader || Loader;
    Reflect.Module = Reflect.Module || Module;
    Reflect.global = Reflect.global || __global;

    exports.LoaderPolyfill = Loader;
    exports.ModulePolyfill = Module;
    exports.Reflect = Reflect;
    exports.System = System;

  })(cjsMode ? exports : __global);

  //module.exports = exports;

})(typeof window != 'undefined' ? window : (typeof WorkerGlobalScope != 'undefined' ? self : global));
