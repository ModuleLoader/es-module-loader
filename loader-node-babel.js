import RegisterLoader from './core/register-loader.js';
import { PrivateInternalModuleNamespace as ModuleNamespace } from './core/loader-polyfill.js';

import { isNode, baseURI, pathToFileUrl, fileUrlToPath } from './core/common.js';
import { resolveUrlToParentIfNotPlain } from './core/resolve.js';
import { nodeFetch } from './core/fetch.js';

/*
 * Node Babel loader
 *
 * Implements the Node EPS proposal at https://github.com/nodejs/node-eps/blob/master/002-es6-modules.md
 *
 * Follows the NodeJS resolution algorithm, loading modules first as CJS and then falling back to ES
 * on failure. This effectively provides the "export {}" assumption to load an ES module.
 *
 * Does not currently support the "module" package.json proposal described in the second paragraph at 
 *   https://github.com/nodejs/node-eps/blob/master/002-es6-modules.md#51-determining-if-source-is-an-es-module
 * Does not allow any loading of ES modules from within CommonJS itself
 * 
 * Alternative Babel options can be set with a local .babelrc file
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
NodeBabelLoader.prototype.normalize = function(key, parent, metadata) {
  var resolved = require.resolve(key.substr(0, 5) === 'file:' ? fileUrlToPath(key) : key);

  // core modules are returned as plain non-absolute paths
  return path.isAbsolute(resolved) ? pathToFileUrl(resolved) : resolved;
};

// instantiate just needs to run System.register
// so we fetch the source, convert into the Babel System module format, then evaluate it
NodeBabelLoader.prototype.instantiate = function(key, metadata) {
  var loader = this;

  // first, try to load the module as CommonJS
  var nodeModule = tryNodeLoad(key.substr(0, 5) === 'file:' ? fileUrlToPath(key) : key);

  if (nodeModule)
    return Promise.resolve(new ModuleNamespace({
      default: nodeModule
    }));

  // otherwise, load as ES with Babel converting into System.register
  return new Promise(function(resolve, reject) {
    nodeFetch(key, undefined, function(source) {

      // transform source with Babel
      var output = babel.transform(source, {
        compact: false,
        filename: key + '!transpiled',
        sourceFileName: key,
        moduleIds: false,
        sourceMaps: 'inline',
        plugins: [require('babel-plugin-transform-es2015-modules-systemjs')]
      });

      // evaluate without require, exports and module variables
      // we leave module in for now to allow module.require access
      eval('var require,exports;' + output.code + '\n//# sourceURL=' + key + '!transpiled');
      loader.processRegisterQueue(key);
      
      resolve();
    }, reject);
  });
};

function tryNodeLoad(path) {
  try {
    return require(path);
  }
  catch(e) {
    if (e instanceof SyntaxError && 
        (e.message.indexOf('Unexpected token export') !== -1 || 
        e.message.indexOf('Unexpected token import') !== -1 ||
        e.message.indexOf('Unexpected reserved word') !== -1))
      return;
    throw e;
  }
}

export default NodeBabelLoader;