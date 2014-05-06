# ES6 Module Loader Polyfill

Dynamically loads ES6 modules in NodeJS and current browsers.

* Implemented exactly to the April 27 2014 ES6 specification draft.
* Provides an asynchronous loader (`System.import`) to [dynamically load ES6 modules](#basic-use).
* Uses [Traceur](https://github.com/google/traceur-compiler) for compiling ES6 modules and syntax into ES5 in the browser with source map support.
* Fully supports [ES6 circular references and bindings](#circular-references-&-bindings).
* Polyfills ES6 Promises in the browser with a bundled [es6-promise](https://github.com/jakearchibald/es6-promise) implementation.
* [Compatible with NodeJS](#nodejs-support) allowing for server-side module loading and tracing extensions.
* Supports ES6 module loading in IE9+, and dynamic module formats in IE8+.
* The complete combined polyfill comes to 7KB minified and gzipped, making it suitable for production use, provided that modules are [built into ES5 making them independent of Traceur](#moving-to-production).

For an overview of build workflows, [see the production guide](#moving-to-production).

See the [demo folder](https://github.com/ModuleLoader/es6-module-loader/blob/master/demo/index.html) in this repo for a working example demonstrating both module loading the module tag in the browser.

For an example of a universal module loader based on this polyfill for loading AMD, CommonJS and globals, see [SystemJS](https://github.com/systemjs/systemjs).

_The current version is tested against **[Traceur 0.0.41](https://github.com/google/traceur-compiler/tree/0.0.41)**._

_Note the ES6 module specification is still in draft, and subject to change._

### Basic Use

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

We can then load the module with the dynamic loader:

```html
<script>
  System.import('mymodule').then(function(m) {
    new m.q();
  }).catch(function(e) {
    setTimeout(function() {
      throw e;
    })
  })
</script>
```

The dynamic loader returns a `Module` object, which contains getters for the named exports (in this case, `q`).

_Because the loader is promise-based we need to add a catch handler in order to detect loading errors._

[Read the wiki on overview of ES6 modules and syntax](https://github.com/ModuleLoader/es6-module-loader/wiki/A-Brief-ES6-Modules-Overview).

### Circular References & Bindings

Circular references and live bindings are fully supported identically to ES6 in this polyfill.

That is:
* Bindings are set up before module execution.
* Execution is run from depth-first left to right on the module tree stopping at circular references.
* Bindings are live - an adjustment to an export of one module affects all modules importing it.

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

### Extending the Loader

The loader in its default state provides only ES6 loading.

We can extend it to load AMD, CommonJS and global scripts as well as various other custom functionality through the loader hooks.

[Read the wiki on extending the loader here](https://github.com/ModuleLoader/es6-module-loader/wiki/Extending-the-ES6-Loader).

### Module Tag

A simple analog to the module tag is provided with:

```html
<script type="module">
  // loads the 'q' export from 'mymodule.js' in the same path as the page
  import { q } from 'mymodule';

  new q(); // -> 'this is an es6 class!'
</script>
```

Ideally this should be based on polyfilling the `<module>` tag, as `<script type="module">` is not in the spec.

As such this approach is not really suitable for anything more than experimentation.

See an overview of the specification module tag features here - https://github.com/dherman/web-modules/blob/master/module-tag/explainer.md.

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

<a name="moving-to-production">
### Moving to Production

When in production, one wouldn't want to load ES6 modules and syntax in the browser. Rather the modules would be built into ES5 and AMD to be loaded.

Additionally, suitable bundling would need to be used.

Traceur provides build outputs that can be loaded with extensions to the module loader including AMD, CommonJS and a System.register build.

### NodeJS Usage

```
  npm install es6-module-loader
```

For use in NodeJS, the `Module`, `LoaderPolyfill` and `System` globals are provided as exports:

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

### Specification Notes

See the source of https://github.com/ModuleLoader/es6-module-loader/blob/master/lib/es6-module-loader.js, which contains comments detailing the exact specification notes and design decisions.

To follow the current the specification changes, see the marked issues https://github.com/ModuleLoader/es6-module-loader/issues?labels=specification&page=1&state=open.

## Contributing
In lieu of a formal styleguide, take care to maintain the existing coding style. Add unit tests for any new or changed functionality. Lint and test your code using [grunt](https://github.com/cowboy/grunt).

_Also, please don't edit files in the "dist" subdirectory as they are generated via grunt. You'll find source code in the "lib" subdirectory!_

## Credit
Copyright (c) 2014 Luke Hoban, Addy Osmani, Guy Bedford

## License
Licensed under the MIT license.
