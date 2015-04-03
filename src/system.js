/*
*********************************************************************************************

  System Loader Implementation

    - Implemented to https://github.com/jorendorff/js-loaders/blob/master/browser-loader.js

    - <script type="module"> supported

*********************************************************************************************
*/

  var isWorker = typeof self !== 'undefined' && typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope;
  var isBrowser = typeof window != 'undefined' && !isWorker;
  var isWindows = typeof process != 'undefined' && !!process.platform.match(/^win/);
  var Promise = __global.Promise || require('when/es6-shim/Promise');

  var fetchTextFromURL;
  if (typeof XMLHttpRequest != 'undefined') {
    fetchTextFromURL = function(url, fulfill, reject) {
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
        reject(xhr.statusText + ': ' + url || 'XHR error');
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
  else if (typeof require != 'undefined') {
    var fs;
    fetchTextFromURL = function(url, fulfill, reject) {
      if (url.substr(0, 5) != 'file:')
        throw 'Only file URLs of the form file: allowed running in Node.';
      fs = fs || require('fs');
      url = url.substr(5);
      if (isWindows)
        url = url.replace(/\//g, '\\');
      return fs.readFile(url, function(err, data) {
        if (err)
          return reject(err);
        else
          fulfill(data + '');
      });
    }
  }
  else {
    throw new TypeError('No environment fetch API available.');
  }

  var SystemLoader = function(options) {
    Loader.call(this, options || {});

    // Set default baseURL and paths
    if (typeof location != 'undefined' && location.href) {
      var href = __global.location.href.split('#')[0].split('?')[0];
      this.baseURL = href.substring(0, href.lastIndexOf('/') + 1);
    }
    else if (typeof process != 'undefined' && process.cwd) {
      this.baseURL = 'file:' + process.cwd() + '/';
      if (isWindows)
        this.baseURL = this.baseURL.replace(/\\/g, '/');
    }
    else {
      throw new TypeError('No environment baseURL');
    }
    this.paths = { '*': '*.js' };
  };

  // inline Object.create-style class extension
  function LoaderProto() {}
  LoaderProto.prototype = Loader.prototype;
  SystemLoader.prototype = new LoaderProto();

  SystemLoader.prototype.global = isBrowser ? window : (isWorker ? self : __global);

  SystemLoader.prototype.normalize = function(name, parentName, parentAddress) {
    if (typeof name != 'string')
      throw new TypeError('Module name must be a string');

    var segments = name.split('/');

    if (segments.length == 0)
      throw new TypeError('No module name provided');

    // current segment
    var i = 0;
    // is the module name relative
    var rel = false;
    // number of backtracking segments
    var dotdots = 0;
    if (segments[0] == '.') {
      i++;
      if (i == segments.length)
        throw new TypeError('Illegal module name "' + name + '"');
      rel = true;
    }
    else {
      while (segments[i] == '..') {
        i++;
        if (i == segments.length)
          throw new TypeError('Illegal module name "' + name + '"');
      }
      if (i)
        rel = true;
      dotdots = i;
    }

    for (var j = i; j < segments.length; j++) {
      var segment = segments[j];
      if (segment == '' || segment == '.' || segment == '..')
        throw new TypeError('Illegal module name "' + name + '"');
    }

    if (!rel)
      return name;

    // build the full module name
    var normalizedParts = [];
    var parentParts = (parentName || '').split('/');
    var normalizedLen = parentParts.length - 1 - dotdots;

    normalizedParts = normalizedParts.concat(parentParts.splice(0, parentParts.length - 1 - dotdots));
    normalizedParts = normalizedParts.concat(segments.splice(i, segments.length - i));

    return normalizedParts.join('/');
  }

  SystemLoader.prototype.locate = function(load) {
    var name = load.name;

    // NB no specification provided for System.paths, used ideas discussed in https://github.com/jorendorff/js-loaders/issues/25

    // most specific (longest) match wins
    var pathMatch = '', wildcard;

    // check to see if we have a paths entry
    for (var p in this.paths) {
      var pathParts = p.split('*');
      if (pathParts.length > 2)
        throw new TypeError('Only one wildcard in a path is permitted');

      // exact path match
      if (pathParts.length == 1) {
        if (name == p && p.length > pathMatch.length) {
          pathMatch = p;
          break;
        }
      }

      // wildcard path match
      else {
        if (name.substr(0, pathParts[0].length) == pathParts[0] && name.substr(name.length - pathParts[1].length) == pathParts[1]) {
          pathMatch = p;
          wildcard = name.substr(pathParts[0].length, name.length - pathParts[1].length - pathParts[0].length);
        }
      }
    }

    var outPath = this.paths[pathMatch];
    if (wildcard)
      outPath = outPath.replace('*', wildcard);

    // percent encode just '#' in module names
    // according to https://github.com/jorendorff/js-loaders/blob/master/browser-loader.js#L238
    // we should encode everything, but it breaks for servers that don't expect it 
    // like in (https://github.com/systemjs/systemjs/issues/168)
    if (isBrowser)
      outPath = outPath.replace(/#/g, '%23');

    return toAbsoluteURL(this.baseURL, outPath);
  }

  SystemLoader.prototype.fetch = function(load) {
    var self = this;
    return new Promise(function(resolve, reject) {
      fetchTextFromURL(toAbsoluteURL(self.baseURL, load.address), function(source) {
        resolve(source);
      }, reject);
    });
  }

  var System = new SystemLoader();

  // note we have to export before runing "init" below
  if (typeof exports === 'object')
    module.exports = System;

  __global.System = System;
