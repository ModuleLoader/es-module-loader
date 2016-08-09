import RegisterLoader from './core/register-loader.js';
import { isBrowser, isNode, envGlobal as global } from './core/common.js';
import { scriptLoad } from './core/fetch.js';
import { loadModuleScripts } from './core/module-scripts.js';

function SystemRegisterLoader(baseKey) {
  RegisterLoader.apply(this, arguments);

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

  if (isNode) {
    require(key);
    // no process necessary for the sync case as it happens automatically
  }
  else if (isBrowser) {
    return new Promise(function(resolve, reject) {
      scriptLoad(loader, key, function() {
        // we need to process synchronously to get the right context
        loader.processRegisterQueue(key);
        resolve();
      }, reject);
    });
  }
  else {
    throw new Error('No fetch system defined for this environment.');
  }
};

export default SystemRegisterLoader;