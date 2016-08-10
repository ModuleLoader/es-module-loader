# ES Module Loader Polyfill [![Build Status][travis-image]][travis-url]

Provides a polyfill and low-level API for the [WhatWG loader spec](https://github.com/whatwg/loader) to create a custom module loaders.

### Module Loader Examples

Some examples of common use case module loaders built with this project are provided below:

- [Browser ES Module Loader](https://github.com/ModuleLoader/browser-es-module-loader):
  A demonstration-only loader to load ES modules in the browser including support for the `<script type="module">` tag.

- [Node ES Module Loader](https://github.com/ModuleLoader/node-es-module-loader)
  Allows loading ES modules with CommonJS interop in Node via `node-esml module/path.js` in line with the current Node 
  plans for implementing ES modules. Used to run the tests and benchmarks in this project.

- [System Register Loader](https://github.com/ModuleLoader/system-register-loader):
  A highly-optimized production loader that only loads `System.register` modules.

### Spec Differences

The loader API in `core/loader-polyfill.js` matches the API of the current WhatWG specification as closely as possible.

A best-effort implementation of the upcoming loader simplification changes has been made.

Error handling is implemented as in the HTML specification for module loading, such that rejections reject the current load tree, but
are immediately removed from the registry to allow further loads to retry loading.

Instead of storing a registry of ModuleStatus objects, we store a registry of Module Namespace objects.

The reason for this is that asynchronous rejection of registry entries as a source of truth leads to partial inconsistent rejection states
(it is possible for the tick between the rejection of one load and its parent to have to deal with an overlapping in-progress tree),
so in order to have a predictable load error rejection process, loads are only stored in the registry as fully-linked Namespace objects
and not ModuleStatus objects as promises for Namespace objects (Module.evaluate is still supported though).

### Normalize and Instantiate hooks

These hooks are not in the spec, but defined here and as an abstraction provided by this project to create custom loaders.

Pending further documentation, see the example loaders listed above for how these hooks can be used.

### Tracing API

When `loader.trace = true` is set, `loader.loads` provides a simple tracing API.

Also not in the spec, this allows useful tooling to build on top of the loader.

## License
Licensed under the MIT license.

[travis-url]: https://travis-ci.org/ModuleLoader/es-module-loader
[travis-image]: https://travis-ci.org/ModuleLoader/es-module-loader.svg?branch=master
