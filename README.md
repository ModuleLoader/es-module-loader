# ES6 Module Loader Polyfill [![Build Status][travis-image]][travis-url]

Dynamically loads ES6 modules in browsers and [NodeJS](#nodejs-use) with support for loading existing and custom module formats through loader hooks.

This project implements dynamic module loading as per the newly redrafted specification at [WhatWG loader spec](https://github.com/whatwg/loader). It replaces the 0.* branch, which implements the previous ES6-specified loader API at [2014-08-24 ES6 Specification Draft Rev 27, Section 15](http://wiki.ecmascript.org/doku.php?id=harmony:specification_drafts#august_24_2014_draft_rev_27).

### System Register Only Build

The core project is contained in the `core` folder.

The `system-register-only.js` file is an illustrative build of how this project can be used to create any type of custom loader.

This loader will load `System.register` module files in both the browser and Node, as well as supporting `<script type="module">` tags that point to System.register modules.


#### Building and Running

To build run `rollup -c` to generate the `dist/system-register-only.js` loader build file.

Run `node test/test.js` to see this built version of the loader loading a `System.register` module file.

## License
Licensed under the MIT license.

[travis-url]: https://travis-ci.org/ModuleLoader/es6-module-loader
[travis-image]: https://travis-ci.org/ModuleLoader/es6-module-loader.svg?branch=master
