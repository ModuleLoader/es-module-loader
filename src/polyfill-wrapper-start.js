/*
 * Dynamic ES6 Module Loader Polyfill
 *
 * Implemented to the in-progress WhatWG loader standard at
 *   https://github.com/whatwg/loader/tree/819035fd5c59c53130a025694162fcaa2315fc36
 *
 * Up to date as of 23 Feb 2015.
 *
 */

(function(__global) {

  var Promise = __global.Promise || require('when/es6-shim/Promise');

  // IE8 support
  // Note: console.assert is not supported or polyfillable in IE8
  // so it is better to debug in IE8 against the source with 
  // assertions removed.
  var indexOf = Array.prototype.indexOf || function(item) {
    for (var i = 0, thisLen = this.length; i < thisLen; i++)
      if (this[i] === item)
        return i;
    return -1;
  };

  // if we have require and exports, then define as CommonJS
  var cjsMode = typeof exports == 'object' && typeof require == 'function';