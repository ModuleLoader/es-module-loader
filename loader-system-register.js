import RegisterLoader from './core/register-loader.js';
import { isBrowser, isNode, envGlobal as global, baseURI } from './core/common.js';
import { resolveUrlToParentIfNotPlain } from './core/resolve.js';
import { scriptLoad, nodeFetch } from './core/fetch.js';
import { loadModuleScripts } from './core/module-scripts.js';

/*
 * Example System Register loader
 *
 * Loads modules in the browser and Node as System.register modules
 * Uses <script> injection in the browser, and fs in Node
 * If the module does not call System.register, an error will be thrown
 */
function SystemRegisterLoader(baseKey) {
  baseKey = resolveUrlToParentIfNotPlain(baseKey, baseURI) || baseKey;
  RegisterLoader.call(this, baseKey);

  var loader = this;
  
  // ensure System.register is available
  global.System = global.System || {};
  global.System.register = function() {
    loader.register.apply(loader, arguments);
  };

  // support <script type="module"> tag in browsers
  loadModuleScripts(this);
}
SystemRegisterLoader.prototype = Object.create(RegisterLoader.prototype);

// normalize is never given a relative name like "./x", that part is already handled
// so we just need to do plain name normalization here
// for this loader, identity is enough to get URL-like normalization
SystemRegisterLoader.prototype.normalize = function(key, parent, metadata) {
  return key;
};

// instantiate just needs to run System.register
// so we load the module name as a URL, and expect that to run System.register
SystemRegisterLoader.prototype.instantiate = function(key, metadata) {
  var loader = this;

  return new Promise(function(resolve, reject) {
    if (isNode)
      nodeFetch(key, undefined, function(source) {
        eval(source);
        loader.processRegisterQueue(key);
        resolve();
      }, reject);
    else if (isBrowser)
      scriptLoad(key, function() {
        loader.processRegisterQueue(key);
        resolve();
      }, reject);
    else
      throw new Error('No fetch system defined for this environment.');
  });
};

export default SystemRegisterLoader;