/*
*********************************************************************************************

  System Loader Implementation

    - Implemented to https://github.com/jorendorff/js-loaders/blob/master/browser-loader.js

    - <script type="module"> supported

*********************************************************************************************
*/

var System;

function SystemLoader(options) {
  Loader.call(this, options || {});

  var baseURL;
  // Set default baseURL and paths
  if (typeof document != 'undefined' && document.getElementsByTagName) {
    baseURL = document.baseURI;

    if (!baseURL) {
      var bases = document.getElementsByTagName('base');
      baseURL = bases[0] && bases[0].href || window.location.href;
    }

    // sanitize out the hash and querystring
    baseURL = baseURL.split('#')[0].split('?')[0];
    baseURL = baseURL.substr(0, baseURL.lastIndexOf('/') + 1);
  }
  else if (typeof process != 'undefined' && process.cwd) {
    baseURL = 'file://' + (isWindows ? '/' : '') + process.cwd() + '/';
    if (isWindows)
      baseURL = baseURL.replace(/\\/g, '/');
  }
  else if (typeof location != 'undefined') {
    baseURL = __global.location.href;
  }
  else {
    throw new TypeError('No environment baseURL');
  }

  this.baseURL = baseURL;
  this.paths = {};
}

(function() {
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
    };
  }
  else if (typeof require != 'undefined') {
    var fs;
    fetchTextFromURL = function(url, fulfill, reject) {
      if (url.substr(0, 8) != 'file:///')
        throw 'Only file URLs of the form file:/// allowed running in Node.';
      fs = fs || require('fs');
      if (isWindows)
        url = url.replace(/\//g, '\\').substr(8);
      else
        url = url.substr(7);
      return fs.readFile(url, function(err, data) {
        if (err)
          return reject(err);
        else
          fulfill(data + '');
      });
    };
  }
  else {
    throw new TypeError('No environment fetch API available.');
  }

  // inline Object.create-style class extension
  function LoaderProto() {}
  LoaderProto.prototype = Loader.prototype;
  SystemLoader.prototype = new LoaderProto();

  SystemLoader.prototype.normalize = function(name, parentName, parentAddress) {
    if (typeof name != 'string')
      throw new TypeError('Module name must be a string');

    var segments = name.split('/');

    // current segment
    var i = 0;
    // is the module name relative
    var rel = false;
    // number of backtracking segments
    var dotdots = 0;
    if (segments[0] == '.') {
      i++;
      rel = true;
    }
    else {
      while (segments[i] == '..') {
        i++;
      }
      if (i)
        rel = true;
      dotdots = i;
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
  };

  var baseURLCache = {};

  SystemLoader.prototype.locate = function(load) {
    var name = load.name;

    // NB no specification provided for System.paths, used ideas discussed in https://github.com/jorendorff/js-loaders/issues/25

    // most specific (most number of slashes in path) match wins
    var pathMatch = '', wildcard, maxSlashCount = 0;

    // check to see if we have a paths entry
    for (var p in this.paths) {
      var pathParts = p.split('*');
      if (pathParts.length > 2)
        throw new TypeError('Only one wildcard in a path is permitted');

      // exact path match
      if (pathParts.length == 1) {
        if (name == p) {
          pathMatch = p;
          break;
        }
      }
      // wildcard path match
      else {
        var slashCount = p.split('/').length;
        if (slashCount >= maxSlashCount &&
            name.substr(0, pathParts[0].length) == pathParts[0] &&
            name.substr(name.length - pathParts[1].length) == pathParts[1]) {
              maxSlashCount = slashCount;
              pathMatch = p;
              wildcard = name.substr(pathParts[0].length, name.length - pathParts[1].length - pathParts[0].length);
            }
      }
    }

    var outPath = this.paths[pathMatch] || name;
    if (wildcard)
      outPath = outPath.replace('*', wildcard);

    // percent encode just '#' in module names
    // according to https://github.com/jorendorff/js-loaders/blob/master/browser-loader.js#L238
    // we should encode everything, but it breaks for servers that don't expect it
    // like in (https://github.com/systemjs/systemjs/issues/168)
    if (isBrowser)
      outPath = outPath.replace(/#/g, '%23');

    return new URL(outPath, baseURLCache[this.baseURL] = baseURLCache[this.baseURL] || new URL(this.baseURL)).href;
  };

  SystemLoader.prototype.fetch = function(load) {
    return new Promise(function(resolve, reject) {
      fetchTextFromURL(load.address, resolve, reject);
    });
  };

})();
