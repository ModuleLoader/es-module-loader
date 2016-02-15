  // ---------- Declarative Linking Code ----------

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
          var importerIndex = importerModule.dependencies.indexOf(module);
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
    if (seen.indexOf(module) != -1)
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
