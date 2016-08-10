# ES Module Loader Polyfill [![Build Status][travis-image]][travis-url]

Dynamically loads ES modules in browsers and [NodeJS](#nodejs-use) with support for loading existing and custom module formats through loader hooks.

This project implements dynamic module loading as per the newly redrafted specification at [WhatWG loader spec](https://github.com/whatwg/loader). It replaces the 0.* branch, which implements the previous ES6-specified loader API at [2014-08-24 ES6 Specification Draft Rev 27, Section 15](http://wiki.ecmascript.org/doku.php?id=harmony:specification_drafts#august_24_2014_draft_rev_27).

### System Register Only Build

The core project is contained in the `core` folder.

The `loader-system-register.js` file is an illustrative build of how this project can be used to create any type of custom loader.

This loader will load `System.register` module files in both the browser and Node, as well as supporting `<script type="module">` tags that point to System.register modules.


#### Building and Running

To build run `npm run build` to generate the `dist/loader-system-register.js` and `dist/loader-babel-node.js` loader build files.

See the `example` folder for some demonstrations of the example loaders.

The tests run via `npm run test`.

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

See the `loader-system-register.js` source file for an example of how these hooks are used to construct a loader.

### Tracing API

When `loader.trace = true` is set, `loader.loads` provides a simple tracing API.

Also not in the spec, this allows useful tooling to build on top of the loader.

## License
Licensed under the MIT license.

[travis-url]: https://travis-ci.org/ModuleLoader/es-module-loader
[travis-image]: https://travis-ci.org/ModuleLoader/es-module-loader.svg?branch=master
