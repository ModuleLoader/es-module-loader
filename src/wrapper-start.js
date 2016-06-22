/*
 * Dynamic ES6 Module Loader Polyfill
 *
 * Implemented to the in-progress WhatWG loader standard at https://whatwg.github.io/loader/
 */

(function(__global) {

  // if we have require and exports, then define as CommonJS
  var cjsMode = typeof exports == 'object' && typeof require == 'function';

  var isWindows = typeof process != 'undefined' && !!process.platform.match(/^win/);

  function addToError(err, msg) {
    var newErr;
    if (err instanceof Error) {
      var newErr = new err.constructor(err.message, err.fileName, err.lineNumber);
      newErr.message = err.message + '\n\t' + msg;
      newErr.stack = err.stack;
    }
    else {
      newErr = err + '\n\t' + msg;
    }
      
    return newErr;
  }

  function __eval(source, debugName, context) {
    try {
      new Function(source).call(context);
    }
    catch(e) {
      throw addToError(e, 'Evaluating ' + debugName);
    }
  }
