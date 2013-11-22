# ES6 Module Loader

ES6 Module Loader polyfill based on [http://wiki.ecmascript.org/doku.php?id=harmony:module_loaders](http://wiki.ecmascript.org/doku.php?id=harmony:module_loaders) by Luke Hoban, Addy Osmani and Guy Bedford.

* [Dynamically load ES6 modules](#getting-started) in all modern browsers including IE8+
* Uses [Traceur](https://github.com/google/traceur-compiler) for [compiling ES6 modules and syntax into ES5 in the browser with source map support](#integration-with-traceur)
* Use as a base for creating a [custom spec-compliant module loader](#creating-a-custom-loader)

Not yet suitable for production use while the specification is still subject to change.

## Getting Started

Download both [es6-module-loader.js](https://raw.github.com/ModuleLoader/es6-module-loader/master/dist/es6-module-loader.js) and [traceur.js](https://raw.github.com/ModuleLoader/es6-module-loader/master/dist/traceur.js) into the same folder.

Then include the `es6-module-loader.js` file on its own in the page:

```html
  <script src="path/to/es6-module-loader.js"></script>
```

Traceur will be downloaded only when needed for ES6 syntax parsing.

If we have an ES6 module file located at `/lib/app/main.js`, we can then load this with the system loader:

```html
<script>
  System.baseURL = '/lib';
  System.import('app/main', function(app) {
    new app.Application();
  });
</script>
```

Any module dependencies of the file will be dynamically loaded and linked as per the ES6 module specification.

Modules are loaded by **Module Name** roughly using the rule:

```javascript
  URL = baseURL + '/' + ModuleName + '.js'
```

Relative module names can be written `'./local-module'` to load relative to the parent module name.

## Writing and Loading ES6 Modules

The contents of `/lib/app/main.js` can be written:

```javascript
  import { Helpers } from './app-dep';

  export class Application {
    constructor() {
      console.log('Initialized ES6 App Module');
    },
    foo() {
      Helpers.foo();
    }
  }
```

With `/lib/app/app-dep.js` containing:

```javascript
  export var Helpers = { ... };
```

When loaded, as with the `System.import` call above, these module files are dynamically loaded and compiled to ES5 in the browser and executed.

## Moving to Production

When in production, one wouldn't want to load ES6 modules and syntax in the browser. Rather the modules would be built into ES5 and AMD to be loaded.

One can construct an AMD loader from this polyfill in under 30KB for such a scenario.

Bundling techniques for ES6 are an active area of development.

## Module Tag

Modules can also be loaded with the module tag:

```html
  <script src="/path/to/es6-module-loader.js"></script>
  <script>System.baseURL = '/lib'</script>
  <script type="module">
    import { Application } from 'app/main';

    new Application();
  </script>
```

## Full Module Syntax Summary

The following module syntax is supported by this polyfill, which is to the latest specification (November 2013):

```javascript
//import 'jquery';                      // import a module  ** awaiting support in Traceur
import $ from 'jquery';                 // import the default export of a module
import { $ } from 'jquery';             // import a named export of a module
import { $ as jQuery } from 'jquery';   // import a named export to a different name

export var x = 42;                      // export a named variable
export function foo() {};               // export a named function

export default 42;                      // export the default export
export default function foo() {};       // export the default export as a function

export { encrypt };                     // export an existing variable
export { decrypt as dec };              // export a variable as a new name
export { encrypt as en } from 'crypto'; // export an export from another module
export * from 'crypto';                 // export all exports from another module

module crypto from 'crypto';            // import an entire module instance object
```

## NodeJS Support

For use in NodeJS, the `Module`, `Loader` and `System` globals are provided as exports:

```javascript
  var System = require('es6-module-loader').System;
  
  System.import('some-module', callback);
```

Tracuer support requires `npm install traceur`, allowing ES6 syntax in NodeJS:

```javascript
  var System = require('es6-module-loader').System;

  System.import('es6-file', function(module) {
    module.classMethod();
  });
```

### Custom Traceur Location

To set a custom path to the Traceur parser, specify the `data-traceur-src` attribute on the `<script>` tag used to include the module loader.

## Creating a Custom Loader

The ES6 specification defines a loader through five hooks:

* Normalize: Given the import name, provide the canonical module name.
* Resolve: Given a canonical module name, provide the URL for the resource.
* Fetch: Given a URL for a resource, fetch its content.
* Translate: Given module source, make any source modifications.
* Link: Given module source, determine its dependencies, and execute it.

Variations of these hooks can allow creating many different styles of loader.

Evey hook is optional for a new loader, with default behaviours defined.

To create a new loader, use the `Loader` constructor:

```javascript
var MyLoader = new Loader({
  global: window,
  strict: false,
  normalize: function (name, referer) {
    return canonicalName;
  },
  resolve: function (normalized, options) {
    return this.baseURL + '/' + normalized + '.js';
  },
  fetch: function (url, fulfill, reject, options) {
    myXhr.get(url, fulfill, reject);
  },
  translate: function (source, options) {
    return compile(source);
  },
  link: function (source, options) {

    // use standard es6 linking
    return;

    // provide custom linking
    // useful for providing AMD and CJS support
    return {
      imports: ['some', 'dependencies'],
      execute: function(depA, depB) {
        return new Module({
          some: 'export'
        });
      }
    };
  }
});
```

For a more in-depth overview of creating with custom loaders, see [Yehuda Katz's essay](https://gist.github.com/wycats/51c96e3adcdb3a68cbc3) or the [ES6 Module Specification](http://wiki.ecmascript.org/doku.php?id=harmony:module_loaders).

### Specification Notes

The polyfill is in the process of being updated to the latest complete draft of the module specification.

This will alter the custom loader API entirely, but the import syntax will remain mostly identical.

To follow the current the specification changes, see https://github.com/ModuleLoader/es6-module-loader/issues?labels=specification&page=1&state=open.

## Projects using us

* [JSPM Loader](https://github.com/jspm/jspm-loader/) is a RequireJS-style loader using our polyfill to load ES6, AMD, CommonJS and global modules 

## Contributing
In lieu of a formal styleguide, take care to maintain the existing coding style. Add unit tests for any new or changed functionality. Lint and test your code using [grunt](https://github.com/cowboy/grunt).

_Also, please don't edit files in the "dist" subdirectory as they are generated via grunt. You'll find source code in the "lib" subdirectory!_

## Release History
* 0.3.1 IE9 Cross Domain fix, module x from y syntax support, data-init callback support, Traceur fixes
* 0.3.0 Traceur support, better error reporting, source maps support, normalization simplifications
* 0.2.4 NodeJS support, relative normalization fixes, IE8 support

## License
Copyright (c) 2012 Luke Hoban, Addy Osmani, Guy Bedford  
Licensed under the MIT license.
