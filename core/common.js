/*
 * Environment
 */
export var isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';
export var isNode = typeof process !== 'undefined' && process.versions && process.versions.node;
export var isWindows = typeof process !== 'undefined' && typeof process.platform === 'string' && process.platform.match(/^win/);

var envGlobal = typeof self !== 'undefined' ? self : global;
export { envGlobal as global }

/*
 * Simple Symbol() shim
 */
var hasSymbol = typeof Symbol !== 'undefined';
export function createSymbol (name) {
  return hasSymbol ? Symbol() : '@@' + name;
}

export function pathToFileUrl (filePath) {
  return 'file://' + (isWindows ? '/' : '') + filePath;
}

export function fileUrlToPath (fileUrl) {
  if (fileUrl.substr(0, 7) !== 'file://')
    throw new RangeError(fileUrl + ' is not a valid file url');
  if (isWindows)
    return fileUrl.substr(8).replace(/\//g, '/');
  else
    return fileUrl.substr(7);
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
  baseURI = 'file://' + (isWindows ? '/' : '') + process.cwd();
  if (isWindows)
    baseURI = baseURI.replace(/\\/g, '/');
}
else {
  throw new TypeError('No environment baseURI');
}

// ensure baseURI has trailing "/"
if (baseURI[baseURI.length - 1] !== '/')
  baseURI += '/';

/*
 * LoaderError with chaining for loader stacks
 */
var errArgs = new Error(0, '_').fileName == '_';
function LoaderError__Check_error_message_above_for_loader_stack (childErr, newMessage) {
  // Convert file:/// URLs to paths in Node
  if (!isBrowser)
    newMessage = newMessage.replace(isWindows ? /file:\/\/\//g : /file:\/\//g, '');

  var message = (childErr.message || childErr) + '\n  ' + newMessage;

  var err;
  if (errArgs && childErr.fileName)
    err = new Error(message, childErr.fileName, childErr.lineNumber);
  else
    err = new Error(message);


  var stack = childErr.originalErr ? childErr.originalErr.stack : childErr.stack;

  if (isNode)
    // node doesn't show the message otherwise
    err.stack = message + '\n  ' + stack;
  else
    err.stack = stack;

  err.originalErr = childErr.originalErr || childErr;

  return err;
}
export { LoaderError__Check_error_message_above_for_loader_stack as addToError }



/*
 * Convert a CJS module.exports into a valid object for new Module:
 *
 *   new Module(getEsModule(module.exports))
 *
 * Sets the default value to the module, while also reading off named exports carefully.
 */
export function getEsModule(exports, moduleObj) {
  moduleObj = moduleObj || {};
  // don't trigger getters/setters in environments that support them
  if ((typeof exports == 'object' || typeof exports == 'function') && exports !== envGlobal) {
      for (var p in exports) {
        // The default property is copied to esModule later on
        if (p === 'default')
          continue;
        defineOrCopyProperty(moduleObj, exports, p);
      }
  }
  esModule['default'] = exports;
  defineProperty(moduleObj, '__useDefault', { value: true });
  return moduleObj;
}

function defineOrCopyProperty(targetObj, sourceObj, propName) {
  try {
    var d;
    if (d = Object.getOwnPropertyDescriptor(sourceObj, propName))
      defineProperty(targetObj, propName, d);
  }
  catch (ex) {
    // Object.getOwnPropertyDescriptor threw an exception, fall back to normal set property
    // we dont need hasOwnProperty here because getOwnPropertyDescriptor would have returned undefined above
    targetObj[propName] = sourceObj[propName];
    return false;
  }
}
