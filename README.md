# ES6 Module Loader Polyfill

Dynamically loads ES6 modules in NodeJS and current browsers.

* Implemented to the [Jan 20 ES6 Specification draft, rev 22](https://people.mozilla.org/~jorendorff/es6-draft.html#sec-ecmascript-language-modules-and-scripts).
* Provides an asynchronous loader (`System.import`) to [dynamically load ES6 modules](#getting-started).
* Uses [Traceur](https://github.com/google/traceur-compiler) for compiling ES6 modules and syntax into ES5 in the browser with source map support.
* Polyfills ES6 Promises in the browser with a bundled [when.js](https://github.com/cujojs/when/blob/master/docs/es6-promise-shim.md) implementation.
* [Compatible with NodeJS](#nodejs-support) allowing for server-side module loading.
* Supports ES6 module loading in IE9+, and any other module formats in IE8+.
* The complete combined polyfill comes to 7.4KB minified and gzipped, making it suitable for production use, provided that modules are built into ES5 making them independent of Traceur.
For an overview of build workflows, [see the production guide](#moving-to-production).

See the [demo folder](https://github.com/ModuleLoader/es6-module-loader/blob/master/demo/index.html) in this repo for a working example demonstrating both module loading the module tag in the browser.

For an example of a universal module loader based on this polyfill for loading AMD, CommonJS and globals, see [SystemJS](https://github.com/systemjs/systemjs).

_The current version is tested against **[Traceur 0.0.32](https://github.com/google/traceur-compiler/tree/traceur%400.0.32)**._

_Note the ES6 module specification is still in draft, and subject to change._

## Getting Started

Download both [es6-module-loader.js](https://raw.githubusercontent.com/ModuleLoader/es6-module-loader/v0.5.4/dist/es6-module-loader.js) and [traceur.js](https://raw.githubusercontent.com/google/traceur-compiler/traceur@0.0.32/bin/traceur.js) into the same folder.

If using ES6 syntax (optional), include `traceur.js` in the page first then include `es6-module-loader.js`:

```html
  <script src="traceur.js"></script>
  <script src="es6-module-loader.js"></script>
```

Write an ES6 module:

mymodule.js:
```javascript
  export class q {
    constructor() {
      console.log('this is an es6 class!');
    }
  }
```

Load this module with a module tag in the page:

```html
<script type="module">
  // loads the 'q' export from 'mymodule.js' in the same path as the page
  import { q } from 'mymodule';

  new q(); // -> 'this is an es6 class!'
</script>
```

Or we can also use the dynamic loader:

```html
<script>
  System.import('mymodule').then(function(m) {
    new m.q();
  });
</script>
```

The dynamic loader returns an instance of the `Module` class, which contains getters for the named exports (in this case, `q`).

Note that the dynamic module loader uses promises for resolution. Modules can have both a resolve and reject handler:

```javascript
  System.import('some-module').then(function(m) {
    // got Module instance m
  }, function(err) {
    // error
  });
```

## Background

### Specifications

The new ES6 module specification defines a module system in JavaScript using `import` and `export` syntax. For dynamically loading modules, a dynamic module loader factory is also included in the specification (`new Loader`).

A separate browser specification defines a dynamic ES6 module loader for the browser, `window.System`, as well as a `<module>` tag for using modules.

### Modules and Module Loaders

A module is simply a JavaScript file written with module syntax. Modules _export_ values, which can then be _imported_ by other modules.

[CommonJS](http://wiki.commonjs.org/wiki/CommonJS) and [AMD](https://github.com/amdjs/amdjs-api/wiki/AMD) JavaScript files are modules.

A module loader provides the ability to dynamically load modules, and also keeps track of all loaded modules in a module registry.

Typically, in production, the module registry would be populated by an initial compiled bundle of modules. Later in the page state, it may become necessary to dynamically
load a new module. This module can then share dependencies with the initial page bundle without having to reload any dependencies.

The ES6 Module Specification defines the module syntax for ES6 module files, and also defines a module loader factory class for creating ES6-compatible module loaders.

Module code is treated differently to scripts due to the nature of exports and imports. This is why the `<script type="module">` tag is introduced to distinguish script code from module code. Scripts cannot export or import, but are able to use the dynamic loader `System.import(...)`.

### Module Names and baseURL

Module names are just like moduleIDs in RequireJS. Non-relative module names (not starting with `.`) are converted to a URL with the following rule:

```javascript
  URL = absolutePath(baseURL, ModuleName + '.js')
```

Relative module names can be written `'./local-module'` to load relative to their parent module name. `..` syntax is also supported allowing easily portable modules.

The `baseURL` is set to the current page path by default. It is a property of the `System` loader and can be changed:

```javascript
  System.baseURL = '/lib/';
  System.baseURL = 'http://mysite.com/js/';
```

## ES6 Module Syntax

### Exporting

ES6 module syntax is most similar to the `exports.method = function() {}` pattern in NodeJS of creating multiple named exports.

In CommonJS one might write:

```javascript
  exports.someMethod = function() {

  };

  exports.another = {};
```

In ES6, this same code would be written:

exporter.js:
```javascript
  export function someMethod() {

  }

  export var another = {};
```

Notice that the name of the function, class or variable gets used as the export name.

### Importing

When importing, we import any exports we need by name, and can also choose to rename them:

importer.js:
```javascript
  import { someMethod, another as newName } from './exporter';

  someMethod();
  typeof newName == 'object';
```

### Default Import and Export

Sometimes one doesn't want to write an import name at all. For this we can use the default export:

export-default.js:
```javascript
  export default function foo() {
    console.log('foo');
  }
```

import-default.js:
```javascript
  import customName from './export-default';

  customName(); // -> 'foo'
```

### All Supported Syntax

There are a few other variations of module syntax, the full list of supported statements is listed below.

```javascript
import 'jquery';                        // import a module without any import bindings
import $ from 'jquery';                 // import the default export of a module
import { $ } from 'jquery';             // import a named export of a module
import { $ as jQuery } from 'jquery';   // import a named export to a different name

export var x = 42;                      // export a named variable
export function foo() {};               // export a named function
export q = {};                          // export shorthand

export default 42;                      // export the default export
export default function foo() {};       // export the default export as a function

export { encrypt };                     // export an existing variable
export { decrypt as dec };              // export a variable as a new name
export { encrypt as en } from 'crypto'; // export an export from another module
export * from 'crypto';                 // export all exports from another module

module crypto from 'crypto';            // import an entire module instance object
```

Note that any valid declaration can be exported. In ES6, this includes `class` (as in the example above), `const`, and `let`.

## Paths Implementation

_Note: This is a specification under discussion and not at all confirmed. This implementation will likely change._

The System loader provides paths rules used by the standard `locate` function.

For example, we might want to load `jquery` from a CDN location. For this we can provide a paths rule:

```javascript
  System.paths['jquery'] = '//code.jquery.com/jquery-1.10.2.min.js';
  System.import('jquery').then(function($) {
    // ...
  });
```

Any reference to `jquery` in other modules will also use this same version.

It is also possible to define wildcard paths rules. The most specific rule will be used:

```javascript
  System.paths['lodash/*'] = '/js/lodash/*.js'
  System.import('lodash/map').then(function(map) {
    // ...
  });
```

<a name="moving-to-production">
## Moving to Production

When in production, one wouldn't want to load ES6 modules and syntax in the browser. Rather the modules would be built into ES5 and AMD to be loaded.

Additionally, suitable bundling would need to be used.

Traceur provides build outputs that can be loaded with extensions to the module loader including AMD, CommonJS and a System.register build.

## Module Tag

The module tag supports both named and anonymous use.

### Anonymous Module

This is just like an anonymous &lt;script> tag, allowing code to be run directly:

```html
  <script type="module">
    import 'some-import';

    class q {

    }

    new q();
  </script>
```

### Named Module

A named module is just like an anonymous module, but defines the module in the registry as well:

```html
  <script type="module" name="my-module">
    export var p = 'named-module';
  </script>
  <script>
    // later on -
    setTimeout(function() {
      System.import('my-module').then(function(m) {
        console.log(m.p); // -> named-module
      });
    }, 100);
  </script>
```

## NodeJS Support

```
  npm install es6-module-loader
```

For use in NodeJS, the `Module`, `Loader` and `System` globals are provided as exports:

index.js:
```javascript
  var System = require('es6-module-loader').System;
  
  System.import('some-module').then(function(m) {
    console.log(m.p);
  });
```

some-module.js:
```javascript
  export var p = 'NodeJS test';
```

Running the application:
```
> node index.js
NodeJS test
```

## Creating a Custom Loader

The ES6 specification defines a loader through five hooks:

* Normalize: Given the import name, provide the canonical module name.
* Locate: Given a canonical module name, provide the URL for the resource.
* Fetch: Given a URL for a resource, fetch its content.
* Translate: Given module source, make any source modifications.
* Instantiate: Given module source, determine its dependencies, and execute it.

Variations of these hooks can allow creating many different styles of loader.

Each hook can either return a result directly, or a promise (thenable) for the result.

To use custom loader hooks, one would typically override the System loader hooks on the `System` global directly:

```javascript
  // store the old normalization function
  var systemNormalize = System.normalize.bind(System);
  // override the normalization function
  System.normalize = function(name, parentName, parentAddress) {
    if (name == 'my/custom/rule')
      return 'custom/name';
    else
      return systemNormalize(name, parentName, parentAddress);
  }
```

This is the recommended way of overriding the loader.

The signatures for all the loader hooks is provided below:

To create a new loader, use the `Loader` constructor:

```javascript

function normalize(name, parentName, parentAddress) {
  return resolvedName;
}

function locate(load) {
  // load.name is normalized name
  return this.baseURL + '/' + load.name + '.js';
}

function fetch(load) {
  // return a promise. Alternatively, just use the system fetch
  return new Promise(function(resolve, reject) {
    myXhr.get(load.address, resolve, reject);
  });
}

function translate(load) {
  return load.source;
}

function instantiate(load) {
  // use standard es6 linking
  return System.instantiate(load);

  // provide custom linking
  // useful for providing AMD and CommonJS support
  return {
    deps: ['some', 'dependencies'],
    execute: function(depNameA, depNameB) {
      // depNameA, depNameB normalized names
      var depA = System.get(depNameA);
      var depB = System.get(depNameB);
      return new Module({
        some: 'export'
      });
    }
  };
}
```

For a more in-depth overview of creating with custom loaders, some resources are provided below:
* The [System Loader implementation](https://github.com/ModuleLoader/es6-module-loader/blob/master/lib/es6-module-loader.js#L804)
* [ES6 Loader API guide](https://gist.github.com/dherman/7568080)
* [ES6 Module Specification, latest draft](https://github.com/jorendorff/js-loaders/blob/e60d3651/specs/es6-modules-2013-12-02.pdf)
* [Yehuda Katz's essay](https://gist.github.com/wycats/51c96e3adcdb3a68cbc3) (outdated)

## Specification Notes

See the source of https://github.com/ModuleLoader/es6-module-loader/blob/master/lib/es6-module-loader.js, which contains comments detailing the exact specification notes and design decisions.

To follow the current the specification changes, see the marked issues https://github.com/ModuleLoader/es6-module-loader/issues?labels=specification&page=1&state=open.



## Contributing
In lieu of a formal styleguide, take care to maintain the existing coding style. Add unit tests for any new or changed functionality. Lint and test your code using [grunt](https://github.com/cowboy/grunt).

_Also, please don't edit files in the "dist" subdirectory as they are generated via grunt. You'll find source code in the "lib" subdirectory!_

## Release History
* 0.5.1 Minor fixes and adjustment, Traceur transform bug fix, remove alias handling code
* 0.5.0 Traceur update and separation, deferred execution pipeline, IE9 compatibility fixes, code separation
* 0.4.3 ES6 detection fix, Traceur runtime inclusion
* 0.4.2 promises fixes, __moduleName support, btoa language fixes, instantiation using normalized names as arguments
* 0.4.1 various tests and bug fixes, paths config, native promises support, promises update, export * support without Traceur
* 0.4.0 Update to revised specification exact algorithm
* 0.3.3 Traceur parser update, detection regex fixes, better error messages
* 0.3.2 Use Traceur for all parsing, module tag support, syntax updates, test workflow
* 0.3.1 IE9 Cross Domain fix, module x from y syntax support, data-init callback support, Traceur fixes
* 0.3.0 Traceur support, better error reporting, source maps support, normalization simplifications
* 0.2.4 NodeJS support, relative normalization fixes, IE8 support

## Credit
Copyright (c) 2014 Luke Hoban, Addy Osmani, Guy Bedford

ES6 Promises integration from [when.js](https://github.com/cujojs/when/blob/master/docs/es6-promise-shim.md), Copyright (c) 2010-2014 Brian Cavalier, John Hann, MIT License

## License
Licensed under the MIT license.
