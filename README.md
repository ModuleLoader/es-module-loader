# ES6 Module Loader

An ES6 Module Loader polyfill based on [http://wiki.ecmascript.org/doku.php?id=harmony:module_loaders](http://wiki.ecmascript.org/doku.php?id=harmony:module_loaders) by Luke Hoban, Addy Osmani and Guy Bedford.

Not yet suitable for production use while the specification is still subject to change.

## Download

* [Minified build](https://raw.github.com/ModuleLoader/es6-module-loader/master/dist/es6-module-loader.min.js)  ~ 10KB
* [Unminified build](https://raw.github.com/ModuleLoader/es6-module-loader/master/dist/es6-module-loader.js) ~ 26KB

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
var loader = new Loader(Loader, {
  global: window,
  strict: false,
  resolve: function (normalized, options) {
    return '/' + normalized + '.js';
  },
  fetch: function (url, fulfill, reject, options) {
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function () {
      if (xhr.readyState === 4) {
        if (xhr.status === 200) {
          fulfill(xhr.responseText);
        } else {
          reject(xhr.statusText);
        }
      }
    };
    xhr.open("GET", url, true);
    xhr.send(null);
  },
  translate: function (source, options) {
    return source;
  }
});
```

Define an ES6 module programatically (useful in optimized / production environments):

```javascript
var module = new Module({ test: 'hello' });
System.set('my-module', module);
console.log(System.get('my-module'));
```


## Notes and roadmap

### Specification Notes

The polyfill is implemented exactly to the specification, except where areas are currently under debate. 

The only feature which is not possible to fully polyfill is the intrinsics functionality and sandboxing of the loader. Custom builtins and full global encapsulation is still provided.

To follow the current the specification changes, see https://github.com/ModuleLoader/es6-module-loader/issues?labels=specification&page=1&state=open.

### Syntax Parsing

The [Esprima ES6 Harmony parser](https://github.com/ariya/esprima/tree/harmony) is being used to do parsing, loaded only when necessary.

The following module statements are currently supported:

```javascript
// import a module
import 'jquery';
import { $ } from 'jquery';
import { $ as jQuery } from 'jquery';

// export module values
export var x = 42;
export var p;
export function foo() {};
export { encrypt };
export { encrypt, decrypt as dec };
export * from 'crypto';

// define a module
module 'crypto' { ... }
```

The `default` import and export syntax is not yet supported.

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
