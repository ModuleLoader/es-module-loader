# ES Module Loader Polyfill [![Build Status][travis-image]][travis-url]

Provides [low-level hooks](#registerloader-hooks) for creating ES module loaders, roughly based on the API of the [WhatWG loader spec](https://github.com/whatwg/loader),
but with [adjustments](#spec-differences) to match the current proposals for the HTML modules specification, [unspecified WhatWG changes](https://github.com/whatwg/loader/issues/147), and [NodeJS ES module adoption](https://github.com/nodejs/node/issues/8866).

Supports the [loader import and registry API](#base-loader-polyfill-api) with the [System.register](docs/system-register.md) module format to provide exact module loading semantics for ES modules in environments today. In addition, support for the [System.registerDynamic](docs/system-register-dynamic.md) is provided to allow the linking
of module graphs consisting of inter-dependent ES modules and CommonJS modules with their respective semantics retained.

This project aims to provide a fast, minimal, unopinionated loader API on top of which custom loaders can easily be built.

See the [spec differences](#spec-differences) section for a detailed description of some of the specification decisions made.

ES6 Module Loader Polyfill, the previous version of this project was built to the [outdated ES6 loader specification](http://wiki.ecmascript.org/doku.php?id=harmony:specification_drafts#august_24_2014_draft_rev_27) and can still be found at the [0.17 branch](https://github.com/ModuleLoader/es-module-loader/tree/0.17).

### Module Loader Examples

Some examples of common use case module loaders built with this project are provided below:

- [Browser ES Module Loader](https://github.com/ModuleLoader/browser-es-module-loader):
  A demonstration-only loader to load ES modules in the browser including support for the `<script type="module">` tag as specified in HTML.

- [Node ES Module Loader](https://github.com/ModuleLoader/node-es-module-loader)
  Allows loading ES modules with CommonJS interop in Node via `node-esml module/path.js` in line with the current Node
  plans for implementing ES modules. Used to run the tests and benchmarks in this project.

- [System Register Loader](https://github.com/ModuleLoader/system-register-loader):
  A fast optimized production loader that only loads `System.register` modules, recreating ES module semantics with CSP support.

### Installation

```
npm install es-module-loader --save-dev
```

### Creating a Loader

This project exposes a public API of ES modules in the `core` folder.

The minimal [polyfill loader API](#base-loader-polyfill-api) is provided in `core/loader-polyfill.js`. On top of this main API file is
`core/register-loader.js` which provides a base loader class with the non-spec `System.register` and `System.registerDynamic` support to enable the exact
linking semantics.

Helper functions are available in `core/resolve.js` and `core/common.js`. Everything that is exported can be considered
part of the publicly versioned API of this project.

Any tool can be used to build the loader distribution file from these core modules - [Rollup](http://rollupjs.org) is used to do these builds in the example loaders above, provided by the `rollup.config.js` file in the example loader repos listed above.

### Base Loader Polyfill API

The `Loader` and `ModuleNamespace` classes in `core/loader-polyfill.js` provide the basic spec API method shells for a loader instance `loader`:

- *`new Loader()`*: Instantiate a new `loader` instance.
  Defaults to environment baseURI detection in NodeJS and browsers.
- *`loader.import(key [, parentKey])`*: Promise for importing and executing a given module, returning its module instance.
- *`loader.resolve(key [, parentKey])`*: Promise for resolving the idempotent fully-normalized string key for a module.
- *`new ModuleNamespace(bindings)`*: Creates a new module namespace object instance for the given bindings object. The iterable properties
  of the bindings object are created as getters returning the corresponding values from the bindings object.
- *`loader.registry.set(resolvedKey, namespace)`*: Set a module namespace into the registry.
- *`loader.registry.get(resolvedKey)`*: Get a module namespace (if any) from the registry.
- *`loader.registry.has(resolvedKey)`*: Boolean indicating whether the given key is present in the registry.
- *`loader.registry.delete(resolvedKey)`*: Removes the given module from the registry (if any), returning true or false.
- *`loader.registry.keys()`*: Function returning the keys iterator for the registry.
- *`loader.registry.values()`*: Function returning the values iterator for the registry.
- *`loader.registry.entries()`*: Function returning the entries iterator for the registry (keys and values).
- *`loader.registry[Symbol.iterator]`*: In supported environments, provides registry entries iteration.

Example of using the base loader API:

```javascript
import { Loader, ModuleNamespace } from 'es-module-loader/core/loader-polyfill.js';

let loader = new Loader();

// override the resolve hook
loader[Loader.resolve] = function (key, parent) {
  // intercept the load of "x"
  if (key === 'x') {
    this.registry.set('x', new ModuleNamespace({ some: 'exports' }));
    return key;
  }
  return Loader.prototype[Loader.resolve](key, parent);
};

loader.import('x').then(function (m) {
  console.log(m.some);
});
```

### RegisterLoader Hooks

Instead of just hooking modules within the resolve hook, the `RegisterLoader` base class provides an instantiate hook
to separate execution from resolution and enable spec linking semantics.

Implementing a loader on top of the `RegisterLoader` base class involves extending that class and providing these
`resolve` and `instantiate` prototype hook methods:

```javascript
import RegisterLoader from 'es-module-loader/core/register-loader.js';
import { ModuleNamespace } from 'es-module-loader/core/loader-polyfill.js';

class MyCustomLoader extends RegisterLoader {
  /*
   * Constructor
   * Purely for completeness in this example
   */
  constructor (baseKey) {
    super(baseKey);
  }

  /*
   * Default resolve hook
   *
   * The default parent resolution matches the HTML spec module resolution
   * So super[RegisterLoader.resolve](key, parentKey) will return:
   *  - undefined if "key" is a plain names (eg 'lodash')
   *  - URL resolution if "key" is a relative URL (eg './x' will resolve to parentKey as a URL, or the baseURI)
   *
   * So relativeResolved becomes either a fully normalized URL or a plain name (|| key) in this example
   */
  [RegisterLoader.resolve] (key, parentKey) {
    var relativeResolved = super[RegisterLoader.resolve](key, parentKey, metadata) || key;
    return relativeResolved;
  }

  /*
   * Default instantiate hook
   *
   * This is one form of instantiate which is to return a ModuleNamespace directly
   * This will result in every module supporting:
   *
   *   import { moduleName } from 'my-module-name';
   *   assert(moduleName === 'my-module-name');
   */
  [RegisterLoader.instantiate] (key) {
    return new ModuleNamespace({ moduleName: key });
  }
}
```

The return value of `resolve` is the final key that is set in the registry.

The default normalization provided (`super[RegisterLoader.resolve]` above) follows the same approach as the HTML specification for module resolution, whereby _plain module names_ that are not valid URLs, and not starting with `./`, `../` or `/` return `undefined`.

So for example `lodash` will return `undefined`, while `./x` will resolve to `[baseURI]/x`. In NodeJS a `file:///` URL is used for the baseURI.

#### Instantiate Hook

Using these three types of return values for the `RegisterLoader` instantiate hook,
we can recreate ES module semantics interacting with legacy module formats:

##### 1. Instantiating Dynamic Modules via ModuleNamespace

If the exact module definition is already known, or loaded through another method (like calling out fully to the Node require in the node-es-module-loader),
then the direct module namespace value can be returned from instantiate:

```javascript

import { ModuleNamespace } from 'es-module-loader/core/loader-polyfill.js';

// ...

  instantiate (key) {
    var module = customModuleLoad(key);

    return new ModuleNamespace({
      default: module,
      customExport: 'value'
    });
  }
```

##### 2. Instantiating ES Modules via System.register

When instantiate returns `undefined`, it is assumed that the module key has already been registered through a
`loader.register(key, deps, declare)` call, following the System.register module format.

For example:

```javascript
  [RegisterLoader.instantate] (key) {
    // System.register
    this.register(key, ['./dep'], function (_export) {
      // ...
    });
  }
```

When using the anonymous form of System.register - `loader.register(deps, declare)`, in order to know
the context in which it was called, it is necessary to call the `processAnonRegister` method passed to instantiate:

```javascript
  [RegisterLoader.instantiate] (key, processAnonRegister) {
    // System.register
    this.register(deps, declare);

    processAnonRegister();
  }
```

The loader can then match the anonymous `System.register` call to correct module in the registry. This is used to support `<script>` loading.

> System.register is not designed to be a handwritten module format, and would usually generated from a Babel or TypeScript conversion into the "system"
 module format.

##### 3. Instantiating Legacy Modules via System.registerDynamic

This is identical to the `System.register` process above, only running `loader.registerDynamic` instead of `loader.register`:

```javascript
  [RegisterLoader.instantiate] (key, processAnonRegister) {

    // System.registerDynamic CommonJS wrapper format
    this.registerDynamic(['dep'], true, function (require, exports, module) {
      module.exports = require('dep').y;
    });

    processAnonRegister();
  }
```

For more information on the `System.registerDynamic` format [see the format explanation](docs/system-register-dynamic.md).

### Performance

Some simple benchmarks loading System.register modules are provided in the `bench` folder:

Each test operation includes a new loader class instantiation, `System.register` declarations, binding setup for ES module trees, loading and execution.

Sample results:

| Test                                      | ES Module Loader 1.3 |
| ----------------------------------------- |:--------------------:|
| Importing multiple trees at the same time | 654 ops/sec          |
| Importing a deep tree of modules          | 4,162 ops/sec        |
| Importing a single module with deps       | 8,817 ops/sec        |
| Importing a single module without deps    | 16,536 ops/sec       |

### Tracing API

When `loader.trace = true` is set, `loader.loads` provides a simple tracing API.

Also not in the spec, this allows useful tooling to build on top of the loader.

`loader.loads` is keyed by the module ID, with each record of the form:

```javascript
{
  key, // String, key
  deps, // Array, unnormalized dependencies
  depMap, // Object, mapping unnormalized dependencies to normalized dependencies
  metadata // Object, exactly as from normalize and instantiate hooks
}
```

### Spec Differences

The loader API in `core/loader-polyfill.js` matches the API of the current [WhatWG loader](https://whatwg.github.io/loader/) specification as closely as possible, while
making a best-effort implementation of the upcoming loader simplification changes as descibred in https://github.com/whatwg/loader/issues/147.

- Default normalization and error handling is implemented as in the HTML specification for module loading. Default normalization follows the HTML specification treatment of module keys as URLs, with plain names ignored by default (effectively erroring unless altering this behaviour through the hooks). Errors are cached in the registry, until the `delete` API method is called for the module that has errored. Resolve and fetch errors throw during the tree instantiation phase, while evaluation errors throw during the evaluation phase, and this is true for cached errors as well in line with the spec - https://github.com/whatwg/html/pull/2595.
- A direct `ModuleNamespace` constructor is provided over the `Module` mutator proposal in the WhatWG specification.
 Instead of storing a registry of `Module.Status` objects, we then store a registry of Module Namespace objects. The reason for this is that asynchronous rejection of registry entries as a source of truth leads to partial inconsistent rejection states
(it is possible for the tick between the rejection of one load and its parent to have to deal with an overlapping in-progress tree),
so in order to have a predictable load error rejection process, loads are only stored in the registry as fully-linked Namespace objects
and not ModuleStatus objects as promises for Namespace objects. The custom private `ModuleNamespace` constructor is used over the `Module.Status` proposal to ensure a stable API instead of tracking in-progress specification work.
- Linking between module formats does not use [zebra striping anymore](https://github.com/ModuleLoader/es6-module-loader/blob/v0.17.0/docs/circular-references-bindings.md#zebra-striping), but rather relies on linking the whole graph in deterministic order for each module format down the tree as is planned for NodeJS. This is made possible by the [dynamic modules TC39 proposal](https://github.com/caridy/proposal-dynamic-modules) which allows the export named bindings to only be determined at evaluation time for CommonJS modules. We do not currently provide tracking of circular references across module format boundaries so these will hang indefinitely like writing an infinite loop.
- `Loader` is available as a named export from `core/loader-polyfill.js` but is not by default exported to the `global.Reflect` object.
  This is to allow individual loader implementations to determine their own impact on the environment.
- A constructor argument is added to the loader that takes the environment `baseKey` to be used as the default normalization parent.
- The `RegisterLoader` splits up the `resolve` hook into `resolve` and `instantiate`. The [WhatWG reduced specification proposal](https://github.com/whatwg/loader/issues/147) to remove the loader hooks implies having a single `resolve` hook by having the module set into the registry using the `registry.set` API as a side-effect of resolution to allow custom interception as in the first loader example above. As discussed in https://github.com/whatwg/loader/issues/147#issuecomment-230407764, this may cause unwanted execution of modules when only resolution is needed via `loader.resolve` calls, so the approach taken in the `RegisterLoader` is to implement separate `resolve` and `instantiate` hooks.

## License
Licensed under the MIT license.

[travis-url]: https://travis-ci.org/ModuleLoader/es-module-loader
[travis-image]: https://travis-ci.org/ModuleLoader/es-module-loader.svg?branch=master
