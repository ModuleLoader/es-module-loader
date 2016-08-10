import { isWindows } from './common.js';

/*
 * Script loading
 */
// script load can rely on a sync onload callback function
// hence the use of a callback
export function scriptLoad(src, resolve, reject) {
  var script = document.createElement('script');
  script.type = 'text/javascript';
  script.charset = 'utf-8';
  script.async = true;

  script.addEventListener('load', load, false);
  script.addEventListener('error', error, false);

  script.src = src;
  document.head.appendChild(script);

  function load() {
    cleanup();
    resolve();
  }

  function error(err) {
    cleanup();
    reject(new Error('Fetching ' + src));
  }

  function cleanup() {
    script.removeEventListener('load', load, false);
    script.removeEventListener('error', error, false);
    document.head.removeChild(script);
  }
}

/*
 * Source loading
 */
var envFetch;
export default envFetch;

if (typeof XMLHttpRequest != 'undefined')
  envFetch = xhrFetch;
else if (typeof module !== 'undefined' && module.require && typeof process !== 'undefined')
  envFetch = fsFetch;
else if (typeof self !== 'undefined' && self.fetch)
  envFetch = fetchFetch;

export function xhrFetch(url, authorization, fulfill, reject) {
  var xhr = new XMLHttpRequest();
  function load() {
    fulfill(xhr.responseText);
  }
  function error() {
    reject(new Error('XHR error' + (xhr.status ? ' (' + xhr.status + (xhr.statusText ? ' ' + xhr.statusText  : '') + ')' : '') + ' loading ' + url));
  }

  xhr.onreadystatechange = function () {
    if (xhr.readyState === 4) {
      // in Chrome on file:/// URLs, status is 0
      if (xhr.status == 0) {
        if (xhr.responseText) {
          load();
        }
        else {
          // when responseText is empty, wait for load or error event
          // to inform if it is a 404 or empty file
          xhr.addEventListener('error', error);
          xhr.addEventListener('load', load);
        }
      }
      else if (xhr.status === 200) {
        load();
      }
      else {
        error();
      }
    }
  };
  xhr.open("GET", url, true);

  if (xhr.setRequestHeader) {
    xhr.setRequestHeader('Accept', 'application/x-es-module, */*');
    // can set "authorization: true" to enable withCredentials only
    if (authorization) {
      if (typeof authorization == 'string')
        xhr.setRequestHeader('Authorization', authorization);
      xhr.withCredentials = true;
    }
  }

  xhr.send(null);
}

var fs;
export function nodeFetch(url, authorization, fulfill, reject) {
  if (url.substr(0, 8) != 'file:///')
    throw new Error('Unable to fetch "' + url + '". Only file URLs of the form file:/// allowed running in Node.');
  fs = fs || module.require('fs');
  if (isWindows)
    url = url.replace(/\//g, '\\').substr(8);
  else
    url = url.substr(7);
  return fs.readFile(url, function(err, data) {
    if (err) {
      return reject(err);
    }
    else {
      // Strip Byte Order Mark out if it's the leading char
      var dataString = data + '';
      if (dataString[0] === '\ufeff')
        dataString = dataString.substr(1);

      fulfill(dataString);
    }
  });
}

export function fetchFetch(url, authorization, fulfill, reject) {
  var opts = {
    headers: {'Accept': 'application/x-es-module, */*'}
  };

  if (authorization) {
    if (typeof authorization == 'string')
      opts.headers['Authorization'] = authorization;
    opts.credentials = 'include';
  }

  fetch(url, opts)
  .then(function(res) {
    if (res.ok)
      return res.text();
    else
      throw new Error('Fetch error: ' + res.status + ' ' + res.statusText);
  })
  .then(fulfill, reject);
}