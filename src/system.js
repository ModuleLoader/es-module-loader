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
