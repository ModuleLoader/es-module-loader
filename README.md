# ES6 Module Loader

An ES6 Module Loader polyfill based on [http://wiki.ecmascript.org/doku.php?id=harmony:module_loaders](http://wiki.ecmascript.org/doku.php?id=harmony:module_loaders) by Luke Hoban, Addy Osmani and Guy Bedford.

Not yet suitable for production use while the specification is still subject to change.

Supports all modern browsers including IE8+.

## Download

* [Minified build](https://raw.github.com/ModuleLoader/es6-module-loader/master/dist/es6-module-loader.min.js)  ~ 11KB
* [Unminified](https://raw.github.com/ModuleLoader/es6-module-loader/master/lib/es6-module-loader.js) ~ 26KB

## Getting Started

Check-out the [demo](http://moduleloader.github.io/es6-module-loader/demo/index.html) sample to see the project in action.

Use the System (pre-configured Loader):

```javascript
System.baseURL = '/lib';
System.import('js/test1', function (test1) {
  console.log('test1.js loaded', test1);
});
```

where, test1 can contain module syntax:

test1.js:

```javascript
export function tester() {
  console.log('hello!');
}
```

Load multiple modules:

```javascript
System.import(['js/test1', 'js/test2'], function(test1, test2) {
  console.log('test1.js loaded', test1);
  console.log('test2.js loaded', test2);
}, function(err) {
  console.log('loading error');
});
```

Load a plain JavaScript file from a URL:

```javascript
System.load('js/libs/jquery-1.7.1.js', function() {
  var $ = System.global.jQuery;
  console.log('jQuery loaded', $);
  $('body').css({'background':'blue'});
});
```

Define a new module Loader instance:

```javascript
var loader = new Loader({
  global: window,
  strict: false,
  normalize: function (name, referer) {
    return normalized(name, referer.name);
  },
  resolve: function (normalized, options) {
    return '/' + normalized + '.js';
  },
  fetch: function (url, fulfill, reject, options) {
    fulfill(source);
  },
  translate: function (source, options) {
    return compile(source);
  },
  link: function (source, options) {
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

The above hooks are all optional, using the default System hooks when not present.

For an overview of working with custom loaders, see [Yehuda Katz's essay](https://gist.github.com/wycats/51c96e3adcdb3a68cbc3) or the [ES6 Module Specification](http://wiki.ecmascript.org/doku.php?id=harmony:module_loaders).

Define an ES6 module programatically (useful in optimized / production environments):

```javascript
var module = new Module({ test: 'hello' });
System.set('my-module', module);
console.log(System.get('my-module'));
```


## Notes and roadmap

### Syntax Parsing

The [Esprima ES6 Harmony parser](https://github.com/ariya/esprima/tree/harmony) is being used to do parsing, loaded only when necessary.

The following module statements are currently supported:

```javascript
import 'jquery';                        // import a module
import $ from 'jquery';                 // import the default export of a module
import { $ } from 'jquery';             // import a named export of a module
import { $ as jQuery } from 'jquery';   // import a named export to a different name

export var x = 42;                      // export a named variable
export function foo() {};               // export a named function

export default var x = 42;              // export the default export
export default function foo() {};       // export the default export as a function
export default = function foo() {};     // export the default export by assignment

export { encrypt };                     // export an existing variable
export { decrypt as dec };              // export a variable as a new name
export { encrypt as en } from 'crypto'; // export an export from another module
export * from 'crypto';                 // export all exports from another module

module 'crypto' { ... }                 // define a module
```

### NodeJS Support

For use in NodeJS, the `Module`, `Loader` and `System` globals are provided as exports:

```
  var System = require('es6-module-loader').System;
  
  System.import('some-module', callback);
```

### Custom Esprima Location

To set a custom path to the Esprima Harmony parser, specify the `data-esprima-src` attribute on the `<script>` tag used to include the module loader.

### Specification Notes

The polyfill is implemented exactly to the specification as closely as possible.

The only feature which is not possible to fully polyfill is the intrinsics functionality and sandboxing of the loader. Custom builtins and full global encapsulation is still provided.

The System normalization and resolution functions are not fully described by the specification, so some assumptions have been made which are listed here https://gist.github.com/guybedford/3712492cf0f629eed761.

To follow the current the specification changes, see https://github.com/ModuleLoader/es6-module-loader/issues?labels=specification&page=1&state=open.

## Projects using us

* [JSPM Loader](https://github.com/jspm/jspm-loader/) is a RequireJS-style loader using our polyfill to load ES6, AMD, CommonJS and global modules 

## Contributing
In lieu of a formal styleguide, take care to maintain the existing coding style. Add unit tests for any new or changed functionality. Lint and test your code using [grunt](https://github.com/cowboy/grunt).

_Also, please don't edit files in the "dist" subdirectory as they are generated via grunt. You'll find source code in the "lib" subdirectory!_

## Release History
_(Nothing yet)_

## License
Copyright (c) 2012 Luke Hoban, Addy Osmani, Guy Bedford  
Licensed under the MIT license.
