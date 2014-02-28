(function (global) {
  var defineProperty;
  try {
    if (!!Object.defineProperty({}, 'a', {})) {
      defineProperty = Object.defineProperty;
    }
  } catch (e) {
    defineProperty = function (obj, prop, opt) {
      obj[prop] = opt.value || opt.get.call(obj);
    }
  }

  // Module Object
  function Module(obj) {
    if (typeof obj != 'object')
      throw new TypeError('Expected object');

    if (!(this instanceof Module))
      return new Module(obj);

    var self = this;
    for (var key in obj) {
      (function (key, value) {
        defineProperty(self, key, {
          configurable: false,
          enumerable: true,
          get: function () {
            return value;
          }
        });
      })(key, obj[key]);
    }
    if (Object.preventExtensions)
      Object.preventExtensions(this);
  }
  // Module.prototype = null;

  if (typeof exports === 'object') {
    module.exports = Module;
  }

  global.Module || (global.Module = Module);
  global.ModulePolyfill = Module;

})(typeof global !== 'undefined' ? global : this);
