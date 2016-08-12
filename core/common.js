/*
 * Environment
 */
export var isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';
export var isNode = typeof process !== 'undefined' && process.versions && process.versions.node;
export var isWindows = typeof process !== 'undefined' && typeof process.platform === 'string' && process.platform.match(/^win/);

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
 * LoaderError with chaining for loader stacks
 */
var errArgs = new Error(0, '_').fileName == '_';
export function LoaderError(message, childErr) {
  this.name = 'LoaderError';

  if (childErr) {
    // Convert file:/// URLs to paths in Node
    if (!isBrowser)
      message = message.replace(isWindows ? /file:\/\/\//g : /file:\/\//g, '');

    this.message = (childErr.message || childErr) + '\n\t' + message;

    // node doesn't show the message otherwise
    if (isNode)
      this.stack = this.message;
    else
      this.stack = childErr.originalErr ? childErr.originalErr.stack : childErr.stack;
    this.originalErr = childErr.originalErr || childErr;

    // filename and line support in Firefox (no longer LoaderError: text though unfortunately)
    if (errArgs && childErr.fileName) {
      var err = new Error(this.message, childErr.fileName, childErr.lineNumber);
      err.__proto__ = LoaderError;
      err.originalErr = this.originalErr;
      return err;
    }
  }
  else {
    this.message = message;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, LoaderError);
    }
    // firefox case
    else if (errArgs) {
      var err = new Error(message);
      err.__proto__ = LoaderError;
      return err;
    }
    else {
      this.stack = new Error().stack;
    }
  }
}
LoaderError.prototype = Object.create(Error.prototype);
LoaderError.prototype.constructor = LoaderError;