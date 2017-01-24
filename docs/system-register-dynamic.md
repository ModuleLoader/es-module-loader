### System.registerDynamic

Like [System.register](system-register.md), `System.registerDynamic` is a wrapper format to ensure the exact linking
semantics of modules in all environments, such that it can wrap CommonJS, AMD and global modules.

Babel transforms can be used to convert these formats into `System.registerDynamic`. Currently the existing
transforms are still coupled to SystemJS as they rely on special helper functions and modules in SystemJS,
but the goal is to make these fully independent transformers in future:

* CommonJS: [babel-plugin-transform-cjs-system-wrapper](https://github.com/systemjs/babel-plugin-transform-cjs-system-wrapper)
* AMD: [babel-plugin-transform-amd-system-wrapper](https://github.com/jrauschenbusch/babel-plugin-transform-amd-system-wrapper)
* Global: [babel-plugin-transform-global-system-wrapper](https://github.com/systemjs/babel-plugin-transform-global-system-wrapper)

Like `System.register`, `System.registerDynamic` has both an anonymous and named form, by making the first string key argument
optional. This allows it to work as both a bundle transport format and a wrapper.

The format of `System.registerDynamic` is designed to closely match CommonJS:

```javascript
System.registerDynamic('optional-name', ['unnormalized-dependency'], true, function (require, exports, module) {
  // require is executing - the dependency is only executed when we hit this require
  // Note that we can only require modules that have already been declared through the dependencies
  // array above. This is because synchronous module instantiation is not supported in the loader.
  var dep = require('unnormalized-dependency');

  // named exports
  exports.someExport = 'export';
  // Like CommonJS, "this" is the module.exports
  this.export = 'another';

  // module.id can be read as a string (but it is a file:/// URL)
  var thisModuleKey = module.id;

  // module exports object can even be set directly
  module.exports = 'can even assign module exports';
});
```

The resultant `ModuleNamespace` object is taken to be the object with the `default` export equal to the `module.exports` value
from the CommonJS module, with this property set to the exports object from the beginning of the linking phase.
