# ES Module Loader Polyfill [![Build Status][travis-image]][travis-url]

Provides a polyfill and [low-level API](#loader-hooks) for the [WhatWG loader spec](https://github.com/whatwg/loader) to create a custom module loaders.

Supports the [System.register module format](https://github.com/ModuleLoader/es-module-loader/blob/master/docs/system-register.md) to provide identical module loading semantics as ES modules in environments today.

ES6 Module Loader Polyfill, the previous version of this project built to the [outdated ES6 loader specification](http://wiki.ecmascript.org/doku.php?id=harmony:specification_drafts#august_24_2014_draft_rev_27) is available at the [0.17 branch](https://github.com/ModuleLoader/es-module-loader/tree/0.17).

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

The minimal polyfill loader is provided in `core/loader-polyfill.js`. On top of this the main API file is 
'core/register-loader.js'` which provides the base loader class.

Helper functions are available in `core/resolve.js`, `core/common.js`, `core/fetch.js` and everything that is exported can be considered
part of the publicly versioned API of this project.

Any tool can be used to build the loader distribution file from these core modules - [Rollup](http://rollupjs.org) is used to do these builds in the example loaders above,
provided by the `rollup.config.js` file in the example loader repos listed above.

### Loader Hooks

Implementing a loader on top of the `RegisterLoader` base class involves extending that class and providing `normalize` and `instantiate` prototype
methods.

These hooks are not in the spec, but defined here and as an abstraction provided by this project to make it easy to create custom loaders:

```javascript
import RegisterLoader from 'es-module-loader/core/register-loader.js';

class MyCustomLoader extends RegisterLoader {
  constructor(baseKey) {
    super(baseKey);
  }

  /*
   * Default normalize hook
   */
  normalize(key, parentKey, metadata) {
    return key;
  }

  /*
   * Default instantiate hook
   */
  instantiate(key, metadata) {
    return undefined;
  }
}
```

The default loader as described above would support loading modules if they have already been registered by key via
`loader.register` calls (the `System.register` module format, where `System` is the global loader name).

#### Normalize Hook

Relative normalization of the form `./x` is already performed using the internal resolver in `core/resolve.js`
so that the key provided into normalize will never be a relative URL - it will either be a plain / bare name
or an absolute URL.

The return value of `normalize` is the final key that is set in the registry (available and iterable as per the spec
at `loader.registry`).

#### Instantiate Hook

##### Instantiating ES Modules via System.register

When instantiate returns `undefined`, it is assumed that the module key has already been registered through a
`loader.register(key, deps, declare)` call, following the System.register module format.

For example:

```javascript
  instantate(key, metadata) {
    this.register(key, deps, declare);
    return undefined;
  }
```

When using the anonymous form of System.register - `loader.register(deps, declare)`, in order to know
the context in which it was called, it is necessary to call the `loader.processRegisterContext(contextKey)` method:

```javascript
  instantiate(key, metadata) {
    this.register(deps, declare);
    this.processRegisterContext(key);
    return undefined;
  }
```

The loader can then match the anonymous register call to the right module key. This is used to support `<script>` loading
of anonymous `System.register` modules.

##### Instantiating Dynamic / Legacy Modules via ModuleNamespace

Legacy module formats are not transpiled into `System.register`, rather they need to be executed according to their own semantics.

The instantiate can handle its own execution pipeline for these legacy modules (like calling out to the Node require in the node-es-module-loader).

Having created a module instance, we wrap it in a `ModuleNamespace` object and can return that directly from instantiate:

```javascript

import { InternalModuleNamespace } from 'es-module-loader/core/loader-polyfill.js'

// ...

  instantiate(key, metadata) {
    var module = customModuleLoad(key);

    return new InternalModuleNamespace({ default: module });
  }
```

Using these two types of return values, we can thus recreate ES module semantics interacting with legacy module formats.

Note that `InternalModuleNamespace` is not provided in the WhatWG loader specification - the specification actually uses a `Module.Status` constructor.
We've chosen to take the route of implementing a custom private method over the spec, until that spec work can be fully stabilized, instead of having
to track small changes of this spec API over major versions of this project.

### Tracing API

When `loader.trace = true` is set, `loader.loads` provides a simple tracing API.

Also not in the spec, this allows useful tooling to build on top of the loader.

`loader.loads` is keyed by the module ID, with each record of the form:

```javascript
{
  key, // String, key
  dependencies, // Array, unnormalized dependencies
  depMap, // Object, mapping unnormalized dependencies to normalized dependencies
  metadata // Object, exactly as from normalize and instantiate hooks
}
```

Instantiate functions that return an `InternalModuleNamespace` instance directly are not included in the trace registry.

Custom loaders that want to share the same trace format, should populate the trace themselves using their internal knowledge of the legacy module dependency information.

### Spec Differences

The loader API in `core/loader-polyfill.js` matches the API of the current [WhatWG loader](https://whatwg.github.io/loader/) specification as closely as possible, while
making a best-effort implementation of the upcoming loader simplification changes as descibred in https://github.com/whatwg/loader/issues/147.

Error handling is implemented as in the HTML specification for module loading, such that rejections reject the current load tree, but
are immediately removed from the registry to allow further loads to retry loading.

- Instead of storing a registry of ModuleStatus objects, we store a registry of Module Namespace objects. The reason for this is that asynchronous rejection of registry entries as a source of truth leads to partial inconsistent rejection states
(it is possible for the tick between the rejection of one load and its parent to have to deal with an overlapping in-progress tree),
so in order to have a predictable load error rejection process, loads are only stored in the registry as fully-linked Namespace objects
and not ModuleStatus objects as promises for Namespace objects (Module.evaluate is still supported though).
- `Loader` and `Module` are available as named exports from `core/loader-polyfill.js` but are not by default exported to the `global.Reflect` object.
  This is to allow individual loader implementations to determine their own impact on the environment.
- A constructor argument is added to the loader that takes the environment baseKey to be used as the default normalization parent.
- An internal `Loader.prototype[Loader.instantiate]` hook is used as well as the `Loader.prototype[Loader.resolve]` hook
  in order to ensure that uses of `loader.resolve` do not have to result in module loading and execution, as discussed in https://github.com/whatwg/loader/issues/147#issuecomment-230407764.

## License
Licensed under the MIT license.

[travis-url]: https://travis-ci.org/ModuleLoader/es-module-loader
[travis-image]: https://travis-ci.org/ModuleLoader/es-module-loader.svg?branch=master
