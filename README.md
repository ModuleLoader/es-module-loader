# ES6 Module Loader Polyfill [![Build Status][travis-image]][travis-url]

Dynamically loads ES6 modules in browsers and [NodeJS](#nodejs-usage) with support for loading existing and custom module formats through loader hooks.

This project implements dynamic module loading through `System` exactly to the previous ES6-specified loader API at [2014-08-24 ES6 Specification Draft Rev 27, Section 15](http://wiki.ecmascript.org/doku.php?id=harmony:specification_drafts#august_24_2014_draft_rev_27) and will continue to track this API as it is re-drafted as a browser specification (currently most likely to be at https://github.com/whatwg/loader).

* Provides an asynchronous loader (`System.import`) to [dynamically load ES6 modules](#basic-use).
* Uses [Traceur](https://github.com/google/traceur-compiler) for compiling ES6 modules and syntax into ES5 in the browser with source map support.
* Fully supports [ES6 circular references and live bindings](#circular-references--bindings).
* Polyfills ES6 Promises in the browser with an optionally bundled ES6 promise implementation.
* Supports ES6 module loading in IE8+. Other ES6 features only supported by Traceur in IE9+.
* The complete combined polyfill, including ES6 promises, comes to 9KB minified and gzipped, making it suitable for production use, provided that modules are [built into ES5 making them independent of Traceur](#moving-to-production).

For an overview of build workflows, [see the production guide](#moving-to-production).

See the [demo folder](https://github.com/ModuleLoader/es6-module-loader/blob/master/demo/index.html) in this repo for a working example demonstrating both module loading the module tag in the browser.

For an example of a universal module loader based on this polyfill for loading AMD, CommonJS and globals, see [SystemJS](https://github.com/systemjs/systemjs).

_The current version is tested against **[Traceur 0.0.79](https://github.com/google/traceur-compiler/tree/0.0.79)**._

### Basic Use

Download both [es6-module-loader.js](https://raw.githubusercontent.com/ModuleLoader/es6-module-loader/v0.11.0/dist/es6-module-loader.js) and traceur.js into the same folder.

If using ES6 syntax (optional), include [`traceur.js`](https://raw.githubusercontent.com/jmcriffey/bower-traceur/0.0.79/traceur.js) in the page first then include `es6-module-loader.js`:

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

We can then load the module with the dynamic loader:

```html
<script>
  System.import('mymodule').then(function(m) {
    new m.q();
  });
</script>
```

The dynamic loader returns a `Module` object, which contains getters for the named exports (in this case, `q`).

[Read an overview of ES6 modules and syntax](https://github.com/ModuleLoader/es6-module-loader/wiki/A-Brief-ES6-Modules-Overview).

### Custom Compilation Options

Custom [Traceur compilation options](https://github.com/google/traceur-compiler/blob/master/src/Options.js#L25) can be set through `System.traceurOptions`, eg:

```javascript
System.traceurOptions.annotations = true;
```

### Module Tag

As well as defining `window.System`, this polyfill provides support for the `<script type="module">` tag:

```html
<script type="module">
  // loads the 'q' export from 'mymodule.js' in the same path as the page
  import { q } from 'mymodule';

  new q(); // -> 'this is an es6 class!'
</script>
```

Because it is only possible to load ES6 modules with this tag, it is not suitable for production use in this way.

### baseURL

All modules are loaded relative to the `baseURL`, which by default is set to the current page path.

We can alter this with:

```javascript
  System.baseURL = '/js/lib/';
  System.import('module'); // now loads "/js/lib/module.js"
```

### Paths Implementation

_Note: This is a specification under discussion and not confirmed. This implementation will likely change._

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

### Circular References & Bindings

#### Zebra Striping

All [AMD](http://requirejs.org/docs/api.html#circular), [CommonJS](http://nodejs.org/api/modules.html#modules_cycles), and [ES6](https://github.com/ModuleLoader/es6-module-loader#circular-references--bindings) treat circular dependencies differently. 
Handling this problem is one of the major innovations in the loader spec, using a technique called **zebra striping**. This involves analyzing the dependency tree and forming alternate layers of ES6 / non-ES6 modules with circular references in each layer for linking.
The layers are then individually linked, with the appropriate circular reference handling being done within each layer. This allows CommonJS circular references to interact with ES6 circular references. Inter-format circular references are not supported as they
would be across layers.

This loader implementation handles zebra-striping automatically, allowing a loader like [SystemJS](https://github.com/systemjs/systemjs) to support all module formats with exact circular reference support.

#### ES6 Circular References &amp; Bindings

ES6 circular references and bindings behave in the following way:

* Bindings are set up before module execution.
* Execution is run from depth-first left to right on the module tree stopping at circular references.
* Bindings are live - an adjustment to an export of one module affects all modules importing it, but it can only be modified in the defining module.

even.js
```javascript
  import { odd } from './odd'

  export var counter = 0;

  export function even(n) {
    counter++;
    return n == 0 || odd(n - 1);
  }
```

odd.js
```javascript
  import { even } from './even';

  export function odd(n) {
    return n != 0 && even(n - 1);
  }
```

```javascript
  System.import('even').then(function(m) {
    m.even(10);
    m.counter;
    m.even(20);
    m.counter;
  });
```

### Moving to Production

When in production, it is not suitable to load ES6 modules and syntax in the browser.

#### System.register Output

There is a `modules=instantiate` build output in Traceur that can be used with the ES6 Module Loader, provided it has the [System.register extension](https://github.com/systemjs/systemjs/blob/master/lib/extension-register.js)
from [SystemJS](https://github.com/systemjs/systemjs).

The benefit of this output is that it provides full support for circular references and live module bindings.

This output format is explained here - https://github.com/ModuleLoader/es6-module-loader/wiki/System.register-Explained.

A basic example of using this extension with a build would be the following:

1. Build all ES6 modules into ES5 System.register form:

  ```
    traceur --out app-build.js app/app.js --modules=instantiate
  ```

2. If using additional ES6 features apart from modules syntax, load [`traceur-runtime.js`](https://raw.githubusercontent.com/jmcriffey/bower-traceur/0.0.79/traceur-runtime.js) (also included in the `bin` folder when installing Traceur through Bower or npm). Then include `es6-module-loader.js` and then apply the register extension before doing the import or loading the bundle as a script:

  ```html
    <script src="traceur-runtime.js"></script>
    <script src="es6-module-loader.js"></script>
    <script>
      /*
       * This should be a separate external script
       * Register function is included from https://github.com/systemjs/systemjs/blob/master/lib/extension-register.js
       */
      function register(loader) { 
        // ...
      }

      // this needs to be added to apply the extension
      register(System);
    </script>

    <!-- now include the bundle -->
    <script src="app-build.js"></script>

    <!-- now we can import and get modules from the bundle -->
    <script>
      System.import('app/app');
    </script>
  ```

* Note that `app-build.js` must be at the base-level for this to work.
* Also, the name we import, `app/app` must be the same name given to Traceur's compiler.

#### Building into separate files

We can also build separate files with:

```
  traceur --dir app app-build --modules=instantiate
```

With the above, we can load from the separate files identical to loading ES6.

#### Building across module formats

If using a loader like [SystemJS](https://github.com/systemjs/systemjs) to load different module formats, then a build can also be performed across module formats as well.

See [SystemJS builder](https://github.com/systemjs/builder) for this combined approach.

### NodeJS Usage

```
  npm install es6-module-loader
```

For use in NodeJS, the `Loader` and `System` globals are provided as exports:

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

### Further Documentation

* [Extending the loader through loader hooks](https://github.com/ModuleLoader/es6-module-loader/wiki/Extending-the-ES6-Loader)
* [Tracing API](https://github.com/ModuleLoader/es6-module-loader/wiki/Tracing-API)

## Contributing
In lieu of a formal styleguide, take care to maintain the existing coding style. Add unit tests for any new or changed functionality. Lint and test your code using [grunt](https://github.com/cowboy/grunt).

_Also, please don't edit files in the "dist" subdirectory as they are generated via grunt. You'll find source code in the "lib" subdirectory!_

## Credit
Copyright (c) 2014 Luke Hoban, Addy Osmani, Guy Bedford

## License
Licensed under the MIT license.

[travis-url]: https://travis-ci.org/ModuleLoader/es6-module-loader
[travis-image]: https://travis-ci.org/ModuleLoader/es6-module-loader.svg?branch=master
