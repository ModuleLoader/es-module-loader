/*
 * Environment
 */
export var isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';
export var isWorker = typeof window === 'undefined' && typeof self !== 'undefined' && typeof importScripts !== 'undefined';
export var isWindows = typeof process !== 'undefined' && typeof process.platform === 'string' && process.platform.match(/^win/);
export var isNode = typeof process !== 'undefined' && process.versions && process.versions.node;

var envGlobal = typeof self !== 'undefined' ? self : global;
export { envGlobal as global }

export function pathToFileUrl(filePath) {
  return 'file://' + (isWindows ? '/' : '') + filePath;
}

export function fileUrlToPath(fileUrl) {
  if (fileUrl.substr(0, 7) !== 'file://')
    throw new RangeError(fileUrl + ' is not a valid file url');
  if (isWindows)
    return fileUrl.substr(8).replace(/\//g, '/');
  else
    return fileUrl.substr(7);
}

/*
 * Path to loader itself
 */
export var scriptSrc;

if (isBrowser) {
  if (document.currentScript)
    scriptSrc = document.currentScript.src;
  
  var scripts = document.getElementsByTagName('script');
  var curScript = scripts.length && scripts[scripts.length - 1];
  if (curScript && !curScript.defer && !curScript.async)
    scriptSrc = curScript.src;
}
else if (isWorker) {
  try {
    throw new Error('_');
  } catch (e) {
    e.stack.replace(/(?:at|@).*(http.+):[\d]+:[\d]+/, function(m, url) {
      scriptSrc = url;
    });
  }
}
else if (typeof __filename != 'undefined') {
  scriptSrc = __filename;
}

/*
 * Environment baseURI
 */
export var baseURI;

// environent baseURI detection
if (typeof document != 'undefined' && document.getElementsByTagName) {
  baseURI = document.baseURI;

  if (!baseURI) {
    var bases = document.getElementsByTagName('base');
    baseURI = bases[0] && bases[0].href || window.location.href;
  }
}
else if (typeof location != 'undefined') {
  baseURI = location.href;
}

// sanitize out the hash and querystring
if (baseURI) {
  baseURI = baseURI.split('#')[0].split('?')[0];
  baseURI = baseURI.substr(0, baseURI.lastIndexOf('/') + 1);
}
else if (typeof process != 'undefined' && process.cwd) {
  baseURI = 'file://' + (isWindows ? '/' : '') + process.cwd() + '/';
  if (isWindows)
    baseURI = baseURI.replace(/\\/g, '/');
}
else {
  throw new TypeError('No environment baseURI');
}

/*
 * Error chaining for loader stacks
 */
var errArgs = new Error(0, '_').fileName == '_';

scriptSrc ='asdf';

export function addToError(err, msg) {
  // parse the stack removing loader code lines for simplification
  if (!err.originalErr) {
    var stack = (err.stack || err.message || err).toString().split('\n');
    var newStack;

    // if the error stack doesn't start in SystemJS, skip the SystemJS stack part
    newStack = [];
    for (var i = 0; i < stack.length; i++)
      if (scriptSrc && stack[i].indexOf(scriptSrc) === -1)
        newStack.push(stack[i]);
  }

  var newMsg = '(SystemJS) ' + (newStack ? newStack.join('\n\t') : err.message.substr(11)) + '\n\t' + msg;

  // Convert file:/// URLs to paths in Node
  if (!isBrowser)
    newMsg = newMsg.replace(isWindows ? /file:\/\/\//g : /file:\/\//g, '');

  var newErr = errArgs ? new Error(newMsg, err.fileName, err.lineNumber) : new Error(newMsg);
  
  // Node needs stack adjustment for throw to show message
  if (!isBrowser)
    newErr.stack = newMsg;
  // Clearing the stack stops unnecessary loader lines showing
  else
    newErr.stack = null;
  
  // track the original error
  newErr.originalErr = err.originalErr || err;

  return newErr;
}

/*
 * Simple Symbol() shim
 */
var hasSymbol = typeof Symbol !== 'undefined';
export function createSymbol(name) {
  return hasSymbol ? Symbol() : '@@' + name;
}

/*
 * Simple Array values shim
 */
export function arrayValues(arr) {
  if (arr.values)
    return arr.values();
  
  if (typeof Symbol === 'undefined' || !Symbol.iterator)
    throw new Error('Cannot return values iterator unless Symbol.iterator is defined');

  var iterable = {};
  iterable[Symbol.iterator] = function() {
    var keys = Object.keys(arr);
    var keyIndex = 0;
    return {
      next: function() {
        if (keyIndex < keys.length)
          return {
            value: arr[keys[keyIndex++]],
            done: false
          };
        else
          return {
            value: undefined,
            done: true
          };
      }
    };
  };
  return iterable;
}