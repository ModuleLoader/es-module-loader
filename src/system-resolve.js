var baseURLCache = {};

var absURLRegEx = /^([^\/]+:\/\/|\/)/;

// Normalization with module names as absolute URLs
SystemLoader.prototype.normalize = function(name, parentName, parentAddress) {
  // NB does `import 'file.js'` import relative to the parent name or baseURL?
  //    have assumed that it is baseURL-relative here, but spec may well align with URLs to be the latter
  //    safe option for users is to always use "./file.js" for relative

  // not absolute or relative -> apply paths (what will be sites)
  if (!name.match(absURLRegEx) && name[0] != '.')
    name = new URL(applyPaths(this, name), this.baseURL).href;
  // apply parent-relative normalization, parentAddress is already normalized
  else
    name = new URL(name, parentAddress || this.baseURL).href;

  return name;
};

SystemLoader.prototype.locate = function(load) {
  return load.name;
};