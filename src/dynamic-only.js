/*
 * Dynamic-only Linking Code
 */

  // 15.2.5.4
  // dynamic-only linking implementation
  function link(linkSet, linkError) {
    
    var loader = linkSet.loader;

    if (!linkSet.loads.length)
      return;

    for (var i = 0; i < linkSet.loads.length; i++) {
      var load = linkSet.loads[i];
      var module = doDynamicExecute(linkSet, load, linkError);
      if (!module)
        return;
      load.module = {
        name: load.name,
        module: module
      };
      load.status = 'linked';
      finishLoad(loader, load);
    }
  }

  function evaluateLoadedModule(loader, load) {
    return load.module.module;
  }

})();