# ES6 Module Loader

An ES6 Module Loader polyfill based on [http://wiki.ecmascript.org/doku.php?id=harmony:module_loaders](http://wiki.ecmascript.org/doku.php?id=harmony:module_loaders) by Luke Hogan, Addy Osmani and Guy Bedford.

## Getting Started

Check-out the [demo](http://moduleloader.github.io/es6-module-loader/demo/index.html) sample to see the project in action.

Define a new ES6 module:

```javascript
var module = new Module({test:'hello'});
console.log(module);
```

Use System (pre-configured Loader):

```javascript
System.import('js/test1.js', function(test1){
  console.log('test1.js loaded', test1);
  test1.tester();
});
```

Define a new module Loader instance:

```javascript
var baseURL = document.URL.substring(0, document.URL.lastIndexOf('\/') + 1);
var loader = new Loader({global: window,
    strict: false,
    resolve: function (name, options) {
      return  baseURL + name;
    }
  });
```

Usage:

```javascript

// Example 1
loader.import('js/test2.js',
  function(test) {
      console.log('test2.js loaded', test);
      test.foobar();
  }, function(err){
    console.log(err);
});

// Example 2
loader.import('js/libs/jquery-1.7.1.js',
  function() {
      console.log('jQuery loaded', loader.global.jQuery);
      loader.global.$('body').css({'background':'blue'});
  }, function(err){
    console.log(err);
});
```

Define a new module Loader instance (extended example):

```javascript
var loader = new Loader(Loader,{global: window,
    baseURL: document.URL.substring(0, document.URL.lastIndexOf('\/') + 1),
    strict: false,
    resolve: function (relURL, baseURL) {
      var url = baseURL + relURL;
      return url;
    },
    fetch: function (relURL, baseURL, request, resolved) {
      var url = baseURL + relURL;
      var xhr = new XMLHttpRequest();
      xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) {
          if (xhr.status === 200) {
            request.fulfill(xhr.responseText);
          } else {
            request.reject(xhr.statusText);
          }
        }
      };
      xhr.open("GET", url, true);
      xhr.send(null);
    },
    translate: function (src, relURL, baseURL, resolved) {
      return src;
    }
  });

console.log(loader);
```


## Notes and roadmap

### Specification Notes

The polyfill is implemented exactly to the specification now, except for the following items:

* The `extra` metadata property is not yet handled in the resolve.
* The `fetch` function is given a different specification between the prototype (`Loader.prototype.fetch`) and loader instance (`options.fetch`). Since instance functions are provided on the instance object as in the @wycats essay (`System.normalize`, `System.fetch` etc), there seems to be a conflict between these.
* The `evalAsync` function doesn't yet throw an error when exports are present, which should be the case.
* The `ToModule` function isn't implemented, but should be simple. 
* The intrinsics encapsulation is a tricky one to polyfill, but we have done our best based on a global prototype chain behaviour, where `global.__proto__ == intrinsics`. And `intrinsics.__proto__ == window`. All code is evaluated with the `window` and `this` properties referencing the `global` allowing full global encapsulation.

### Syntax Parsing

The ES6 Harmony parser is being used to do parsing, loaded only when necessary. This parser still uses an older syntax, which is currently the major critical issue to sort out for this polyfill.

The issue tracking this is here - https://code.google.com/p/esprima/issues/detail?id=410


## Contributing
In lieu of a formal styleguide, take care to maintain the existing coding style. Add unit tests for any new or changed functionality. Lint and test your code using [grunt](https://github.com/cowboy/grunt).

_Also, please don't edit files in the "dist" subdirectory as they are generated via grunt. You'll find source code in the "lib" subdirectory!_

## Release History
_(Nothing yet)_

## License
Copyright (c) 2012 Luke Hogan, Addy Osmani, Guy Bedford  
Licensed under the MIT license.
