import RegisterLoader from './core/register-loader.js';

import { isNode, isWindows, baseURI } from './core/common.js';
import { resolveUrlToParentIfNotPlain } from './core/resolve.js';
import { nodeFetch } from './core/fetch.js';

/*
 * Example Babel loader
 *
 * Used to run local loader tests
 *
 * Loads all sources as text, converts into System.register with Babel
 * 
 * Alternative Babel options can be set with a .babelrc file
 * 
 * This example loader doesn't provide more fine-grained loading behaviour than that.
 */

var babel, path;

function NodeBabelLoader(baseKey) {
  if (!isNode)
    throw new Error('Node Babel loader can only be used in Node');

  babel = require('babel-core');
  path = require('path');


  baseKey = resolveUrlToParentIfNotPlain(baseKey, baseURI) || baseKey;
  RegisterLoader.call(this, baseKey);

  var loader = this;
  
  // ensure System.register is available
  global.System = global.System || {};
  global.System.register = function() {
    loader.register.apply(loader, arguments);
  };
}
NodeBabelLoader.prototype = Object.create(RegisterLoader.prototype);

// normalize is never given a relative name like "./x", that part is already handled
// so we just need to do plain name normalization here
// for this loader, identity is enough to get URL-like normalization
NodeBabelLoader.prototype.normalize = function(key, parent, metadata) {
  return key;
};

function fileUrlToPath(fileUrl) {
  return fileUrl.substr(7 + isWindows).replace(/\//g, path.sep);
}

// instantiate just needs to run System.register
// so we fetch the source, convert into the Babel System module format, then evaluate it
NodeBabelLoader.prototype.instantiate = function(key, metadata) {
  var loader = this;

  return new Promise(function(resolve, reject) {
    nodeFetch(key, undefined, function(source) {

      // transform source with Babel
      var output = babel.transform(source, {
        compact: false,
        filename: fileUrlToPath(key),
        sourceMaps: 'inline',
        plugins: [require('babel-plugin-transform-es2015-modules-systemjs')]
      });

      eval(output.code);
      loader.processRegisterQueue(key);
      
      resolve();
    }, reject);
  });
};

export default NodeBabelLoader;