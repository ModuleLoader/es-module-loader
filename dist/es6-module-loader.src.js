  // from https://gist.github.com/Yaffle/1088850
  function URL(url, baseURL) {
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
      var base = baseURL instanceof URL ? baseURL : new URL(baseURL);
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
    // convert windows file URLs to use /
    if (protocol == 'file:')
      pathname = pathname.replace(/\\/g, '/');

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

  // if we have require and exports, then define as CommonJS
  var cjsMode = typeof exports == 'object' && typeof require == 'function';

  var isWindows = typeof process != 'undefined' && !!process.platform.match(/^win/);

  function addToError(err, msg) {
    var newErr;
    if (err instanceof Error) {
      var newErr = new err.constructor(err.message, err.fileName, err.lineNumber);
      newErr.message = err.message + '\n\t' + msg;
      newErr.stack = err.stack;
    }
    else {
      newErr = err + '\n\t' + msg;
    }
      
    return newErr;
  }

  function __eval(source, debugName, context) {
    try {
      new Function(source).call(context);
    }
    catch(e) {
      throw addToError(e, 'Evaluating ' + debugName);
    }
  }

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

      registry: {},
      newRegistry: new Registry(), //this is temporary until Registry is ready to be used
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

  };

  // 3.3.5
  Object.defineProperty(Loader.prototype, 'registry', {
      get: function() {
        return this._loader.newRegistry;
      }
  });

  // No longer in spec
  // For eg fetch, <script type="module">${value}</script>, key = anon
  Loader.prototype.provide = function(key, stage, value, metadata) {
    var loader = this._loader;

    var entry = ensureRegistered(loader, key, metadata);

    if (stage == 'fetch') {
      fulfillFetch(loader, entry, value);
    }
    else if (stage == 'translate') {
      fulfillTranslate(loader, entry, value);
    }
    else if (stage == 'instantiate') {
      fulfillFetch(loader, entry, undefined);
      fulfillTranslate(loader, entry, undefined);
      // NB error propogation
      entry.translate.then(function(source) {
        loadTranspilerThenFulfillInstantiate(loader, entry, value, source);
      });
    }
  };

  // TODO: the Loader no longer has the hook property
  // loader.hook('resolve') -> returns resolve hook
  // loader.hook('resolve', fn) -> sets resolve hook
  var hooks = ['resolve', 'fetch', 'translate', 'instantiate'];
  Loader.prototype.hook = function(name, value) {
    var loader = this._loader;
    if (value)
      loader[name] = value;
    else
      return loader[name];
  };

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
    return this.registryMap.entries();
  }

  // 4.4.4
  Registry.prototype.keys = function() {
    return this.registryMap.keys();
  }

  // 4.4.5
  Registry.prototype.values = function() {
    return this.registryMap.values();
  }

  // 4.4.6
  Registry.prototype.get = function(key) {
    return this.registryMap.get(key);
  }

  // 4.4.7
  Registry.prototype.set = function(key, value) {
    this.registryMap.set(key, value);
    return this;
  }

  // 4.4.8
  Registry.prototype.has = function(key) {
    return this.registryMap.has(key);
  }

  // 4.4.9
  Registry.prototype.delete = function(key) {
    return this.registryMap.delete(key);
  }

  // 4.1.1 - TODO out of date
  function getCurrentStage(entry) {
    return entry.pipeline[0];
  }

  // 4.1.4 - TODO out of date
  function getRegistryEntry(registry, key) {

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

  // 4.4.3 - TODO out of date
  Registry.prototype.lookup = function(key) {
    return getRegistryEntry(this, key);
  };

  // 4.4.4 - TODO out of date
  Registry.prototype.install = function(key, module) {

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

  // 4.4.5 - TODO out of date
  Registry.prototype.uninstall = function(key) {
    if (typeof this !== 'object')
      throw new TypeError('Registry must be an object');
    var entry = this._registry.registryData[key];
    if (!entry)
      throw new TypeError('Module ' + key + ' does not exist');
    var stageEntry = getCurrentStage(entry);
    if (stageEntry.stage !== 'link' && stageEntry.stage !== 'ready')
      throw new TypeError('Module ' + key + ' is still loading');
    delete this._registry.registryData[key];
  }

  // 4.4.6 - TODO out of date
  Registry.prototype.cancel = function(key) {
    if (typeof this !== 'object')
      throw new TypeError('Registry must be an object');
    var entry = this._registry.registryData[key];
    if (!entry)
      throw new TypeError('Module ' + key + ' does not exist');
    var stageEntry = getCurrentStage(entry);
    if (stageEntry.stage === 'link' || stageEntry.stage === 'ready')
      throw new TypeError('Module ' + key + ' is already done linking');
    delete this._registry.registryData[key];
  }

  // 5. Loading - TODO out of date

  // 5.1.1 - TODO out of date
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

  // 5.1.2 inlined - TODO out of date

  // 5.1.3 - TODO out of date
  function fulfillFetch(loader, entry, payload) {
    if (entry.fetchResolve)
      entry.fetchResolve(payload);
    else
      entry.fetch = Promise.resolve(payload);
      
    entry.fetchResolve = undefined;
    entry.state = Math.max(entry.state, TRANSLATE);
  }

  // 5.1.4 - TODO out of date
  function fulfillTranslate(loader, entry, source) {
    if (entry.translateResolve)
      entry.translateResolve(source);
    else
      entry.translate = Promise.resolve(source);
      
    entry.translateResolve = undefined;
    entry.state = Math.max(entry.state, INSTANTIATE);
  }

  // 5.1.5 - TODO out of date
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

  // 5.2.1 - TODO out of date
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

  // 5.2.2 - TODO out of date
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

  // 5.2.3 - TODO out of date
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

  // 5.2.4 - TODO out of date
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

  // 5.2.5 - TODO out of date
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

  // 5.2.6 - TODO out of date
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

  // 6. Linking - TODO out of date

  // 6.2.1 inlined in 5.2.5 - TODO out of date
  // 6.2.2 inlined in 5.2.5 - TODO out of date

  // 6.2.3 - TODO out of date
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


  // 7. Module Objects - TODO out of date

  // 7.3 Module Reflection - TODO out of date

  // plain user-facing module object
  function Module(descriptors, executor, evaluate) {
    // should define as unconfigurable and preventExtensions
    // going for max perf first iteration though
    for (var p in descriptors)
      this[p] = descriptors[p];
  }

  // ---------- Dynamic-Only Linking Code ----------
  
  function transpile() {
    throw new TypeError('Native ES Module support not included in this loader.');
  }

  function systemInstantiate() {}
// ---------- System Loader Definition ----------

  var System;

  /*
   * Corrsponds to section 8 of the specification
   */

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
    };
  }
  else if (cjsMode) {
    var fs;
    fetchURI = function(url, fulfill, reject) {
      if (url.substr(0, 8) != 'file:///')
        throw 'Only file URLs of the form file: allowed running in Node.';
      fs = fs || require('fs');
      if (isWindows)
        url = url.replace(/\//g, '\\').substr(8);
      else
        url = url.substr(7);
      fs.readFile(url, function(err, data) {
        if (err)
          reject(err);
        else
          fulfill(data + '');
      });
    };
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
      if (siteTable[target])
        return siteTable[target];

      // most specific wildcard wins, with specificity metric as "/" count in pattern
      var curMatch, curMatchLen = 0;
      for (var p in siteTable) {
        var wildcardParts = p.split('*');
        if (wildcardParts.length > 2)
          throw new TypeError('Sites entry ' + p + ' contains multiple wildcards.');

        if (wildcardParts.length == 1)
          continue;
        
        if (p.split('/').length >= curMatchLen
            && p.substr(0, wildcardParts[0].length) === target.substr(0, wildcardParts[0].length)
            && p.substr(p.length - wildcardParts[1].length) === wildcardParts[1]) {
          curMatch = siteTable[p].replace('*', target.substr(wildcardParts[0].length, target.length - p.length + 1));
          curMatchLen = p.split('/').length;
        }
      }

      return curMatch;
    }

    this.hook('resolve', function(url, parentUrl, metadata) {
      // first check site table
      var sitesUrl = siteLookup(url);
      
      if (sitesUrl || !parentUrl)
        parentUrl = base;

      // then do url normalization
      // NB for performance, test out a normalization cache here
      return new URL(sitesUrl || url, parentUrl).href;
    });

    this.hook('fetch', function(url, metadata) {
      return new Promise(function(resolve, reject) {
        fetchURI(url, resolve, reject);
      });
    });

    this.hook('translate', function(url, source, metadata) {
      return source;
    });

    // defined in transpiler.js or dynamic-only.js
    this.hook('instantiate', systemInstantiate);

    if (this.transpiler)
      setupTranspilers(this);
  };

  // inline Object.create-style class extension
  function LoaderProto() {}
  LoaderProto.prototype = Loader.prototype;
  SystemLoader.prototype = new LoaderProto();

  // set the base URL
  var base;
  if (typeof document != 'undefined' && document.baseURI) {
    base = document.baseURI;
  }
  else if (typeof document != 'undefined' && document.getElementsByTagName) {
    base = document.getElementsByTagName('base')[0];
    base = base && base.href;
  }
  else if (typeof location != 'undefined' && location.href) {
    base = location.href;
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
  base = new URL(base);


  // ---------- Export Definitions ----------  
    
  var loader = new SystemLoader();
  loader.constructor = SystemLoader;

  __global.LoaderPolyfill = Loader;
  __global.ModulePolyfill = Module;

  __global.Reflect = __global.Reflect || {};
  __global.Reflect.Module = __global.Reflect.Module || Module;
  __global.Reflect.Loader = __global.Reflect.Loader || Loader;

  __global.System = __global.System || {};
  __global.System.global = __global.System.global || __global;
  __global.System.loader = __global.System.loader || loader;

  if (cjsMode) {
    exports.Reflect = __global.Reflect;
    exports.System = __global.System;
  }

})(typeof window != 'undefined' ? window : (typeof WorkerGlobalScope != 'undefined' ? self : global));
